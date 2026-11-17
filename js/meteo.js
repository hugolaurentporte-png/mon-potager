/*
 * Météo et recherche de commune — services gratuits sans clé :
 *  - geo.api.gouv.fr (API officielle des communes françaises) : nom / code postal
 *  - Open-Meteo : prévisions (températures, pluie) et altitude ; géocodage de secours
 * En cas d'échec, l'app continue avec le calendrier climatique seul.
 */
(function (racine) {
  var CLE_CACHE = 'potager.meteo.v3';
  var DUREE_FRAICHE = 3 * 3600 * 1000;   // on réutilise une prévision de moins de 3 h
  var DUREE_MAX = 24 * 3600 * 1000;      // au-delà de 24 h, une prévision est périmée

  function avecDelai(url, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 8000);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }, function (e) { clearTimeout(t); throw e; });
  }

  /** Recherche d'une commune par nom ou code postal → [{nom, codePostal, departement, lat, lon}] */
  function chercherCommune(q) {
    q = String(q || '').trim();
    if (!q) return Promise.resolve([]);
    var cp = /^\d{5}$/.test(q);
    var url = 'https://geo.api.gouv.fr/communes?' + (cp ? 'codePostal=' + q : 'nom=' + encodeURIComponent(q) + '&boost=population&limit=8') + '&fields=nom,centre,codesPostaux,codeDepartement&format=json';
    return avecDelai(url).then(function (liste) {
      return liste.filter(function (c) { return c.centre; }).map(function (c) {
        return { nom: c.nom, codePostal: cp ? q : (c.codesPostaux || [])[0] || '', departement: c.codeDepartement, lat: c.centre.coordinates[1], lon: c.centre.coordinates[0] };
      });
    }).catch(function () {
      var u2 = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=8&language=fr&countryCode=FR';
      return avecDelai(u2).then(function (r) {
        return (r.results || []).map(function (c) {
          return { nom: c.name, codePostal: (c.postcodes || [])[0] || '', departement: c.admin2 || '', lat: c.latitude, lon: c.longitude, altitude: c.elevation };
        });
      });
    });
  }

  function altitude(lat, lon) {
    return avecDelai('https://api.open-meteo.com/v1/elevation?latitude=' + lat + '&longitude=' + lon).then(function (r) {
      return r.elevation && r.elevation.length ? r.elevation[0] : null;
    }).catch(function () { return null; });
  }

  /** Remplace les valeurs du modèle global par celles de Météo-France quand elles existent (même horaire) */
  function fusionner(global, mf) {
    if (!mf) { global.modeles = { meteoFrance: false }; return global; }
    var joursMF = {};
    ['hourly', 'daily'].forEach(function (bloc) {
      var g = global[bloc], m = mf[bloc]; if (!g || !m) return;
      var index = {}; (m.time || []).forEach(function (t, i) { index[t] = i; });
      Object.keys(g).forEach(function (k) {
        if (k === 'time' || !m[k]) return;
        g[k] = g[k].map(function (v, i) {
          var j = index[g.time[i]];
          var w = j == null ? null : m[k][j];
          if (w != null && bloc === 'daily' && k === 'temperature_2m_max') joursMF[g.time[i]] = true;
          return w != null ? w : v;
        });
      });
    });
    global.modeles = { meteoFrance: true, joursMF: joursMF };
    return global;
  }

  function normaliser(r) {
    var jours = [], heures = [];
    var d = r.daily || {}, h = r.hourly || {};
    (d.time || []).forEach(function (t, i) {
      var v = function (k) { return d[k] ? d[k][i] : null; };
      jours.push({ date: t, tmin: d.temperature_2m_min[i], tmax: d.temperature_2m_max[i], pluie: v('precipitation_sum') || 0, probaPluie: v('precipitation_probability_max'), rafales: v('wind_gusts_10m_max'), code: v('weather_code'), et0: v('et0_fao_evapotranspiration') });
    });
    (h.time || []).forEach(function (t, i) {
      var v = function (k) { return h[k] ? h[k][i] : null; };
      heures.push({ t: t, pluie: v('precipitation') || 0, proba: v('precipitation_probability'), temp: v('temperature_2m'), code: v('weather_code'), vent: v('wind_speed_10m'), rafales: v('wind_gusts_10m'), humidite: v('relative_humidity_2m'), nuages: v('cloud_cover') });
    });
    return { source: 'Open-Meteo', recupereLe: new Date().toISOString(), altitude: r.elevation, jours: jours, heures: heures };
  }

  function lireCache() { try { return JSON.parse(localStorage.getItem(CLE_CACHE) || 'null'); } catch (e) { return null; } }
  function ecrireCache(c) { try { localStorage.setItem(CLE_CACHE, JSON.stringify(c)); } catch (e) { /* stockage plein ou bloqué */ } }

  /**
   * Prévisions pour un lieu. Renvoie toujours une promesse résolue :
   *  { meteo, etat: 'ok' | 'cache' | 'indisponible', message }
   */
  function prevision(lat, lon, forcer) {
    var cle = lat.toFixed(3) + ',' + lon.toFixed(3);
    var cache = lireCache(), maintenant = Date.now();
    if (!forcer && cache && cache.cle === cle && maintenant - cache.date < DUREE_FRAICHE) {
      return Promise.resolve({ meteo: cache.meteo, etat: 'ok' });
    }
    var base = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&daily=temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,weather_code,et0_fao_evapotranspiration' +
      '&hourly=precipitation,precipitation_probability,temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,cloud_cover' +
      '&past_days=3&forecast_days=8&timezone=auto';
    // Modèle Météo-France (AROME 1,3 km puis ARPEGE) pour les premiers jours, complété par le modèle global au-delà
    var mf = avecDelai(base + '&models=meteofrance_seamless', 10000).catch(function () { return null; });
    return Promise.all([avecDelai(base), mf]).then(function (rs) {
      var r = fusionner(rs[0], rs[1]);
      var m = normaliser(r);
      m.modeles = r.modeles;
      ecrireCache({ cle: cle, date: maintenant, meteo: m });
      return { meteo: m, etat: 'ok' };
    }).catch(function () {
      if (cache && cache.cle === cle && maintenant - cache.date < DUREE_MAX) {
        return { meteo: cache.meteo, etat: 'cache', message: 'Météo non actualisée : dernières prévisions de ' + new Date(cache.date).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) + '.' };
      }
      return { meteo: null, etat: 'indisponible', message: 'Météo indisponible : le calendrier climatique reste valable, mais le conseil du jour n’a pas pu être affiné (gel, chaleur, pluie).' };
    });
  }

  /* Historique : températures minimales des 10 dernières années (Open-Meteo, archive) */
  var REFERENCE = { lat: 47.90, lon: 1.90 }; // Orléans : lieu de référence des fiches (climat tempéré)
  function historiqueTmin(lat, lon) {
    var fin = new Date().getFullYear() - 1, debut = fin - 9;
    var url = 'https://archive-api.open-meteo.com/v1/archive?latitude=' + lat + '&longitude=' + lon + '&start_date=' + debut + '-01-01&end_date=' + fin + '-12-31&daily=temperature_2m_min&timezone=auto';
    return avecDelai(url, 20000).then(function (r) {
      var d = r.daily || {};
      return (d.time || []).map(function (t, i) { return { date: t, tmin: d.temperature_2m_min[i] }; });
    });
  }
  /** Climat local d'un lieu → décalages par rapport à la référence, ou null si indisponible */
  function climatLocal(lat, lon) {
    var M = racine.Moteur;
    return Promise.all([historiqueTmin(lat, lon), historiqueTmin(REFERENCE.lat, REFERENCE.lon)]).then(function (r) {
      return M.climatLocal(M.gelees(r[0]), M.gelees(r[1]));
    }).catch(function () { return null; });
  }

  racine.Meteo = { fusionner: fusionner, chercherCommune: chercherCommune, altitude: altitude, prevision: prevision, normaliser: normaliser, climatLocal: climatLocal };
})(typeof window !== 'undefined' ? window : globalThis);

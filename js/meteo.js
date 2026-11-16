/*
 * Météo et recherche de commune — services gratuits sans clé :
 *  - geo.api.gouv.fr (API officielle des communes françaises) : nom / code postal
 *  - Open-Meteo : prévisions (températures, pluie) et altitude ; géocodage de secours
 * En cas d'échec, l'app continue avec le calendrier climatique seul.
 */
(function (racine) {
  var CLE_CACHE = 'potager.meteo.v1';
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

  function normaliser(r) {
    var jours = [], heures = [];
    var d = r.daily || {}, h = r.hourly || {};
    (d.time || []).forEach(function (t, i) {
      jours.push({ date: t, tmin: d.temperature_2m_min[i], tmax: d.temperature_2m_max[i], pluie: d.precipitation_sum ? d.precipitation_sum[i] : 0 });
    });
    (h.time || []).forEach(function (t, i) { heures.push({ t: t, pluie: h.precipitation[i] || 0 }); });
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
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&daily=temperature_2m_min,temperature_2m_max,precipitation_sum&hourly=precipitation&past_days=3&forecast_days=8&timezone=auto';
    return avecDelai(url).then(function (r) {
      var m = normaliser(r);
      ecrireCache({ cle: cle, date: maintenant, meteo: m });
      return { meteo: m, etat: 'ok' };
    }).catch(function () {
      if (cache && cache.cle === cle && maintenant - cache.date < DUREE_MAX) {
        return { meteo: cache.meteo, etat: 'cache', message: 'Météo non actualisée : dernières prévisions de ' + new Date(cache.date).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) + '.' };
      }
      return { meteo: null, etat: 'indisponible', message: 'Météo indisponible : le calendrier climatique reste valable, mais le conseil du jour n’a pas pu être affiné (gel, chaleur, pluie).' };
    });
  }

  racine.Meteo = { chercherCommune: chercherCommune, altitude: altitude, prevision: prevision, normaliser: normaliser };
})(typeof window !== 'undefined' ? window : globalThis);

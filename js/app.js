/*
 * Interface — écrans, navigation et actions. Aucune règle horticole ici :
 * tout passe par Moteur (js/moteur.js) et les fiches (data/).
 */
(function () {
  var M = window.Moteur, S = window.Store, D = M.dates;
  var app = document.getElementById('app');
  var meteoEtat = { etat: 'aucune', meteo: null, message: '' };

  /* ---------- Utilitaires ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function maintenant() { return new Date(); }
  function unite(n, u) { return n > 1 || /s$/.test(u) && /(radis)$/.test(u) ? u : u.replace(/s$/, ''); }
  function aujourdhuiISO() { return D.iso(maintenant()); }
  function region() {
    var p = S.etat.profil; if (!p) return null;
    return (p.departement && window.REGIONS.depuisDepartement(p.departement)) || window.REGIONS.depuisCodePostal(p.codePostal);
  }
  function regionId() { var r = region(); return r ? r.id : null; }
  var dansClaude = !!(window.claude && window.claude.use);
  function telecharger(nom, contenu, type) {
    try {
      var url = URL.createObjectURL(new Blob([contenu], { type: type }));
      var a = document.createElement('a'); a.href = url; a.download = nom; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
      return true;
    } catch (e) { return false; }
  }
  function zoneId() { return (S.etat.profil && S.etat.profil.zone) || 'tempere'; }
  function meteo() { return meteoEtat.meteo; }
  var normalesEtat, normalesLieu = null;
  // Navigation interne : fonctionne aussi dans un cadre où l'adresse ne peut pas changer.
  var route = /^#\//.test(location.hash) ? location.hash : '#/';
  function aller(h) {
    route = h; rendre(); window.scrollTo(0, 0);
    try { if (location.hash !== h) history.replaceState(null, '', h); } catch (e) { /* adresse figée */ }
  }
  // Confirmation dans la page (les boîtes de dialogue du navigateur peuvent être bloquées)
  function confirmer(b, fn) {
    if (b.getAttribute('data-arme') === '1') { fn(); return; }
    b.setAttribute('data-arme', '1');
    b.setAttribute('data-texte', b.textContent);
    b.textContent = 'Touche encore pour confirmer';
    setTimeout(function () { if (b.isConnected) { b.removeAttribute('data-arme'); b.textContent = b.getAttribute('data-texte'); } }, 4000);
  }
  function badge(nomGeste, c) {
    return '<span class="badge n' + c.niveau + '">' + esc(nomGeste) + ' · ' + esc(c.libelle) + '</span>';
  }
  function conseilBloc(c) {
    return '<div class="conseil">' + badge(c.nomGeste, c) + '<p class="raison">' + esc(capitale(c.raison)) + (c.note ? ' <em>' + esc(c.note) + '</em>' : '') + '</p></div>';
  }
  function capitale(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function nomEspace(id) { var e = S.espace(id); return e ? e.nom : 'espace supprimé'; }
  function heure(d) { return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  function dernierArrosageTexte(d) {
    if (!d) return 'Aucun arrosage noté';
    var n = D.ecart(d, maintenant());
    var j = n === 0 ? 'aujourd’hui' : n === 1 ? 'hier' : D.formatJour(d);
    return 'Dernier arrosage : ' + j + ' à ' + heure(d);
  }
  function bandeauMeteo() {
    var p = S.etat.profil;
    if (!p || !p.commune) return '';
    if (typeof p.lat !== 'number') return '<div class="meteo meteo-ko" data-test="meteo"><strong>Météo non disponible</strong> : ta commune n’a pas pu être localisée. Le calendrier climatique reste valable, mais le conseil du jour n’est pas affiné (gel, chaleur, pluie).</div>';
    var txt;
    if (meteoEtat.etat === 'chargement') txt = 'Chargement de la météo…';
    else if (meteoEtat.meteo) {
      var j = meteoEtat.meteo.jours.filter(function (x) { return x.date === aujourdhuiISO(); })[0];
      var nuitMin = Math.min.apply(null, meteoEtat.meteo.jours.filter(function (x) { return x.date >= aujourdhuiISO(); }).slice(0, 5).map(function (x) { return x.tmin; }));
      var c = j ? M.ciel(j.code) : null;
      txt = (j ? (c.icone ? c.icone + ' ' : '') + 'Aujourd’hui ' + Math.round(j.tmin) + ' / ' + Math.round(j.tmax) + ' °C' + (j.pluie >= 0.5 ? ', pluie ' + Math.round(j.pluie) + ' mm' : '') + ' · ' : '') +
        'nuit la plus froide des 5 jours : ' + Math.round(nuitMin) + ' °C' + (meteoEtat.message ? '<br><em>' + esc(meteoEtat.message) + '</em>' : '') +
        ' <a class="lien-meteo" href="#/meteo">Prévisions 7 jours ›</a>';
    } else txt = '<strong>' + esc(meteoEtat.message || 'Météo indisponible.') + '</strong> <button class="lien" data-action="recharger-meteo">Réessayer</button>';
    return '<div class="meteo ' + (meteoEtat.meteo ? '' : 'meteo-ko') + '" data-test="meteo">' + txt + '</div>';
  }
  function entete(titre, retour) {
    var p = S.etat.profil;
    return '<header class="entete">' + (retour ? '<a class="retour" href="' + retour + '">‹ Retour</a>' : '') +
      '<h1>' + titre + '</h1>' + (p && p.commune ? '<p class="lieu">📍 ' + esc(p.commune) + ' · ' + (zoneId() === 'local' ? 'calendrier calé sur ta commune' : 'climat ' + esc(M.zone(zoneId()).nom.toLowerCase())) + '</p>' : '') + '</header>';
  }

  /* ---------- Calculs agrégés ---------- */
  function etatArrosage(e) {
    return M.arrosage(e, S.actives(e.id), S.arrosagesDe(e.id), S.reportsDe(e.id), meteo(), zoneId(), maintenant());
  }
  function suiviDe(p) { return M.suivi(p, zoneId(), maintenant(), meteo()); }

  /* ---------- Écran : Cette semaine ---------- */
  function ecranAccueil() {
    var h = entete('Cette semaine');
    h += bandeauMeteo();
    if (!S.etat.profil || !S.etat.profil.commune) {
      h += '<section class="carte accent"><h2>Bienvenue 🌱</h2><p>Indique ta commune et décris tes bacs ou parcelles : l’app adaptera le calendrier à ton climat et à la météo.</p><a class="bouton" href="#/potager">Configurer mon potager</a></section>';
    }
    h += '<div class="deux-entrees"><a class="grosse-entree" href="#/envie" data-test="envie">🌿 J’ai envie de planter…</a><a class="grosse-entree" href="#/suggestions" data-test="quoi-planter">📅 Quoi planter cette semaine ?</a></div>';

    var aFaire = 0, blocs = blocJardinDuJour();
    // Alertes météo pour le jardin
    var alertes = alertesCourantes().filter(function (a) { return a.gravite !== 'info'; });
    if (alertes.length) {
      aFaire += alertes.length;
      blocs += '<section class="carte alerte" data-test="alertes-accueil"><h2>⚠️ Météo à surveiller</h2>' + alertes.map(carteAlerte).join('') + '<a class="lien-meteo" href="#/meteo">Voir les prévisions</a></section>';
    }
    // Arrosage
    var arro = S.etat.espaces.map(function (e) { return etatArrosage(e); }).filter(function (a) { return a.statut === 'a_verifier'; });
    if (arro.length) {
      aFaire += arro.length;
      blocs += '<section class="carte"><h2>💧 Arrosage à vérifier</h2>' + arro.map(carteArrosage).join('') + '</section>';
    }
    // Suivi : gestes, étapes en retard, étapes à confirmer
    var suivis = S.actives().map(function (p) { return { p: p, s: suiviDe(p) }; });
    var aSurveiller = suivis.filter(function (x) {
      var s = x.s;
      return s.gestes.length || (s.prochaine && s.prochaine.etape !== 'recolte' && M.dates.jour(maintenant()) >= s.prochaine.du);
    });
    if (aSurveiller.length) {
      aFaire += aSurveiller.length;
      blocs += '<section class="carte"><h2>👀 À observer</h2>' + aSurveiller.map(function (x) {
        var s = x.s, c = s.culture, t = '';
        if (s.prochaine && s.prochaine.etape !== 'recolte' && M.dates.jour(maintenant()) >= s.prochaine.du) {
          t += '<p>' + (s.prochaine.enRetard ? '⚠️ ' + esc(s.prochaine.titre) + ' : fenêtre dépassée (' + esc(s.prochaine.fenetre) + '), un contrôle simple t’attend.' : esc(s.prochaine.titre) + ' attendue ' + esc(s.prochaine.fenetre) + ' : confirme-la quand tu la vois.') + '</p>';
        }
        s.gestes.forEach(function (g) { t += '<p>✋ <strong>' + esc(g.titre) + '</strong> : ' + esc(g.consigne) + '</p>'; });
        return '<a class="ligne" href="#/suivi/' + x.p.id + '"><strong>' + c.emoji + ' ' + esc(c.nom) + '</strong> <span class="petit">' + esc(nomEspace(x.p.espaceId)) + '</span>' + t + '</a>';
      }).join('') + '</section>';
    }
    // Récolte
    var recoltes = suivis.filter(function (x) { return x.s.statut === 'en_recolte' || (x.s.recolte && x.s.recolte.approche); });
    if (recoltes.length) {
      aFaire += recoltes.length;
      blocs += '<section class="carte"><h2>🧺 Récolte proche</h2>' + recoltes.map(function (x) {
        var s = x.s, c = s.culture;
        var t = s.statut === 'en_recolte' ? 'Récolte en cours.' : 'Première récolte attendue ' + esc(s.recolte.fenetre) + '.';
        return '<a class="ligne" href="#/suivi/' + x.p.id + '"><strong>' + c.emoji + ' ' + esc(c.nom) + '</strong> <span class="petit">' + esc(nomEspace(x.p.espaceId)) + '</span><p>' + t + '</p><p class="signe">Signe à observer : ' + esc(c.recolte.signe) + '</p></a>';
      }).join('') + '</section>';
    }
    if (!aFaire) {
      blocs += '<section class="carte calme" data-test="rien"><h2>Rien à faire aujourd’hui</h2><p>' + (S.actives().length ? 'Pas d’arrosage ni d’observation urgente. Profite du jardin !' : 'Aucune culture en cours pour l’instant.') + '</p></section>';
    }
    h += blocs;

    // Quoi semer / planter cette semaine
    var esp = S.etat.espaces;
    var sug = M.suggestions(null, maintenant(), zoneId(), meteo(), []).filter(function (s) {
      if (s.meilleur.niveau < 2) return false;
      if (!esp.length) return true;
      return esp.some(function (e) { return M.compatibilite(s.culture, e).ok; });
    });
    h += '<section class="carte"><h2>🌱 À semer ou planter cette semaine' + (S.etat.profil && S.etat.profil.commune ? ' <span class="petit">· ' + esc(S.etat.profil.commune) + '</span>' : '') + '</h2>';
    if (!sug.length) h += '<p>Pas de semis ni de plantation recommandés cette semaine' + (meteo() ? ' (saison ou météo défavorable)' : '') + '. Regarde le calendrier d’une culture pour la prochaine période.</p>';
    else h += sug.slice(0, 8).map(function (s) {
      return '<a class="ligne" href="#/culture/' + s.culture.id + '"><strong>' + s.culture.emoji + ' ' + esc(s.culture.nom) + '</strong> ' + badge(s.meilleur.nomGeste, s.meilleur) + '<p class="raison">' + esc(capitale(s.meilleur.raison)) + '</p></a>';
    }).join('');
    h += '</section>';
    var r = region();
    if (r) {
      var spe = window.REGIONS.specialitesDe(r.id);
      if (spe.length) h += '<section class="carte" data-test="region"><h2>🏷️ Spécialités de ta région <span class="petit">· ' + esc(r.nom) + '</span></h2>' + spe.map(function (x) {
        var c = M.culture(x.culture);
        var best = M.gestesDe(c).map(function (g) { return M.conseilGeste(c, g, maintenant(), zoneId(), meteo()); }).reduce(function (a, b) { return b.niveau > a.niveau ? b : a; });
        return '<a class="ligne" href="#/culture/' + c.id + '"><strong>' + c.emoji + ' ' + esc(x.variete.nom) + '</strong> ' + badge(best.nomGeste, best) + '<p class="petit">' + esc(x.variete.note || '') + (best.niveau === 0 ? ' · ' + esc(best.raison) : '') + '</p></a>';
      }).join('') + '</section>';
    }
    return h;
  }

  function carteArrosage(a) {
    var e = a.espace;
    return '<div class="arrosage ' + a.statut + '" data-espace="' + e.id + '"><div><strong>' + esc(e.nom) + '</strong> <span class="petit">' + (e.pluie === 'abri' ? 'sous abri' : 'à ciel ouvert') + '</span></div>' +
      verdictBloc(a) +
      '<p class="conseil-arrosage">' + esc(a.conseil) + '</p>' +
      (a.raisons.length ? '<p class="petit">' + esc(capitale(a.raisons.join(' ; '))) + '</p>' : '') +
      '<p class="petit dernier">' + esc(dernierArrosageTexte(a.dernierArrosage)) + '</p>' +
      (a.statut === 'vide' ? '' : '<div class="actions"><button class="bouton" data-action="arroser" data-id="' + e.id + '">💧 J’ai arrosé</button>' +
        (a.statut === 'a_verifier' ? '<button class="bouton secondaire" data-action="humide" data-id="' + e.id + '">Terre encore humide</button>' : '') + '</div>') +
      '</div>';
  }

  function jauge(b) {
    if (!b) return '';
    var p = b.pourcentEau, cl = p < 25 ? 'sec' : p < 50 ? 'moyen' : 'humide';
    return '<div class="jauge ' + cl + '" title="Eau disponible estimée"><i style="width:' + Math.max(3, p) + '%"></i></div><p class="petit">Eau disponible estimée dans la terre : <strong>' + p + ' %</strong></p>';
  }
  function verdictBloc(a) {
    var d = a.decision; if (!d) return '';
    return '<p class="verdict v-' + d.verdict + '" data-test="verdict">' + d.icone + ' <strong>' + esc(d.titre) + '</strong>' + (d.verdict === 'attendre' ? '<br><span class="petit">' + esc(d.texte) + '</span>' : '') + '</p>' + jauge(a.bilan);
  }
  /** « Aujourd'hui au jardin » : décisions claires pour la journée */
  function blocJardinDuJour() {
    var m = meteo(), lignes = [], now = maintenant();
    S.etat.espaces.forEach(function (e) {
      var a = etatArrosage(e); if (!a.decision) return;
      lignes.push('<li class="v-' + a.decision.verdict + '">' + a.decision.icone + ' <strong>' + esc(e.nom) + '</strong> : ' + esc(a.decision.titre.charAt(0).toLowerCase() + a.decision.titre.slice(1)) + (a.prochaine && (a.decision.verdict === 'surveiller' || a.decision.verdict === 'non') ? ' <span class="petit">(à vérifier ' + esc(M.dates.quand(a.prochaine, now)) + ')</span>' : '') + '</li>');
    });
    if (m) {
      var n = M.nuits(m, now, 2)[0];
      if (n && n.min <= 2) lignes.unshift('<li class="v-froid">🥶 <strong>' + capitale(n.nom) + ' : ' + Math.round(n.min) + ' °C</strong> vers ' + n.heureMin.getHours() + ' h' + (n.heuresGel ? ' (gel de ' + n.debutGel.getHours() + ' h à ' + n.finGel.getHours() + ' h)' : '') + ' : couvre les plantes frileuses avant la nuit.</li>');
      var can = M.canicule(m, now);
      if (can && M.dates.ecart(now, can.debut) <= 2) lignes.unshift('<li class="v-chaud">🥵 <strong>Canicule</strong> : ' + can.jours + ' jours à 30 °C ou plus (jusqu’à ' + Math.round(can.tmax) + ' °C). Arrose tôt le matin, paille le sol, ombre les jeunes plants.</li>');
      var ph = M.pluieProchaine(m, now);
      if (ph && ph.total >= 0.3) lignes.push('<li>☔ ' + esc(ph.texte) + '</li>');
      M.episodesPluie(m, now, 36).slice(0, 2).forEach(function (ep) { lignes.push('<li>🌧️ ' + esc(ep.texte) + '</li>'); });
      M.creneaux(m, now).filter(function (c) { return c.debut && D.iso(c.debut) === D.iso(now) && S.actives().length; }).slice(0, 2).forEach(function (c) { lignes.push('<li>' + c.icone + ' Bon moment pour <strong>' + esc(c.titre.split(' (')[0].toLowerCase()) + '</strong> : ' + esc(c.texte.toLowerCase()) + '</li>'); });
    }
    if (!lignes.length) return '';
    return '<section class="carte accent" data-test="jardin-jour"><h2>🌱 Aujourd’hui au jardin</h2><ul class="jardin-jour">' + lignes.join('') + '</ul></section>';
  }

  /* ---------- Écran : J'ai envie de planter… ---------- */
  function ecranEnvie() {
    var h = entete('J’ai envie de planter…', '#/');
    h += '<p class="intro">Choisis une culture pour voir quand la semer ou la planter chez toi.</p><div class="grille">';
    M.cultures().forEach(function (c) {
      var meilleur = M.gestesDe(c).map(function (g) { return M.conseilGeste(c, g, maintenant(), zoneId(), meteo()); }).reduce(function (a, b) { return b.niveau > a.niveau ? b : a; });
      h += '<a class="tuile" href="#/culture/' + c.id + '" data-test="culture-' + c.id + '"><span class="emoji">' + c.emoji + '</span><span>' + esc(c.nom) + '</span><span class="pastille n' + meilleur.niveau + '" title="' + esc(meilleur.libelle) + '"></span></a>';
    });
    return h + '</div>' + legende();
  }
  function legende() {
    return '<div class="legende"><span><i class="n0"></i>Attendre / hors saison</span><span><i class="n1"></i>Possible sous conditions</span><span><i class="n2"></i>Favorable</span><span><i class="n3"></i>Très favorable</span></div>';
  }

  /* ---------- Écran : fiche culture + calendrier ---------- */
  function ecranCulture(id) {
    var c = M.culture(id); if (!c) return ecranIntrouvable();
    var h = entete(c.emoji + ' ' + esc(c.nom), '#/envie');
    h += bandeauMeteo();
    var modes = M.modesDe(c);
    h += '<section class="carte"><h2>Cette semaine</h2>';
    M.gestesDe(c).forEach(function (g) {
      var cg = M.conseilGeste(c, g, maintenant(), zoneId(), meteo());
      h += conseilBloc(cg);
      if (g !== 'semis_abri' && meteo()) {
        var jours = M.conseilParJour(c, g, maintenant(), zoneId(), meteo(), 7);
        if (jours.length) h += '<div class="jours">' + jours.map(function (j) {
          return '<span class="jour n' + j.niveau + '" title="' + esc(j.libelle + ' : ' + j.raison) + '"><b>' + ['di', 'lu', 'ma', 'me', 'je', 've', 'sa'][j.date.getDay()] + '</b>' + Math.round(j.tmin) + '°</span>';
        }).join('') + '</div><p class="petit">Prochains jours (température de la nuit).</p>';
      }
    });
    h += '<div class="actions">';
    if (modes.indexOf('semis_place') >= 0 || modes.indexOf('semis_abri') >= 0) h += '<a class="bouton" data-test="jai-seme" href="#/demarrer/' + c.id + '/seme">🌱 J’ai semé</a>';
    if (modes.indexOf('plant') >= 0) h += '<a class="bouton" data-test="jai-plante" href="#/demarrer/' + c.id + '/plante">🪴 ' + (c.demarrage.plantation.libelle ? 'J’ai planté (' + esc(c.demarrage.plantation.libelle.replace('Planter des ', '')) + ')' : 'J’ai planté') + '</a>';
    h += '</div></section>';

    h += '<section class="carte"><h2>Calendrier dans ton climat</h2><p class="petit">Année normale en climat ' + esc(M.zone(zoneId()).nom.toLowerCase()) + '. Le conseil du jour ci-dessus tient compte de la météo.</p>';
    var an = maintenant().getFullYear(), auj = maintenant();
    var indexAuj = auj.getMonth() * 3 + Math.min(2, Math.floor((auj.getDate() - 1) / 10));
    h += '<div class="calendrier"><div class="mois-ligne"><span></span>' + 'JFMAMJJASOND'.split('').map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</div>';
    M.gestesDe(c).forEach(function (g) {
      var cases = M.bandeauAnnuel(c, g, zoneId(), an);
      h += '<div class="cal-ligne"><span class="cal-nom">' + esc(M.nomGeste(c, g)) + '</span><div class="cal-cases">' + cases.map(function (x, i) { return '<i class="n' + x.niveau + (i === indexAuj ? ' auj' : '') + '"></i>'; }).join('') + '</div></div>';
    });
    h += '</div>' + legende() + '</section>';

    h += '<section class="carte"><h2>Comment démarrer</h2><ul>';
    M.gestesDe(c).forEach(function (g) { h += '<li>' + esc(c.demarrage[g].comment) + '</li>'; });
    h += '</ul></section>';
    h += '<section class="carte"><h2>Repères</h2><ul>' +
      '<li><strong>Soleil :</strong> ' + (c.soleil.indexOf('mi-ombre') >= 0 ? 'plein soleil ou mi-ombre' : 'plein soleil (6 h ou plus)') + '</li>' +
      '<li><strong>Espacement :</strong> ' + c.espacement.plant + ' cm entre plants, ' + c.espacement.rang + ' cm entre rangs</li>' +
      '<li><strong>En bac :</strong> ' + (c.bac.possible ? 'oui, ' + c.bac.profondeurMin + ' cm de terre minimum' : 'déconseillé') + '</li>' +
      '<li><strong>Froid :</strong> ' + (c.froid.sensible ? 'craint le gel ; nuits au-dessus de ' + c.froid.nuitIdeale + ' °C idéales' : 'supporte des gelées jusqu’à ' + c.froid.gelTolere + ' °C environ') + '</li>' +
      '<li><strong>Arrosage :</strong> ' + esc(c.arrosage.consigne) + '</li>' +
      '<li><strong>Récolte :</strong> ' + esc(c.recolte.signe) + (c.recolte.multiple ? ' Récoltes successives' + (c.recolte.duree ? ' ' + esc(c.recolte.duree) : '') + '.' : '') + '</li>' +
      '<li><strong>Variétés connues :</strong> ' + c.varietes.filter(function (v) { return !v.regions; }).map(function (v) { return esc(v.nom) + (v.note ? ' (' + esc(v.note) + ')' : ''); }).join(', ') + '</li>' +
      '</ul></section>';
    var rid = regionId(), regionales = c.varietes.filter(function (v) { return v.regions; });
    if (regionales.length) {
      var miennes = regionales.filter(function (v) { return rid && v.regions.indexOf(rid) >= 0; });
      h += '<section class="carte' + (miennes.length ? ' accent' : '') + '"><h2>🏷️ Variétés régionales</h2>' + regionales.map(function (v) {
        var noms = v.regions.map(function (k) { return window.REGIONS.regions[k].nom; }).join(', ');
        return '<p>' + (rid && v.regions.indexOf(rid) >= 0 ? '<strong>' + esc(v.nom) + '</strong> · <em>ta région</em>' : esc(v.nom) + ' <span class="petit">(' + esc(noms) + ')</span>') + (v.note ? '<br><span class="petit">' + esc(v.note) + '</span>' : '') + '</p>';
      }).join('') + '</section>';
    }
    var as = window.ASSOCIATIONS.de(c.id);
    h += '<section class="carte" data-test="associations"><h2>🤝 Bons voisins</h2>' +
      '<p><strong>Se plaît à côté de :</strong> ' + (as.amis.length ? as.amis.map(function (id) { var x = M.culture(id); return x.emoji + ' ' + esc(x.nom); }).join(', ') : '—') + '</p>' +
      (as.aEviter.length ? '<p><strong>À éviter à côté de :</strong></p><ul>' + as.aEviter.map(function (v) { var x = M.culture(v.id); return '<li>' + x.emoji + ' ' + esc(x.nom) + ' : ' + esc(v.raison) + '</li>'; }).join('') + '</ul>' : '') +
      '<p class="petit">Repères de jardinier traditionnels, à prendre comme des conseils, pas comme des règles strictes.</p></section>';
    var pbs = M.problemesDe(c.id);
    if (pbs.length) h += '<section class="carte" data-test="problemes"><h2>🩺 Problèmes fréquents</h2>' + pbs.map(carteProbleme).join('') + '</section>';
    return h;
  }

  /* ---------- Écran : Quoi planter cette semaine ? ---------- */
  function ecranSuggestions(params) {
    var h = entete('Quoi planter cette semaine ?', '#/');
    h += bandeauMeteo();
    var esp = S.etat.espaces;
    if (!esp.length) {
      return h + '<section class="carte accent"><p>Ajoute d’abord un bac ou une parcelle : je pourrai te dire ce qui y pousse bien et combien de plants y tiennent.</p><a class="bouton" href="#/espace/nouveau">Ajouter un espace</a></section>';
    }
    var idE = params.espace || esp[0].id, e = S.espace(idE) || esp[0];
    h += '<label class="champ">Pour quel espace ?<select data-action="choisir-espace">' + esp.map(function (x) { return '<option value="' + x.id + '"' + (x.id === e.id ? ' selected' : '') + '>' + esc(x.nom) + '</option>'; }).join('') + '</select></label>';
    h += '<p class="petit">' + esc(descriptionEspace(e)) + '</p>';
    var actives = S.actives(e.id);
    var sug = M.suggestions(e, maintenant(), zoneId(), meteo(), actives, regionId());
    var possibles = sug.filter(function (s) { return s.compat.ok && s.meilleur.niveau >= 1; });
    var plusTard = sug.filter(function (s) { return s.compat.ok && s.meilleur.niveau === 0; });
    var non = sug.filter(function (s) { return !s.compat.ok; });
    h += '<section class="carte"><h2>Possible cette semaine</h2>';
    if (!possibles.length) h += '<p>Rien de conseillé cette semaine pour cet espace.</p>';
    h += possibles.map(function (s) { return carteSuggestion(s, e); }).join('') + '</section>';
    if (plusTard.length) h += '<section class="carte"><h2>Plus tard dans la saison</h2>' + plusTard.map(function (s) {
      return '<a class="ligne" href="#/culture/' + s.culture.id + '">' + s.culture.emoji + ' ' + esc(s.culture.nom) + ' <span class="petit">' + esc(capitale(s.meilleur.raison)) + '</span></a>';
    }).join('') + '</section>';
    if (non.length) h += '<section class="carte"><h2>Peu adapté à cet espace</h2>' + non.map(function (s) {
      return '<p>' + s.culture.emoji + ' ' + esc(s.culture.nom) + ' <span class="petit">' + esc(s.compat.raisons.join(', ')) + '</span></p>';
    }).join('') + '</section>';
    return h;
  }
  function carteSuggestion(s, e) {
    var c = s.culture, cap = s.capacite;
    var capTxt = cap.libre >= 1 ? 'Place pour environ ' + cap.libre + ' ' + unite(cap.libre, c.unite) + (cap.libre < cap.total ? ' (sur ' + cap.total + ', le reste est occupé)' : '') : 'Espace déjà occupé : il faudra libérer de la place';
    return '<div class="suggestion" data-test="sugg-' + c.id + '"><div class="titre-sugg"><strong>' + c.emoji + ' ' + esc(c.nom) + '</strong></div>' +
      badge(s.meilleur.nomGeste, s.meilleur) + '<p class="raison">' + esc(capitale(s.meilleur.raison)) + '</p>' +
      '<p>👉 ' + esc(s.demarrage) + '</p><p class="petit">' + esc(capTxt) + (s.compat.notes.length ? ' · ' + esc(s.compat.notes.join(' · ')) : '') + '</p>' +
      (s.voisins && s.voisins.amis.length ? '<p class="petit voisin-ok">✓ Bon voisin de : ' + esc(s.voisins.amis.join(', ')) + '</p>' : '') +
      (s.voisins && s.voisins.aEviter.length ? '<p class="petit voisin-ko">⚠ À éviter près de ' + s.voisins.aEviter.map(function (v) { return esc(v.nom) + ' (' + esc(v.raison) + ')'; }).join(', ') + '</p>' : '') +
      (s.regionales && s.regionales.length ? '<p class="petit">🏷️ Spécialité de ta région : ' + esc(s.regionales.map(function (v) { return v.nom; }).join(', ')) + '</p>' : '') +
      '<div class="actions"><a class="bouton secondaire" href="#/culture/' + c.id + '">Calendrier</a>' +
      (s.meilleur.geste === 'plantation' ? '<a class="bouton" href="#/demarrer/' + c.id + '/plante?espace=' + e.id + '">J’ai planté</a>' : '<a class="bouton" href="#/demarrer/' + c.id + '/seme?espace=' + e.id + '">J’ai semé</a>') +
      '</div></div>';
  }
  function descriptionEspace(e) {
    var soleil = { plein: 'plein soleil', 'mi-ombre': 'mi-ombre', ombre: 'ombre' }[e.soleil] || '';
    return (e.type === 'bac' ? 'Bac' : 'Pleine terre') + ' de ' + e.longueur + ' × ' + e.largeur + ' cm' + (e.type === 'bac' && e.profondeur ? ', ' + e.profondeur + ' cm de terre' : '') + ', ' + soleil + ', ' + (e.pluie === 'abri' ? 'sous abri (la pluie ne l’atteint pas)' : 'à ciel ouvert') +
      (e.orientation && window.TERRAIN.orientations[e.orientation] ? ', exposé ' + window.TERRAIN.orientations[e.orientation].nom.toLowerCase() : '') +
      (e.sol && window.TERRAIN.sols[e.sol] ? ', ' + window.TERRAIN.sols[e.sol].nom.toLowerCase() : '');
  }

  /* ---------- Écran : démarrer une culture ---------- */
  function ecranDemarrer(cultureId, action, params) {
    var c = M.culture(cultureId); if (!c) return ecranIntrouvable();
    var modes = M.modesDe(c).filter(function (m) { return action === 'plante' ? m === 'plant' : m !== 'plant'; });
    if (!modes.length) return entete(esc(c.nom), '#/culture/' + c.id) + '<p class="carte">Ce mode de démarrage ne s’applique pas à cette culture.</p>';
    var h = entete((action === 'plante' ? 'J’ai planté : ' : 'J’ai semé : ') + c.emoji + ' ' + esc(c.nom), '#/culture/' + c.id);
    var esp = S.etat.espaces;
    if (!esp.length) return h + '<section class="carte accent"><p>Ajoute d’abord le bac ou la parcelle où se trouve cette culture.</p><a class="bouton" href="#/espace/nouveau?retour=' + encodeURIComponent(location.hash) + '">Ajouter un espace</a></section>';
    var idE = params.espace || esp[0].id;
    var e0 = S.espace(idE) || esp[0];
    var cap = M.capacite(c, e0, S.actives(e0.id));
    h += '<form class="carte" data-form="demarrer" data-culture="' + c.id + '">';
    if (modes.length > 1) {
      h += '<fieldset class="champ"><legend>Comment ?</legend>' + modes.map(function (m, i) {
        return '<label class="radio"><input type="radio" name="mode" value="' + m + '"' + (i === 0 ? ' checked' : '') + '> ' + (m === 'semis_place' ? 'Dehors, directement en place' : 'Sous abri (godets à l’intérieur), à mettre en terre plus tard') + '</label>';
      }).join('') + '</fieldset>';
    } else h += '<input type="hidden" name="mode" value="' + modes[0] + '">';
    h += '<label class="champ">Date ' + (action === 'plante' ? 'de mise en terre' : 'du semis') + '<input type="date" name="date" required value="' + aujourdhuiISO() + '" max="' + aujourdhuiISO() + '"></label>';
    h += '<label class="champ">' + (modes.indexOf('semis_abri') >= 0 ? 'Bac ou parcelle (où la culture poussera)' : 'Bac ou parcelle') + '<select name="espace">' + esp.map(function (e) { return '<option value="' + e.id + '"' + (e.id === e0.id ? ' selected' : '') + '>' + esc(e.nom) + '</option>'; }).join('') + '</select></label>';
    var rid = regionId();
    var vs = c.varietes.filter(function (v) { return !v.regions || (rid && v.regions.indexOf(rid) >= 0); });
    vs.sort(function (a, b) { return (b.regions ? 1 : 0) - (a.regions ? 1 : 0); });
    h += '<label class="champ">Variété (facultatif)<select name="variete"><option value="">Je ne sais pas / autre</option>' + vs.map(function (v) { return '<option value="' + v.id + '">' + esc(v.nom) + (v.regions ? ' — spécialité de ta région' : '') + '</option>'; }).join('') + '</select></label>';
    h += '<label class="champ">Nombre de ' + esc(c.unite) + ' (environ)<input type="number" name="quantite" min="1" step="1" value="' + Math.max(1, cap.libre || 1) + '"></label>';
    h += '<p class="petit">Place disponible estimée dans « ' + esc(e0.nom) + ' » : ' + cap.libre + ' ' + esc(unite(cap.libre, c.unite)) + '.</p>';
    h += '<button class="bouton" type="submit" data-test="enregistrer">Enregistrer</button></form>';
    return h;
  }

  /* ---------- Écran : suivi d'une culture ---------- */
  function ecranSuivi(id) {
    var p = S.plantation(id); if (!p) return ecranIntrouvable();
    var s = suiviDe(p), c = s.culture, ch = s.chronologie;
    var h = entete(c.emoji + ' ' + esc(c.nom), '#/potager');
    var v = p.varieteId ? (c.varietes.filter(function (x) { return x.id === p.varieteId; })[0] || {}).nom : '';
    h += '<p class="intro">' + esc(M.NOMS_MODES[p.mode]) + ' le <strong>' + esc(D.format(D.lire(p.date))) + '</strong> · ' + esc(nomEspace(p.espaceId)) + (v ? ' · ' + esc(v) : '') + (p.quantite ? ' · ' + p.quantite + ' ' + esc(c.unite) : '') +
      ' <button class="lien" data-action="modifier-date" data-id="' + p.id + '">modifier</button></p>';
    h += '<form class="carte cache" data-form="date-depart" data-id="' + p.id + '"><label class="champ">Date réelle<input type="date" name="date" value="' + p.date + '" max="' + aujourdhuiISO() + '"></label><button class="bouton" type="submit">Corriger la date</button></form>';

    if (s.statut === 'terminee') {
      h += '<section class="carte calme"><h2>Culture terminée</h2><p>Terminée le ' + esc(D.format(D.lire(p.terminee))) + (p.premiereRecolte ? ', première récolte le ' + esc(D.format(D.lire(p.premiereRecolte))) : '') + '.</p></section>';
      h += blocEnsuite(p);
    } else {
      if (s.prochaine) {
        var pr = s.prochaine;
        h += '<section class="carte ' + (pr.enRetard ? 'alerte' : 'accent') + '" data-test="prochaine"><h2>Prochaine étape : ' + esc(pr.titre) + '</h2>' +
          '<p>Attendue <strong data-test="fenetre">' + esc(pr.fenetre) + '</strong>.</p>' +
          '<p><strong>Ce qui est normal maintenant :</strong> ' + esc(pr.normal) + '</p>' +
          (pr.enRetard ? '<p data-test="controle"><strong>La fenêtre est dépassée. Contrôle simple :</strong> ' + esc(pr.controle) + '</p>' : '') +
          (pr.conseilPlantation ? conseilBloc(pr.conseilPlantation) : '') +
          (pr.etape !== 'recolte' ? formObservation(p, pr.etape, pr.bouton, true) : '') + '</section>';
      }
      if (s.gestes.length) h += '<section class="carte"><h2>Gestes utiles maintenant</h2>' + s.gestes.map(function (g) { return '<p>✋ <strong>' + esc(g.titre) + '</strong> : ' + esc(g.consigne) + '</p>'; }).join('') + '</section>';

      if (s.statut === 'en_recolte') {
        h += '<section class="carte accent" data-test="recolte"><h2>🧺 Récolte en cours</h2><p>Première récolte le ' + esc(D.format(D.lire(p.premiereRecolte))) + '. ' + esc(s.message) + '</p><p class="signe">Signe à observer : ' + esc(c.recolte.signe) + '</p>' +
          '<div class="actions"><button class="bouton" data-action="terminer" data-id="' + p.id + '" data-test="terminer">Culture terminée</button></div></section>';
      } else if (s.recolte) {
        h += '<section class="carte' + (s.recolte.approche ? ' accent' : '') + '" data-test="recolte"><h2>🧺 Récolte</h2><p>Première récolte estimée <strong data-test="fenetre-recolte">' + esc(s.recolte.fenetre) + '</strong>' +
          (p.varieteId ? ' (variété prise en compte)' : '') + '.</p>' +
          (s.recolte.approche ? '<p class="signe"><strong>Signe à observer :</strong> ' + esc(c.recolte.signe) + '</p>' : '<p class="petit">Estimation recalée à chaque étape que tu confirmes.</p>') +
          '<div class="actions">' + (c.recolte.multiple
            ? '<button class="bouton" data-action="premiere-recolte" data-id="' + p.id + '" data-test="premiere-recolte">Première récolte</button><button class="bouton secondaire" data-action="terminer" data-id="' + p.id + '">Culture terminée</button>'
            : '<button class="bouton" data-action="recolte-unique" data-id="' + p.id + '" data-test="recolte-unique">Récolté · culture terminée</button>') + '</div></section>';
      }
    }

    // Chronologie
    h += '<section class="carte"><h2>Parcours</h2><ol class="frise"><li class="fait"><strong>' + (p.mode === 'plant' ? 'Mise en terre' : 'Semis') + '</strong> · ' + esc(D.format(D.lire(p.date))) + '</li>';
    ch.etapes.forEach(function (e) {
      var obs = e.observe || (e.etape === 'recolte' && p.premiereRecolte);
      h += '<li class="' + (obs ? 'fait' : e.statut) + '"><strong>' + esc(e.titre) + '</strong> · ' +
        (obs ? 'observé le ' + esc(D.format(e.observe)) + (e.etape !== 'recolte' && !p.terminee ? ' <button class="lien" data-action="annuler-obs" data-id="' + p.id + '" data-etape="' + e.etape + '">annuler</button>' : '')
          : (e.statut === 'passe' ? 'passé' : 'estimé ' + esc(D.fenetre(e.du, e.au)))) + '</li>';
    });
    h += '</ol>';
    if (!p.terminee) {
      var autres = M.etapesConfirmables(p).filter(function (et) { return !(p.observations || {})[et] && (!s.prochaine || et !== s.prochaine.etape); });
      if (autres.length) h += '<details><summary>Confirmer une autre étape</summary>' + autres.map(function (et) { return formObservation(p, et, (window.ETAPES[et] || {}).bouton, false); }).join('') + '</details>';
    }
    h += '</section>';
    h += '<section class="carte"><h2>Arrosage de ce bac</h2>' + (S.espace(p.espaceId) ? carteArrosage(etatArrosage(S.espace(p.espaceId))) : '') + '</section>';
    if (!p.terminee) {
      h += '<section class="carte"><h2>🩺 Un souci ?</h2><p>Taches, feuilles trouées, insectes, plant qui flétrit…</p><a class="bouton secondaire" href="#/problemes?culture=' + c.id + '&retour=' + encodeURIComponent('#/suivi/' + p.id) + '" data-test="souci">Trouver ce qui se passe</a></section>';
      h += '<section class="carte"><h2>📅 Rappels</h2><p class="petit">Levée, étapes à surveiller et récolte de cette culture.</p>' + blocRappels([p], false) + '</section>';
    }
    h += '<p class="centre"><button class="lien danger" data-action="supprimer-plantation" data-id="' + p.id + '">Supprimer ce suivi</button></p>';
    return h;
  }
  function formObservation(p, etape, bouton, principal) {
    return '<form class="observation" data-form="observer" data-id="' + p.id + '" data-etape="' + etape + '"><button class="bouton' + (principal ? '' : ' secondaire') + '" type="submit" data-test="obs-' + etape + '">' + esc(bouton) + '</button><label class="petit">le <input type="date" name="date" value="' + aujourdhuiISO() + '" max="' + aujourdhuiISO() + '"></label></form>';
  }
  function blocEnsuite(p) {
    var e = S.espace(p.espaceId); if (!e) return '';
    var props = M.apresCulture(p.cultureId, e, maintenant(), zoneId(), meteo(), S.actives(e.id));
    if (!props.length) return '<section class="carte"><h2>Et ensuite ?</h2><p>Rien de conseillé tout de suite dans « ' + esc(e.nom) + ' ». Un apport de compost et un paillage protégeront la terre en attendant.</p></section>';
    return '<section class="carte accent" data-test="ensuite"><h2>« ' + esc(e.nom) + ' » se libère : et ensuite ?</h2>' + props.map(function (s) { return carteSuggestion(s, e); }).join('') + '</section>';
  }

  /* ---------- Écran : arrosage ---------- */
  function ecranArrosage() {
    var h = entete('Arrosage', '#/');
    h += bandeauMeteo();
    var esp = S.etat.espaces;
    if (!esp.length) return h + '<section class="carte accent"><p>Ajoute tes bacs ou parcelles pour suivre l’arrosage.</p><a class="bouton" href="#/espace/nouveau">Ajouter un espace</a></section>';
    h += '<form class="carte" data-form="arroser-plusieurs"><h2>J’ai arrosé plusieurs espaces</h2>' + esp.map(function (e) {
      return '<label class="radio"><input type="checkbox" name="espaces" value="' + e.id + '"> ' + esc(e.nom) + '</label>';
    }).join('') + '<button class="bouton" type="submit" data-test="arroser-selection">💧 J’ai arrosé la sélection</button></form>';
    h += '<section class="carte"><h2>Chaque espace</h2>' + esp.map(function (e) { return carteArrosage(etatArrosage(e)); }).join('') + '</section>';
    return h;
  }

  /* ---------- Écran : mon potager ---------- */
  function ecranPotager() {
    var p = S.etat.profil || {};
    var h = entete('Mon potager');
    h += '<section class="carte"><h2>Où est ton potager ?</h2>' +
      (p.commune ? '<p>📍 <strong data-test="commune">' + esc(p.commune) + '</strong>' + (p.codePostal ? ' (' + esc(p.codePostal) + ')' : '') + (typeof p.altitude === 'number' ? ' · ' + Math.round(p.altitude) + ' m' : '') + '</p>' : '') +
      '<form data-form="chercher-commune" class="ligne-form"><input name="q" placeholder="Commune ou code postal" aria-label="Commune ou code postal" required><button class="bouton" type="submit">Chercher</button></form><div id="resultats-commune"></div>' +
      '<label class="champ">Climat <select data-action="choisir-zone">' + Object.keys(window.CLIMATS.zones).map(function (k) {
        var z = window.CLIMATS.zones[k]; return '<option value="' + k + '"' + (zoneId() === k ? ' selected' : '') + '>' + esc(z.nom) + ' — ' + esc(z.description) + '</option>';
      }).join('') + '</select></label>' +
      (p.zone === 'local' && p.climatLocal ? '<p class="petit" data-test="climat-local">Calendrier calé sur les gelées des ' + p.climatLocal.annees + ' dernières années à ' + esc(p.commune) + ' : dernières gelées vers le ' + esc(D.format(D.lire('2001-' + p.climatLocal.derniere))) + ', premières vers le ' + esc(D.format(D.lire('2001-' + p.climatLocal.premiere))) + '. Si ton jardin est plus abrité ou plus exposé que la moyenne, choisis une autre zone.</p>'
        : (typeof p.lat === 'number' && !p.climatLocal ? '<p class="petit">Calcul du climat de ta commune en cours (historique des gelées)… En attendant : zone ' + esc(M.zone(p.zoneAuto || zoneId()).nom.toLowerCase()) + '.</p>' : '<p class="petit">Déduit de ton département ; modifie-le si ton jardin est plus chaud ou plus froid que la moyenne.</p>')) +
      '</section>';
    h += '<section class="carte"><h2>Mes bacs et parcelles</h2>';
    if (!S.etat.espaces.length) h += '<p>Aucun espace pour l’instant.</p>';
    h += S.etat.espaces.map(function (e) {
      var n = S.actives(e.id).length;
      return '<a class="ligne" href="#/espace/' + e.id + '"><strong>' + (e.type === 'bac' ? '🪴 ' : '🟫 ') + esc(e.nom) + '</strong><p class="petit">' + esc(descriptionEspace(e)) + '</p><p class="petit">' + (n ? n + ' culture' + (n > 1 ? 's' : '') + ' en cours' : 'libre') + '</p></a>';
    }).join('');
    h += '<a class="bouton" href="#/espace/nouveau" data-test="ajouter-espace">+ Ajouter un bac ou une parcelle</a></section>';
    var actives = S.actives();
    h += '<section class="carte"><h2>Cultures en cours</h2>' + (actives.length ? actives.map(function (pl) {
      var s = suiviDe(pl), c = s.culture;
      var t = s.statut === 'en_recolte' ? 'récolte en cours' : s.prochaine ? s.prochaine.titre.toLowerCase() + ' ' + s.prochaine.fenetre : '';
      return '<a class="ligne" href="#/suivi/' + pl.id + '">' + c.emoji + ' <strong>' + esc(c.nom) + '</strong> <span class="petit">' + esc(nomEspace(pl.espaceId)) + ' · ' + esc(t) + '</span></a>';
    }).join('') : '<p>Aucune. Va dans « J’ai envie de planter… » pour commencer.</p>') + '</section>';
    var finies = S.etat.plantations.filter(function (x) { return x.terminee; });
    if (finies.length) h += '<details class="carte"><summary>Cultures terminées (' + finies.length + ')</summary>' + finies.map(function (pl) { var c = M.culture(pl.cultureId); return '<a class="ligne" href="#/suivi/' + pl.id + '">' + c.emoji + ' ' + esc(c.nom) + ' <span class="petit">' + esc(nomEspace(pl.espaceId)) + '</span></a>'; }).join('') + '</details>';
    if (actives.length) h += '<section class="carte"><h2>📅 Rappels sur mon téléphone</h2><p>Toutes les étapes et récoltes à venir de tes cultures, plus un rappel « vérifier la terre » le soir pour chaque bac, au bon rythme selon son type, son sol et son exposition.</p>' + blocRappels(actives, true) + '</section>';
    h += '<p class="centre"><a href="#/problemes">🩺 Maladies et nuisibles courants</a></p>';
    h += '<p class="centre"><button class="lien danger" data-action="tout-effacer">Effacer toutes mes données</button></p>';
    return h;
  }

  function ecranEspaceForm(id, params) {
    var e = id ? S.espace(id) : null;
    var v = e || { nom: '', type: 'bac', longueur: 100, largeur: 40, profondeur: 30, soleil: 'plein', pluie: 'ciel_ouvert' };
    var h = entete(e ? 'Modifier « ' + esc(e.nom) + ' »' : 'Nouvel espace', e ? '#/espace/' + e.id : '#/potager');
    h += '<form class="carte" data-form="espace"' + (e ? ' data-id="' + e.id + '"' : '') + (params.retour ? ' data-retour="' + esc(params.retour) + '"' : '') + '>' +
      '<label class="champ">Nom<input name="nom" required maxlength="40" placeholder="Ex. Bac balcon" value="' + esc(v.nom) + '"></label>' +
      '<fieldset class="champ"><legend>Type</legend><label class="radio"><input type="radio" name="type" value="bac"' + (v.type === 'bac' ? ' checked' : '') + '> Bac / jardinière</label><label class="radio"><input type="radio" name="type" value="pleine_terre"' + (v.type === 'pleine_terre' ? ' checked' : '') + '> Pleine terre</label></fieldset>' +
      '<div class="deux"><label class="champ">Longueur (cm)<input type="number" name="longueur" min="10" max="5000" required value="' + v.longueur + '"></label><label class="champ">Largeur (cm)<input type="number" name="largeur" min="10" max="5000" required value="' + v.largeur + '"></label></div>' +
      '<label class="champ">Profondeur de terre (cm, pour un bac)<input type="number" name="profondeur" min="5" max="200" value="' + (v.profondeur || '') + '"></label>' +
      '<fieldset class="champ"><legend>Ensoleillement</legend>' +
      [['plein', 'Plein soleil (6 h ou plus)'], ['mi-ombre', 'Mi-ombre (3 à 6 h)'], ['ombre', 'Ombre (moins de 3 h)']].map(function (o) { return '<label class="radio"><input type="radio" name="soleil" value="' + o[0] + '"' + (v.soleil === o[0] ? ' checked' : '') + '> ' + o[1] + '</label>'; }).join('') + '</fieldset>' +
      '<fieldset class="champ"><legend>Exposition (vers où il est tourné)</legend><div class="choix-grille">' +
      [['sud', 'Sud'], ['est', 'Est'], ['ouest', 'Ouest'], ['nord', 'Nord'], ['', 'Je ne sais pas']].map(function (o) { return '<label class="radio"><input type="radio" name="orientation" value="' + o[0] + '"' + ((v.orientation || '') === o[0] ? ' checked' : '') + '> ' + o[1] + '</label>'; }).join('') + '</div>' +
      '<p class="petit">Sud = soleil toute la journée ; nord = à l’ombre d’un mur ou d’une maison.</p></fieldset>' +
      '<label class="champ">Type de terre<select name="sol"><option value="">Je ne sais pas</option>' + Object.keys(window.TERRAIN.sols).map(function (k) { var x = window.TERRAIN.sols[k]; return '<option value="' + k + '"' + (v.sol === k ? ' selected' : '') + '>' + esc(x.nom) + ' — ' + esc(x.aide) + '</option>'; }).join('') + '</select></label>' +
      '<fieldset class="champ"><legend>Pluie</legend><label class="radio"><input type="radio" name="pluie" value="ciel_ouvert"' + (v.pluie !== 'abri' ? ' checked' : '') + '> À ciel ouvert (reçoit la pluie)</label><label class="radio"><input type="radio" name="pluie" value="abri"' + (v.pluie === 'abri' ? ' checked' : '') + '> Sous abri (avancée de toit, serre, véranda)</label></fieldset>' +
      '<button class="bouton" type="submit" data-test="enregistrer-espace">Enregistrer</button></form>';
    return h;
  }

  function ecranEspace(id) {
    var e = S.espace(id); if (!e) return ecranIntrouvable();
    var h = entete(esc(e.nom), '#/potager');
    h += '<p class="intro">' + esc(descriptionEspace(e)) + ' · <a href="#/espace/' + e.id + '/modifier">modifier</a></p>';
    if (e.sol && window.TERRAIN.sols[e.sol]) h += '<section class="carte"><h2>Ta terre</h2><p>' + esc(window.TERRAIN.sols[e.sol].conseil) + '</p></section>';
    h += '<section class="carte"><h2>Arrosage</h2>' + carteArrosage(etatArrosage(e)) + '</section>';
    var act = S.actives(e.id);
    h += '<section class="carte"><h2>Cultures en cours</h2>' + (act.length ? act.map(function (pl) {
      var c = M.culture(pl.cultureId); return '<a class="ligne" href="#/suivi/' + pl.id + '">' + c.emoji + ' ' + esc(c.nom) + ' <span class="petit">' + (pl.quantite || '') + ' ' + esc(c.unite) + '</span></a>';
    }).join('') : '<p>Libre.</p>') + '<a class="bouton secondaire" href="#/suggestions?espace=' + e.id + '">Quoi planter ici ?</a></section>';
    h += '<p class="centre"><button class="lien danger" data-action="supprimer-espace" data-id="' + e.id + '">Supprimer cet espace</button></p>';
    return h;
  }

  /* ---------- Maladies et nuisibles ---------- */
  function carteProbleme(pb) {
    return '<details class="probleme" id="pb-' + pb.id + '"><summary>' + pb.emoji + ' ' + esc(pb.nom) + '</summary>' +
      '<p><strong>Ce que tu vois :</strong> ' + esc(pb.signes) + '</p>' +
      '<p><strong>Pour l’éviter :</strong> ' + esc(pb.prevenir) + '</p>' +
      '<p><strong>Si c’est là :</strong> ' + esc(pb.agir) + '</p></details>';
  }
  function ecranProblemes(params) {
    var c = params.culture && M.culture(params.culture);
    var h = entete(c ? 'Un souci avec ' + esc(c.nom.toLowerCase()) + ' ?' : 'Maladies et nuisibles', c && params.retour ? params.retour : '#/');
    var liste = c ? M.problemesDe(c.id) : window.PROBLEMES;
    h += '<p class="intro">Touche un problème pour voir comment le reconnaître et quoi faire, avec des solutions simples et sans produit chimique.</p>';
    h += '<section class="carte">' + liste.map(carteProbleme).join('') + '</section>';
    if (c) h += '<p class="centre"><a href="#/problemes">Voir tous les problèmes courants</a></p>';
    return h;
  }

  /* ---------- Rappels agenda ---------- */
  function blocRappels(plantations, avecArrosage) {
    if (dansClaude) return '<p class="petit">Les rappels d’agenda sont disponibles dans la version du site (hugolaurentporte-png.github.io/mon-potager).</p>';
    return '<div class="actions"><button class="bouton secondaire" data-action="rappels" data-ids="' + plantations.map(function (p) { return p.id; }).join(',') + '"' + (avecArrosage ? ' data-arrosage="1"' : '') + ' data-test="rappels">📅 Ajouter les rappels à mon agenda</button></div>' +
      '<p class="petit">Crée un fichier agenda : ton téléphone propose de l’ajouter à ton calendrier, et tu reçois les rappels même quand l’appli est fermée.</p>';
  }
  function genererRappels(ids, avecArrosage) {
    var ev = [];
    ids.forEach(function (id) {
      var p = S.plantation(id); if (!p) return;
      var e = S.espace(p.espaceId);
      ev = ev.concat(M.rappelsPlantation(Object.assign({ espaceNom: e ? e.nom : '' }, p), zoneId(), maintenant()));
    });
    if (avecArrosage) S.etat.espaces.forEach(function (e) { if (S.actives(e.id).length) ev.push(M.rappelArrosage(e, maintenant(), 40)); });
    return ev;
  }

  /* ---------- Écran : météo ---------- */
  function activesDetaillees() {
    return S.actives().map(function (p) { return { plantation: p, culture: M.culture(p.cultureId), espace: S.espace(p.espaceId) }; }).filter(function (a) { return a.culture; });
  }
  function alertesCourantes() { return M.alertesJardin(meteo(), maintenant(), activesDetaillees(), 7); }
  function carteAlerte(a) {
    return '<div class="alerte-ligne ' + a.gravite + '" data-type="' + a.type + '"><p><strong>' + esc(a.titre) + '</strong> <span class="petit">' + esc(a.quand) + '</span></p>' +
      (a.detail ? '<p class="petit detail-alerte">🕒 ' + esc(a.detail) + '</p>' : '') + '<p>' + esc(a.conseil) + '</p>' + (a.concerne.length ? '<p class="petit">Concerne : ' + esc(a.concerne.join(', ')) + '</p>' : '') +
      (a.probleme ? '<a class="lien-meteo" href="#/problemes">Reconnaître et traiter</a>' : '') + '</div>';
  }
  function ecranMeteo() {
    var h = entete('Météo du jardin', '#/');
    var p = S.etat.profil;
    if (!p || !p.commune) return h + '<section class="carte accent"><p>Indique ta commune pour voir la météo de ton jardin.</p><a class="bouton" href="#/potager">Indiquer ma commune</a></section>';
    if (!meteo()) return h + bandeauMeteo() + '<section class="carte"><p>Sans prévisions, l’app se base sur le calendrier habituel de ton climat. Les alertes gel, chaleur et pluie réapparaîtront dès que la météo sera disponible.</p></section>';
    if (meteoEtat.message) h += '<div class="meteo meteo-ko">' + esc(meteoEtat.message) + '</div>';
    var al = alertesCourantes();
    h += '<section class="carte' + (al.some(function (a) { return a.gravite === 'alerte'; }) ? ' alerte' : '') + '" data-test="alertes"><h2>Alertes pour le jardin</h2>' +
      (al.length ? al.map(carteAlerte).join('') : '<p>Rien de particulier cette semaine : ni gel, ni forte chaleur, ni grosse pluie annoncés.</p>') + '</section>';
    h += blocPluieHeure();
    h += bloc48h();
    h += blocEauBacs();
    h += blocCreneaux();
    var jours = M.previsions(meteo(), maintenant(), 7);
    h += '<section class="carte"><h2>7 prochains jours</h2><p class="petit">Touche un jour pour voir le détail heure par heure.</p><div class="previsions" data-test="previsions">' + jours.map(function (j, i) {
      return '<a class="prevision" href="#/meteo/' + j.date + '">' +
        '<span class="pj">' + esc(nomJour(j.jour, i)) + '</span>' +
        '<span class="pc" title="' + esc(j.ciel) + '">' + (j.icone || '') + '</span>' +
        '<span class="pt"><b class="' + (j.gel ? 'froid' : '') + '">' + Math.round(j.tmin) + '°</b> / <b class="' + (j.chaleur ? 'chaud' : '') + '">' + Math.round(j.tmax) + '°</b></span>' +
        '<span class="pp">' + (j.pluie >= 0.5 ? '💧 ' + (Math.round(j.pluie * 10) / 10) + '\u00a0mm' : (j.probaPluie != null ? '<span class="petit">' + j.probaPluie + ' %</span>' : '—')) + '</span>' +
        '<span class="pv">' + (j.rafales != null ? '💨 ' + Math.round(j.rafales) : '') + '</span>' +
        '<span class="pf">›</span></a>';
    }).join('') + '</div><p class="petit">Températures de la nuit / du jour · pluie en mm (ou risque de pluie en %) · rafales en km/h.</p></section>';
    h += blocSoleil();
    h += blocTerre();
    h += blocSoif();
    h += blocNormales();
    var tombee = 0, debut = D.iso(D.ajouter(D.jour(maintenant()), -3));
    meteo().jours.forEach(function (j) { if (j.date >= debut && j.date < aujourdhuiISO()) tombee += j.pluie || 0; });
    h += '<section class="carte"><h2>Pluie des 3 derniers jours</h2><p><strong>' + (Math.round(tombee * 10) / 10) + ' mm</strong> tombés. ' +
      (tombee >= 10 ? 'La terre des espaces à ciel ouvert a été bien arrosée.' : tombee >= 3 ? 'Un petit apport, insuffisant pour les bacs.' : 'Presque rien : seuls tes arrosages comptent.') + '</p>' +
      '<p class="petit">' + esc(sourceTexte()) + ' pour ' + esc(p.commune) + ', actualisées toutes les 30 minutes. <button class="lien" data-action="recharger-meteo">Actualiser</button></p></section>';
    return h;
  }

  function nomJour(d, i) {
    if (i == null) i = D.ecart(maintenant(), d);
    return i === 0 ? 'Aujourd’hui' : i === 1 ? 'Demain' : capitale(D.formatJour(d).split(' ')[0]) + ' ' + d.getDate();
  }
  function sourceTexte(iso) {
    var mo = meteo() && meteo().modeles;
    if (!mo || !mo.meteoFrance) return 'Prévisions Open-Meteo (modèle global)';
    if (iso && !mo.joursMF[iso]) return 'Prévisions Open-Meteo, modèle global (Météo-France ne prévoit pas si loin)';
    return 'Prévisions Météo-France (modèles AROME / ARPEGE) via Open-Meteo';
  }
  function fiabilite(i) {
    return i <= 1 ? 'Prévision très fiable' : i <= 3 ? 'Prévision fiable' : 'Tendance : à reconfirmer dans les prochains jours';
  }
  /** Prochaines 48 h : pluie heure par heure et nuits froides */
  function bloc48h() {
    var m = meteo(), now = maintenant(), eps = M.episodesPluie(m, now, 48), ns = M.nuits(m, now, 2), l = [];
    if (eps.length) eps.forEach(function (e) { l.push('<li>🌧️ ' + esc(e.texte) + '</li>'); });
    else l.push('<li>☂️ Pas de pluie notable prévue dans les 48 heures.</li>');
    ns.forEach(function (n) {
      l.push('<li>' + (n.min <= 0 ? '🥶' : n.min <= 3 ? '❄️' : '🌙') + ' ' + capitale(n.nom) + ' : minimum <strong>' + Math.round(n.min) + ' °C</strong> vers ' + n.heureMin.getHours() + ' h' +
        (n.heuresGel ? ', gel de ' + n.debutGel.getHours() + ' h à ' + n.finGel.getHours() + ' h' : n.min <= 3 ? (n.claire ? ', ciel dégagé : gelée blanche possible au sol' : ', frais') : '') + '</li>');
    });
    return '<section class="carte" data-test="48h"><h2>Les prochaines 48 heures</h2><ul class="jardin-jour">' + l.join('') + '</ul></section>';
  }
  /** Eau dans chaque bac / parcelle avec une décision claire */
  function blocEauBacs() {
    var lignes = S.etat.espaces.map(function (e) { return etatArrosage(e); }).filter(function (a) { return a.decision; }).map(function (a) {
      return '<div class="eau-bac"><p><strong>' + esc(a.espace.nom) + '</strong> <span class="petit">' + (a.espace.pluie === 'abri' ? 'sous abri' : 'à ciel ouvert') + '</span></p>' + verdictBloc(a) +
        (a.decision.verdict !== 'attendre' ? '<p class="petit">' + esc(a.decision.texte) + '</p>' : '') + '</div>';
    });
    if (!lignes.length) return '';
    return '<section class="carte" data-test="eau-bacs"><h2>💧 Faut-il arroser ?</h2>' + lignes.join('') + '<a class="lien-meteo" href="#/arrosage">Noter un arrosage</a></section>';
  }

  /* ---------- Graphiques (SVG, survol / toucher = info-bulle) ---------- */
  function n1(x) { return String(Math.round(x * 10) / 10).replace('.', ','); }
  function graphe(svg, aria) {
    return '<div class="graphe" role="img" aria-label="' + esc(aria) + '">' + svg + '<div class="bulle" hidden></div></div>';
  }
  /** Courbe des températures d'une journée */
  function courbeTemperatures(heures, iso) {
    var pts = heures.filter(function (x) { return x.temp != null; });
    if (pts.length < 12) return '';
    var W = 340, H = 150, L = 30, R = 10, T = 18, B = 22;
    var ts = pts.map(function (x) { return x.temp; }), mn = Math.min.apply(null, ts), mx = Math.max.apply(null, ts);
    var bas = Math.floor(Math.min(mn, mn <= 4 ? 0 : mn) - 1), haut = Math.ceil(mx + 1);
    var X = function (hr) { return L + (W - L - R) * hr / 23; }, Y = function (t) { return T + (H - T - B) * (haut - t) / (haut - bas); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="svg-graphe">';
    [bas, Math.round((bas + haut) / 2), haut].forEach(function (g) { svg += '<line class="grille" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(g) + '" y2="' + Y(g) + '"/><text class="axe" x="' + (L - 4) + '" y="' + (Y(g) + 4) + '" text-anchor="end">' + g + '°</text>'; });
    if (bas < 0 && haut > 0) svg += '<line class="ligne-gel" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/><text class="axe gel-txt" x="' + (W - R) + '" y="' + (Y(0) - 4) + '" text-anchor="end">gel</text>';
    [0, 6, 12, 18, 23].forEach(function (hr) { svg += '<text class="axe" x="' + X(hr) + '" y="' + (H - 6) + '" text-anchor="middle">' + hr + ' h</text>'; });
    var now = maintenant();
    if (D.iso(now) === iso) svg += '<line class="maintenant" x1="' + X(now.getHours() + now.getMinutes() / 60) + '" x2="' + X(now.getHours() + now.getMinutes() / 60) + '" y1="' + T + '" y2="' + (H - B) + '"/>';
    svg += '<path class="trait-temp" d="' + pts.map(function (x, i) { return (i ? 'L' : 'M') + X(x.date.getHours()).toFixed(1) + ' ' + Y(x.temp).toFixed(1); }).join('') + '"/>';
    var imin = ts.indexOf(mn), imax = ts.indexOf(mx);
    [[imin, mn, 14], [imax, mx, -8]].forEach(function (e) {
      var x = X(pts[e[0]].date.getHours()), y = Y(e[1]);
      svg += '<circle class="point-temp" cx="' + x + '" cy="' + y + '" r="4"/><text class="etiquette" x="' + Math.min(W - R - 12, Math.max(L + 12, x)) + '" y="' + (y + e[2]) + '" text-anchor="middle">' + Math.round(e[1]) + '°</text>';
    });
    var larg = (W - L - R) / 23;
    pts.forEach(function (x) {
      var hr = x.date.getHours();
      svg += '<rect class="cible" x="' + (X(hr) - larg / 2) + '" y="' + T + '" width="' + larg + '" height="' + (H - T - B) + '" data-tip="' + esc(hr + ' h : ' + n1(x.temp) + ' °C' + (x.pluie >= 0.1 ? ' · pluie ' + n1(x.pluie) + ' mm' : '') + (x.vent != null ? ' · vent ' + Math.round(x.vent) + ' km/h' : '')) + '"/>';
    });
    return graphe(svg + '</svg>', 'Courbe des températures : minimum ' + Math.round(mn) + ' °C, maximum ' + Math.round(mx) + ' °C');
  }
  /** Pluie tombée (barres) et eau évaporée (ligne), 30 derniers jours */
  function grapheSoif(s) {
    var js = s.jours, n = js.length, W = 340, H = 160, L = 30, R = 10, T = 12, B = 22;
    var mx = Math.max(2, Math.max.apply(null, js.map(function (j) { return Math.max(j.pluie, j.et0); })));
    var haut = Math.ceil(mx / 5) * 5, pas = (W - L - R) / n;
    var X = function (i) { return L + pas * (i + 0.5); }, Y = function (v) { return T + (H - T - B) * (1 - v / haut); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="svg-graphe">';
    [0, haut / 2, haut].forEach(function (g) { svg += '<line class="grille" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(g) + '" y2="' + Y(g) + '"/><text class="axe" x="' + (L - 4) + '" y="' + (Y(g) + 4) + '" text-anchor="end">' + n1(g) + '</text>'; });
    svg += '<text class="axe" x="' + (L - 4) + '" y="' + (T - 2) + '" text-anchor="end">mm</text>';
    var lb = Math.max(1, pas - 2);
    js.forEach(function (j, i) {
      if (j.pluie < 0.05) return;
      var x = X(i) - lb / 2, y = Y(j.pluie), h0 = Y(0) - y, r = Math.min(2, lb / 2, h0);
      svg += '<path class="barre-pluie" d="M' + x + ' ' + Y(0) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + lb - r) + 'Q' + (x + lb) + ' ' + y + ' ' + (x + lb) + ' ' + (y + r) + 'V' + Y(0) + 'Z"/>';
    });
    svg += '<path class="trait-evap" d="' + js.map(function (j, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(j.et0).toFixed(1); }).join('') + '"/>';
    [0, Math.floor(n / 2), n - 1].forEach(function (i) { svg += '<text class="axe" x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '">' + esc(D.format(D.lire(js[i].date))) + '</text>'; });
    js.forEach(function (j, i) { svg += '<rect class="cible" x="' + (X(i) - pas / 2) + '" y="' + T + '" width="' + pas + '" height="' + (H - T - B) + '" data-tip="' + esc(capitale(D.formatJour(D.lire(j.date))) + ' · pluie ' + n1(j.pluie) + ' mm · évaporation ' + n1(j.et0) + ' mm') + '"/>'; });
    return '<p class="legende-graphe"><span><i class="pastille pluie"></i>Pluie tombée</span><span><i class="pastille evap"></i>Eau évaporée</span></p>' +
      graphe(svg + '</svg>', 'Pluie tombée et eau évaporée chaque jour sur 30 jours');
  }
  document.addEventListener('pointerover', bulle);
  document.addEventListener('pointerdown', bulle);
  function bulle(ev) {
    var c = ev.target.closest && ev.target.closest('.graphe .cible');
    document.querySelectorAll('.graphe .cible.actif').forEach(function (x) { if (x !== c) x.classList.remove('actif'); });
    document.querySelectorAll('.graphe .bulle').forEach(function (b) { if (!c || !b.parentNode.contains(c)) b.hidden = true; });
    if (!c) return;
    var g = c.closest('.graphe'), b = g.querySelector('.bulle'), r = c.getBoundingClientRect(), rg = g.getBoundingClientRect();
    c.classList.add('actif'); b.textContent = c.getAttribute('data-tip'); b.hidden = false;
    var x = r.left + r.width / 2 - rg.left, w = b.offsetWidth;
    b.style.left = Math.max(0, Math.min(rg.width - w, x - w / 2)) + 'px';
  }

  /* ---------- Météo : blocs supplémentaires ---------- */
  function blocPluieHeure() {
    var p = M.pluieProchaine(meteo(), maintenant());
    if (!p) return '';
    var mx = Math.max(0.5, Math.max.apply(null, p.quarts.map(function (q) { return q.pluie; })));
    return '<section class="carte" data-test="pluie-heure"><h2>☔ Dans les 2 prochaines heures</h2><p>' + esc(p.texte) + '</p>' +
      '<div class="quarts" aria-hidden="true">' + p.quarts.map(function (q) {
        var hh = q.date.getHours() + 'h' + (q.date.getMinutes() ? String(q.date.getMinutes()).padStart(2, '0') : '');
        return '<div class="quart" title="' + esc(hh + ' : ' + n1(q.pluie) + ' mm') + '"><i style="height:' + (q.pluie >= 0.05 ? Math.max(8, 100 * q.pluie / mx) : 0) + '%"></i><span>' + (q.date.getMinutes() === 0 ? q.date.getHours() + ' h' : '') + '</span></div>';
      }).join('') + '</div><p class="petit">Prévision Météo-France au quart d’heure (modèle AROME).</p></section>';
  }
  function blocCreneaux() {
    var cs = M.creneaux(meteo(), maintenant());
    if (!cs.length) return '';
    return '<section class="carte" data-test="creneaux"><h2>🗓️ Les bons moments cette semaine</h2>' + cs.map(function (c) {
      return '<div class="creneau' + (c.debut ? '' : ' aucun') + '"><p>' + c.icone + ' <strong>' + esc(c.titre) + '</strong></p><p class="creneau-quand">' + esc(c.texte) + '</p><p class="petit">Il faut : ' + esc(c.pourquoi) + '.</p></div>';
    }).join('') + '<p class="petit">Le premier créneau favorable des 7 prochains jours, calculé heure par heure.</p></section>';
  }
  function blocSoleil() {
    var js = M.previsions(meteo(), maintenant(), 7).filter(function (j) { return j.soleil != null || j.uv != null; });
    if (!js.length) return '';
    var mxUv = js.reduce(function (a, j) { return j.uv != null && (!a || j.uv > a.uv) ? j : a; }, null);
    var niv = mxUv && M.niveauUV(mxUv.uv);
    return '<section class="carte" data-test="soleil"><h2>☀️ Soleil et UV</h2><div class="soleil-liste">' + js.map(function (j, i) {
      var u = M.niveauUV(j.uv), pc = j.jour && j.soleil != null && j.jour > 0 ? Math.round(100 * j.soleil / j.jour) : null;
      return '<div class="soleil-jour"><span>' + esc(nomJour(j.jour, i)) + '</span><span class="soleil-barre"><i style="width:' + (pc || 0) + '%"></i></span><span>' + (j.soleil != null ? n1(j.soleil) + ' h' : '—') + '</span><span class="uv uv-' + (u ? u.niveau : '') + '">' + (j.uv != null ? 'UV ' + Math.round(j.uv) : '') + '</span></div>';
    }).join('') + '</div><p class="petit">Heures de soleil sur la durée du jour · indice UV maximal.</p>' +
      (niv && niv.conseil ? '<p>' + esc(niv.texte + ' ' + nomJour(mxUv.jour).toLowerCase() + ' : ' + niv.conseil) + '</p>' : '<p class="petit">UV faibles cette semaine : pas de précaution particulière.</p>') + '</section>';
  }
  function blocTerre() {
    var t = M.temperatureSol(meteo(), maintenant());
    if (!t) return '';
    var now = maintenant(), possible = [], bientot = [], froid = [], vus = {};
    t.cultures.forEach(function (x) {
      var g = x.geste === 'plantation' ? 'plantation' : 'semis_place';
      var saison = (x.culture.demarrage[g] && M.conseilGeste(x.culture, g, now, zoneId(), meteo()).niveau >= 1);
      if (!saison) return;
      var nom = x.culture.emoji + ' ' + x.culture.nom + (x.geste === 'plantation' ? ' (plants)' : '');
      if (vus[nom]) return; vus[nom] = 1;
      if (x.ok) possible.push(nom);
      else if (x.date) bientot.push(nom + ' : ' + x.min + ' °C, vers ' + M.dates.quand(x.date, now).replace(/ (matin|après-midi|soir)$/, ''));
      else froid.push(nom + ' : ' + x.min + ' °C');
    });
    var tend = t.tendance >= 1 ? '↗ elle se réchauffe (' + n1(t.jours[t.jours.length - 1].moyenne) + ' °C dans ' + (t.jours.length - 1) + ' jours)' : t.tendance <= -1 ? '↘ elle se refroidit (' + n1(t.jours[t.jours.length - 1].moyenne) + ' °C dans ' + (t.jours.length - 1) + ' jours)' : 'stable cette semaine';
    var h = '<section class="carte" data-test="terre"><h2>🌡️ Température de la terre</h2><p class="jour-grand">' + n1(t.actuel) + ' °C <span class="petit">à 6 cm de profondeur, ' + esc(tend) + '</span></p>';
    if (t.gele) h += '<p><strong>Terre gelée :</strong> ne sème et ne plante rien, ne marche pas sur les planches.</p>';
    h += possible.length ? '<p><strong>Terre assez chaude pour :</strong> ' + esc(possible.join(', ')) + '.</p>' : '';
    h += bientot.length ? '<p><strong>Bientôt :</strong> ' + esc(bientot.join(' ; ')) + '.</p>' : '';
    h += froid.length ? '<p><strong>Encore trop froide pour :</strong> ' + esc(froid.join(' ; ')) + '.</p>' : '';
    if (!possible.length && !bientot.length && !froid.length) h += '<p>Ce n’est pas la saison des semis dehors : la température de la terre comptera à nouveau au printemps.</p>';
    h += '<details><summary>Température de terre minimale pour chaque culture</summary><ul>' + t.cultures.map(function (x) { return '<li>' + x.culture.emoji + ' ' + esc(x.culture.nom) + (x.geste === 'plantation' ? ' (plantation)' : ' (semis)') + ' : ' + x.min + ' °C</li>'; }).join('') + '</ul></details>';
    h += '<p class="petit">Les graines ne germent pas (ou pourrissent) dans une terre trop froide, même si l’air est doux.</p></section>';
    return h;
  }
  function blocSoif() {
    var s = M.soif(meteo().passe, maintenant());
    if (!s) return '';
    var icone = s.verdict === 'sec' ? '🏜️' : s.verdict === 'humide' ? '💦' : '⚖️';
    return '<section class="carte" data-test="soif"><h2>🥤 Le jardin a-t-il eu soif ?</h2>' +
      '<p class="jour-grand">' + icone + ' <span class="soif-chiffres">' + Math.round(s.pluie) + ' mm tombés · ' + Math.round(s.et0) + ' mm évaporés</span></p>' +
      '<p>' + esc(s.texte) + '</p>' + grapheSoif(s) +
      '<p class="petit">7 derniers jours : ' + n1(s.semaine.pluie) + ' mm de pluie pour ' + n1(s.semaine.et0) + ' mm évaporés. L’évaporation est celle d’un gazon bien arrosé : les bacs perdent un peu plus, un sol paillé un peu moins.</p>' +
      '<details><summary>Voir les chiffres jour par jour</summary><table class="tableau"><thead><tr><th>Jour</th><th>Pluie</th><th>Évaporation</th></tr></thead><tbody>' +
      s.jours.slice().reverse().map(function (j) { return '<tr><td>' + esc(D.format(D.lire(j.date))) + '</td><td>' + n1(j.pluie) + ' mm</td><td>' + n1(j.et0) + ' mm</td></tr>'; }).join('') + '</tbody></table></details></section>';
  }
  function blocNormales() {
    var c = M.comparaisonNormale(meteo(), normalesEtat, maintenant());
    if (!c) return normalesEtat === undefined ? '<section class="carte" data-test="normales"><h2>📊 Par rapport à d’habitude</h2><p class="petit">Calcul des normales de ta commune (10 ans d’historique)…</p></section>' : '';
    var ic = c.ecart >= 1 ? '🔺' : c.ecart <= -1 ? '🔻' : '🟰';
    return '<section class="carte" data-test="normales"><h2>📊 Par rapport à d’habitude</h2><p>' + ic + ' ' + esc(c.texte) + '</p>' +
      '<p class="petit">Normales de saison chez toi : ' + Math.round(c.normaleTmin) + ' °C la nuit, ' + Math.round(c.normaleTmax) + ' °C le jour (moyenne des 10 dernières années).</p>' +
      (c.conseil ? '<p>' + esc(c.conseil) + '</p>' : '') + (c.textePluie ? '<p>💧 ' + esc(c.textePluie) + '</p>' : '') + '</section>';
  }

  /** Détail d'un jour : heure par heure */
  function ecranMeteoJour(iso) {
    var h = entete('Météo du jardin', '#/meteo');
    var m = meteo();
    if (!m) return h + bandeauMeteo();
    var j = m.jours.filter(function (x) { return x.date === iso; })[0];
    if (!j) return h + '<section class="carte"><p>Pas de prévision pour ce jour.</p></section>';
    var d = D.lire(iso), i = D.ecart(maintenant(), d), c = M.ciel(j.code), now = maintenant();
    var heures = M.heuresDuJour(m, iso);
    var hsSol = heures.filter(function (x) { return x.sol != null; }), solJour = hsSol.length >= 12 ? hsSol.reduce(function (a, x) { return a + x.sol; }, 0) / hsSol.length : null;
    var uvj = M.niveauUV(j.uv);
    var idx = m.jours.indexOf(j), prec = m.jours[idx - 1], suiv = m.jours[idx + 1];
    var debut = D.iso(D.jour(now));
    h += '<nav class="jour-nav">' + (prec && prec.date >= debut ? '<a href="#/meteo/' + prec.date + '">‹ ' + esc(nomJour(D.lire(prec.date))) + '</a>' : '<span></span>') +
      '<strong data-test="jour-titre">' + (i === 0 ? 'Aujourd’hui · ' : i === 1 ? 'Demain · ' : '') + esc(capitale(D.formatJour(d))) + '</strong>' +
      (suiv && D.ecart(now, D.lire(suiv.date)) <= 7 ? '<a href="#/meteo/' + suiv.date + '">' + esc(nomJour(D.lire(suiv.date))) + ' ›</a>' : '<span></span>') + '</nav>';
    h += '<section class="carte" data-test="jour-resume"><p class="jour-grand">' + (c.icone || '') + ' <b class="froid">' + Math.round(j.tmin) + '°</b> / <b class="chaud">' + Math.round(j.tmax) + '°</b> <span class="petit">' + esc(c.texte) + '</span></p>' +
      '<ul class="jardin-jour">' +
      '<li>💧 Pluie : <strong>' + (Math.round((j.pluie || 0) * 10) / 10) + ' mm</strong>' + (j.probaPluie != null ? ' · risque ' + j.probaPluie + ' %' : '') + '</li>' +
      (j.rafales != null ? '<li>💨 Rafales jusqu’à ' + Math.round(j.rafales) + ' km/h</li>' : '') +
      (j.soleil != null ? '<li>🌞 Soleil : ' + n1(j.soleil) + ' h' + (j.jour ? ' sur ' + n1(j.jour) + ' h de jour' : '') + (j.uv != null ? ' · ' + esc(M.niveauUV(j.uv).texte) + ' (' + Math.round(j.uv) + ')' : '') + '</li>' : '') +
      (solJour != null ? '<li>🌡️ Terre à 6 cm : ' + n1(solJour) + ' °C en moyenne</li>' : '') +
      (j.et0 != null ? '<li>♨️ Évaporation : ' + (Math.round(j.et0 * 10) / 10) + ' mm d’eau perdus par la terre et les plantes' + (j.et0 >= 5 ? ' (forte : la terre sèche vite)' : j.et0 <= 1.5 ? ' (faible)' : '') + '</li>' : '') +
      '</ul>' + (uvj && uvj.conseil ? '<p class="petit">☀️ ' + esc(uvj.conseil) + '</p>' : '') + '<p class="petit">' + esc(fiabilite(i)) + ' · ' + esc(sourceTexte(iso)) + '.</p></section>';
    var al = alertesCourantes().filter(function (a) { return a.date === iso; });
    if (al.length) h += '<section class="carte alerte"><h2>Pour le jardin ce jour-là</h2>' + al.map(carteAlerte).join('') + '</section>';
    var minuit = new Date(d.getTime()); minuit.setHours(0, 0, 0, 0);
    var eps = M.episodesPluie(m, minuit, 24).filter(function (e) { return D.iso(e.debut) === iso; });
    if (eps.length) h += '<section class="carte"><h2>Quand va-t-il pleuvoir ?</h2><ul class="jardin-jour">' + eps.map(function (e) { return '<li>🌧️ De ' + e.debut.getHours() + ' h à ' + e.fin.getHours() + ' h : ' + (Math.round(e.total * 10) / 10) + ' mm' + (e.probaMax ? ' (' + e.probaMax + ' % de risque)' : '') + '</li>'; }).join('') + '</ul></section>';
    if (heures.length) {
      h += '<section class="carte"><h2>Températures de la journée</h2>' + courbeTemperatures(heures, iso) + '<p class="petit">Touche la courbe pour lire chaque heure.</p></section>';
      h += '<section class="carte"><h2>Heure par heure</h2><div class="heures" data-test="heures"><div class="heure entete-h"><span>Heure</span><span></span><span>Temp.</span><span>Pluie</span><span>Vent</span><span>Humid.</span></div>' + heures.map(function (x) {
        var passe = x.date.getTime() + 3600000 <= now.getTime();
        return '<div class="heure' + (passe ? ' passe' : '') + (x.temp != null && x.temp <= 0 ? ' gel' : '') + '">' +
          '<span class="hh">' + x.date.getHours() + ' h</span>' +
          '<span class="hc" title="' + esc(x.texte) + '">' + (x.icone || '') + '</span>' +
          '<span class="ht">' + (x.temp != null ? '<b class="' + (x.temp <= 0 ? 'froid' : x.temp >= 30 ? 'chaud' : '') + '">' + Math.round(x.temp) + '°</b>' : '—') + '</span>' +
          '<span class="hp">' + (x.pluie >= 0.1 ? (Math.round(x.pluie * 10) / 10) + ' mm' : '') + (x.proba != null && x.proba >= 20 ? ' <span class="petit">' + x.proba + ' %</span>' : (x.pluie >= 0.1 ? '' : '<span class="petit">—</span>')) + '</span>' +
          '<span class="hv">' + (x.vent != null ? Math.round(x.vent) + (x.rafales != null && x.rafales >= 40 ? ' <span class="petit">(' + Math.round(x.rafales) + ')</span>' : '') : '') + '</span>' +
          '<span class="hu">' + (x.humidite != null ? x.humidite + ' %' : '') + '</span></div>';
      }).join('') + '</div><p class="petit">Vent moyen en km/h (rafales entre parenthèses quand elles sont fortes) · humidité de l’air.</p></section>';
    }
    return h;
  }

  function ecranIntrouvable() { return entete('Page introuvable', '#/') + '<p class="carte">Cet élément n’existe plus.</p>'; }

  /* ---------- Routeur ---------- */
  function analyser() {
    var brut = (route || '#/').slice(1), q = {}, i = brut.indexOf('?');
    if (i >= 0) { brut.slice(i + 1).split('&').forEach(function (kv) { var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); }); brut = brut.slice(0, i); }
    return { parties: brut.split('/').filter(Boolean), q: q };
  }
  function rendre() {
    var r = analyser(), p = r.parties, h, onglet = 'accueil';
    if (!p.length) h = ecranAccueil();
    else if (p[0] === 'envie') { h = ecranEnvie(); onglet = 'planter'; }
    else if (p[0] === 'culture') { h = ecranCulture(p[1]); onglet = 'planter'; }
    else if (p[0] === 'suggestions') { h = ecranSuggestions(r.q); onglet = 'planter'; }
    else if (p[0] === 'demarrer') { h = ecranDemarrer(p[1], p[2], r.q); onglet = 'planter'; }
    else if (p[0] === 'suivi') { h = ecranSuivi(p[1]); onglet = 'potager'; }
    else if (p[0] === 'arrosage') { h = ecranArrosage(); onglet = 'arrosage'; }
    else if (p[0] === 'meteo' && p[1]) { h = ecranMeteoJour(p[1]); onglet = 'meteo'; }
    else if (p[0] === 'meteo') { h = ecranMeteo(); onglet = 'meteo'; }
    else if (p[0] === 'problemes') { h = ecranProblemes(r.q); onglet = 'planter'; }
    else if (p[0] === 'potager') { h = ecranPotager(); onglet = 'potager'; }
    else if (p[0] === 'espace' && p[1] === 'nouveau') { h = ecranEspaceForm(null, r.q); onglet = 'potager'; }
    else if (p[0] === 'espace' && p[2] === 'modifier') { h = ecranEspaceForm(p[1], r.q); onglet = 'potager'; }
    else if (p[0] === 'espace') { h = ecranEspace(p[1]); onglet = 'potager'; }
    else h = ecranIntrouvable();
    app.innerHTML = h;
    document.querySelectorAll('.nav a').forEach(function (a) { a.classList.toggle('actif', a.getAttribute('data-onglet') === onglet); });
  }

  /* ---------- Actions ---------- */
  function flash(msg) {
    var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('visible');
    clearTimeout(flash.t); flash.t = setTimeout(function () { t.classList.remove('visible'); }, 2500);
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-action]'); if (!b || b.tagName === 'SELECT') return;
    var a = b.getAttribute('data-action'), id = b.getAttribute('data-id');
    if (a === 'arroser') { S.arroser([id]); flash('Arrosage noté pour « ' + nomEspace(id) + ' » à ' + heure(new Date())); rendre(); }
    else if (a === 'humide') { S.terreHumide(id); flash('Noté : vérification reportée'); rendre(); }
    else if (a === 'premiere-recolte') { S.modifierPlantation(id, { premiereRecolte: aujourdhuiISO() }); flash('Bravo, première récolte notée !'); rendre(); }
    else if (a === 'recolte-unique') { S.modifierPlantation(id, { premiereRecolte: aujourdhuiISO(), terminee: aujourdhuiISO() }); flash('Récolte notée, l’espace est libéré'); rendre(); window.scrollTo(0, 0); }
    else if (a === 'terminer') { confirmer(b, function () { S.modifierPlantation(id, { terminee: aujourdhuiISO() }); flash('Culture terminée : l’espace est libéré'); rendre(); window.scrollTo(0, 0); }); }
    else if (a === 'annuler-obs') { S.annulerObservation(id, b.getAttribute('data-etape')); rendre(); }
    else if (a === 'modifier-date') { var f = document.querySelector('[data-form="date-depart"]'); if (f) f.classList.toggle('cache'); }
    else if (a === 'supprimer-plantation') { confirmer(b, function () { S.supprimerPlantation(id); aller('#/potager'); }); }
    else if (a === 'supprimer-espace') { confirmer(b, function () { S.supprimerEspace(id); aller('#/potager'); }); }
    else if (a === 'tout-effacer') { confirmer(b, function () { S.toutEffacer(); aller('#/'); }); }
    else if (a === 'recharger-meteo') { chargerMeteo(true); }
    else if (a === 'rappels') {
      var ev = genererRappels((b.getAttribute('data-ids') || '').split(',').filter(Boolean), b.getAttribute('data-arrosage') === '1');
      if (!ev.length) { flash('Aucun rappel à venir pour l’instant'); return; }
      window.dernierIcs = M.ics(ev, maintenant());
      flash(telecharger('potager-rappels.ics', window.dernierIcs, 'text/calendar') ? ev.length + ' rappel' + (ev.length > 1 ? 's' : '') + ' : ouvre le fichier pour l’ajouter à ton agenda' : 'Impossible de créer le fichier sur cet appareil');
    }
    else if (a === 'choisir-commune') {
      var c = JSON.parse(b.getAttribute('data-commune'));
      choisirCommune(c);
    }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.matches('[data-action="choisir-espace"]')) aller('#/suggestions?espace=' + t.value);
    else if (t.matches('[data-action="choisir-zone"]')) { S.definirProfil({ zone: t.value, zoneManuelle: t.value !== 'local' }); flash('Climat mis à jour'); rendre(); }
    else if (t.matches('[data-form="demarrer"] select[name="espace"]')) {
      var f = t.form, c = M.culture(f.getAttribute('data-culture')), e = S.espace(t.value), cap = M.capacite(c, e, S.actives(e.id));
      f.querySelector('input[name="quantite"]').value = Math.max(1, cap.libre || 1);
      f.querySelector('p.petit').textContent = 'Place disponible estimée dans « ' + e.nom + ' » : ' + cap.libre + ' ' + unite(cap.libre, c.unite) + '.';
    }
  });
  document.addEventListener('submit', function (ev) {
    var f = ev.target, type = f.getAttribute('data-form'); if (!type) return;
    ev.preventDefault();
    var fd = new FormData(f);
    if (type === 'demarrer') {
      var p = S.ajouterPlantation({ cultureId: f.getAttribute('data-culture'), mode: fd.get('mode'), date: fd.get('date') || aujourdhuiISO(), espaceId: fd.get('espace'), varieteId: fd.get('variete') || null, quantite: +fd.get('quantite') || null });
      flash('Enregistré !'); aller('#/suivi/' + p.id);
    } else if (type === 'observer') {
      S.observer(f.getAttribute('data-id'), f.getAttribute('data-etape'), fd.get('date') || aujourdhuiISO());
      flash('Observation notée : estimations recalées'); rendre();
    } else if (type === 'date-depart') {
      S.modifierPlantation(f.getAttribute('data-id'), { date: fd.get('date') }); flash('Date corrigée'); rendre();
    } else if (type === 'arroser-plusieurs') {
      var ids = fd.getAll('espaces');
      if (!ids.length) { flash('Coche au moins un espace'); return; }
      S.arroser(ids); flash('Arrosage noté pour ' + ids.length + ' espace' + (ids.length > 1 ? 's' : '')); rendre();
    } else if (type === 'espace') {
      var champs = { nom: fd.get('nom').trim(), type: fd.get('type'), longueur: +fd.get('longueur'), largeur: +fd.get('largeur'), profondeur: fd.get('type') === 'bac' ? (+fd.get('profondeur') || null) : null, soleil: fd.get('soleil'), pluie: fd.get('pluie'), orientation: fd.get('orientation') || null, sol: fd.get('sol') || null };
      var idE = f.getAttribute('data-id');
      if (idE) { S.modifierEspace(idE, champs); aller('#/espace/' + idE); }
      else { var e = S.ajouterEspace(champs); var ret = f.getAttribute('data-retour'); aller(ret || '#/espace/' + e.id); }
      flash('Espace enregistré');
    } else if (type === 'chercher-commune') {
      var zoneRes = document.getElementById('resultats-commune');
      zoneRes.innerHTML = '<p class="petit">Recherche…</p>';
      window.Meteo.chercherCommune(fd.get('q')).then(function (liste) {
        if (!liste.length) { zoneRes.innerHTML = '<p class="petit">Aucune commune trouvée.</p>'; return; }
        zoneRes.innerHTML = liste.map(function (c) { return '<button type="button" class="ligne choix" data-action="choisir-commune" data-commune="' + esc(JSON.stringify(c)) + '">' + esc(c.nom) + ' <span class="petit">' + esc(c.codePostal || '') + ' ' + esc(c.departement || '') + '</span></button>'; }).join('');
      }).catch(function () {
        var dep = window.DEPARTEMENTS && window.DEPARTEMENTS.depuisCodePostal(fd.get('q'));
        if (dep) {
          S.definirProfil({ commune: 'Code postal ' + fd.get('q').trim(), codePostal: fd.get('q').trim(), lat: null, lon: null, altitude: null, zone: dep.zone, zoneAuto: dep.zone });
          flash('Climat déduit du département ' + dep.departement);
          rendre();
        } else {
          zoneRes.innerHTML = '<p class="petit">Recherche de commune impossible ici. Tape plutôt ton code postal (5 chiffres) : le climat sera déduit du département. Tu peux aussi le choisir ci-dessous.</p>';
        }
      });
    }
  });

  function calculerClimatLocal() {
    var p = S.etat.profil;
    if (!p || typeof p.lat !== 'number' || p.climatLocalEssai === p.lat + ',' + p.lon) return;
    window.Meteo.climatLocal(p.lat, p.lon).then(function (cl) {
      var q = S.etat.profil;
      if (!q || q.lat !== p.lat) return;
      if (!cl) return; // réessayé au prochain lancement
      var champs = { climatLocal: cl, climatLocalEssai: p.lat + ',' + p.lon };
      if (!q.zoneManuelle) champs.zone = 'local';
      S.definirProfil(champs);
      window.CLIMATS.definirLocale(cl, q.commune);
      flash('Calendrier calé sur les gelées de ' + q.commune);
      rendre();
    });
  }
  function choisirCommune(c) {
    var fin = function (alt) {
      var z = window.CLIMATS.detecter(c.lat, c.lon, alt);
      window.CLIMATS.definirLocale(null);
      S.definirProfil({ commune: c.nom, codePostal: c.codePostal, departement: /^(\d{2}|2A|2B)$/.test(c.departement || '') ? c.departement : (c.codePostal || '').slice(0, 2), lat: c.lat, lon: c.lon, altitude: alt, zone: z, zoneAuto: z, zoneManuelle: false, climatLocal: null, climatLocalEssai: null });
      calculerClimatLocal();
      flash('Commune enregistrée : climat ' + M.zone(z).nom.toLowerCase());
      chargerMeteo(true);
    };
    if (typeof c.altitude === 'number') fin(c.altitude);
    else window.Meteo.altitude(c.lat, c.lon).then(fin);
  }

  function chargerMeteo(forcer) {
    var p = S.etat.profil;
    if (!p || typeof p.lat !== 'number') { meteoEtat = { etat: 'aucune', meteo: null, message: '' }; rendre(); return; }
    meteoEtat = { etat: 'chargement', meteo: meteoEtat.meteo, message: '' }; rendre();
    window.Meteo.prevision(p.lat, p.lon, forcer).then(function (r) { meteoEtat = r; rendre(); });
    if (normalesEtat === undefined || normalesLieu !== p.lat + ',' + p.lon) {
      normalesLieu = p.lat + ',' + p.lon; normalesEtat = undefined;
      window.Meteo.normales(p.lat, p.lon).then(function (n) { if (normalesLieu === p.lat + ',' + p.lon) { normalesEtat = n; rendre(); } });
    }
  }

  window.addEventListener('hashchange', function () { if (/^#\//.test(location.hash) && location.hash !== route) { route = location.hash; rendre(); window.scrollTo(0, 0); } });
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('a[href^="#/"]');
    if (!a || ev.defaultPrevented || ev.metaKey || ev.ctrlKey) return;
    ev.preventDefault(); aller(a.getAttribute('href'));
  }, true);
  function preparerClimat() {
    var p = S.etat.profil;
    window.CLIMATS.definirLocale(p && p.climatLocal, p && p.commune);
    if (p && p.zone === 'local' && !p.climatLocal) S.definirProfil({ zone: p.zoneAuto || 'tempere' });
    calculerClimatLocal();
  }
  preparerClimat();
  S.surChargement(function () { preparerClimat(); rendre(); chargerMeteo(false); });
  // Les conseils d'arrosage dépendent de l'heure : on rafraîchit l'écran régulièrement.
  setInterval(function () { if (!document.querySelector('input:focus, select:focus')) rendre(); }, 10 * 60 * 1000);
  rendre();
  chargerMeteo(false);
})();

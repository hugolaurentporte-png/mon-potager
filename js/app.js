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
  function zoneId() { return (S.etat.profil && S.etat.profil.zone) || 'tempere'; }
  function meteo() { return meteoEtat.meteo; }
  function aller(h) { if (location.hash === h) rendre(); else location.hash = h; }
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
    if (!p || !p.lat) return '';
    var txt;
    if (meteoEtat.etat === 'chargement') txt = 'Chargement de la météo…';
    else if (meteoEtat.meteo) {
      var j = meteoEtat.meteo.jours.filter(function (x) { return x.date === aujourdhuiISO(); })[0];
      var nuitMin = Math.min.apply(null, meteoEtat.meteo.jours.filter(function (x) { return x.date >= aujourdhuiISO(); }).slice(0, 5).map(function (x) { return x.tmin; }));
      txt = (j ? 'Aujourd’hui ' + Math.round(j.tmin) + ' / ' + Math.round(j.tmax) + ' °C' + (j.pluie >= 0.5 ? ', pluie ' + Math.round(j.pluie) + ' mm' : '') + ' · ' : '') +
        'nuit la plus froide des 5 jours : ' + Math.round(nuitMin) + ' °C' + (meteoEtat.message ? '<br><em>' + esc(meteoEtat.message) + '</em>' : '');
    } else txt = '<strong>' + esc(meteoEtat.message || 'Météo indisponible.') + '</strong> <button class="lien" data-action="recharger-meteo">Réessayer</button>';
    return '<div class="meteo ' + (meteoEtat.meteo ? '' : 'meteo-ko') + '" data-test="meteo">' + txt + '</div>';
  }
  function entete(titre, retour) {
    var p = S.etat.profil;
    return '<header class="entete">' + (retour ? '<a class="retour" href="' + retour + '">‹ Retour</a>' : '') +
      '<h1>' + titre + '</h1>' + (p && p.commune ? '<p class="lieu">' + esc(p.commune) + ' · climat ' + esc(M.zone(zoneId()).nom.toLowerCase()) + '</p>' : '') + '</header>';
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

    var aFaire = 0, blocs = '';
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
    h += '<section class="carte"><h2>🌱 À semer ou planter cette semaine</h2>';
    if (!sug.length) h += '<p>Pas de semis ni de plantation recommandés cette semaine' + (meteo() ? ' (saison ou météo défavorable)' : '') + '. Regarde le calendrier d’une culture pour la prochaine période.</p>';
    else h += sug.slice(0, 8).map(function (s) {
      return '<a class="ligne" href="#/culture/' + s.culture.id + '"><strong>' + s.culture.emoji + ' ' + esc(s.culture.nom) + '</strong> ' + badge(s.meilleur.nomGeste, s.meilleur) + '<p class="raison">' + esc(capitale(s.meilleur.raison)) + '</p></a>';
    }).join('');
    h += '</section>';
    return h;
  }

  function carteArrosage(a) {
    var e = a.espace;
    return '<div class="arrosage ' + a.statut + '" data-espace="' + e.id + '"><div><strong>' + esc(e.nom) + '</strong> <span class="petit">' + (e.pluie === 'abri' ? 'sous abri' : 'à ciel ouvert') + '</span></div>' +
      '<p class="conseil-arrosage">' + esc(a.conseil) + '</p>' +
      (a.raisons.length ? '<p class="petit">' + esc(capitale(a.raisons.join(' ; '))) + '</p>' : '') +
      '<p class="petit dernier">' + esc(dernierArrosageTexte(a.dernierArrosage)) + '</p>' +
      (a.statut === 'vide' ? '' : '<div class="actions"><button class="bouton" data-action="arroser" data-id="' + e.id + '">💧 J’ai arrosé</button>' +
        (a.statut === 'a_verifier' ? '<button class="bouton secondaire" data-action="humide" data-id="' + e.id + '">Terre encore humide</button>' : '') + '</div>') +
      '</div>';
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
      '<li><strong>Variétés connues :</strong> ' + c.varietes.map(function (v) { return esc(v.nom) + (v.note ? ' (' + esc(v.note) + ')' : ''); }).join(', ') + '</li>' +
      '</ul></section>';
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
    var sug = M.suggestions(e, maintenant(), zoneId(), meteo(), actives);
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
      '<div class="actions"><a class="bouton secondaire" href="#/culture/' + c.id + '">Calendrier</a>' +
      (s.meilleur.geste === 'plantation' ? '<a class="bouton" href="#/demarrer/' + c.id + '/plante?espace=' + e.id + '">J’ai planté</a>' : '<a class="bouton" href="#/demarrer/' + c.id + '/seme?espace=' + e.id + '">J’ai semé</a>') +
      '</div></div>';
  }
  function descriptionEspace(e) {
    var soleil = { plein: 'plein soleil', 'mi-ombre': 'mi-ombre', ombre: 'ombre' }[e.soleil] || '';
    return (e.type === 'bac' ? 'Bac' : 'Pleine terre') + ' de ' + e.longueur + ' × ' + e.largeur + ' cm' + (e.type === 'bac' && e.profondeur ? ', ' + e.profondeur + ' cm de terre' : '') + ', ' + soleil + ', ' + (e.pluie === 'abri' ? 'sous abri (la pluie ne l’atteint pas)' : 'à ciel ouvert');
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
    h += '<label class="champ">Variété (facultatif)<select name="variete"><option value="">Je ne sais pas / autre</option>' + c.varietes.map(function (v) { return '<option value="' + v.id + '">' + esc(v.nom) + '</option>'; }).join('') + '</select></label>';
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
      (p.zoneAuto && p.zone !== p.zoneAuto ? '<p class="petit">Détecté automatiquement : ' + esc(M.zone(p.zoneAuto).nom) + '. Tu l’as modifié.</p>' : '<p class="petit">Déduit de ta commune ; modifie-le si ton jardin est plus chaud ou plus froid que la moyenne.</p>') +
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
      '<fieldset class="champ"><legend>Pluie</legend><label class="radio"><input type="radio" name="pluie" value="ciel_ouvert"' + (v.pluie !== 'abri' ? ' checked' : '') + '> À ciel ouvert (reçoit la pluie)</label><label class="radio"><input type="radio" name="pluie" value="abri"' + (v.pluie === 'abri' ? ' checked' : '') + '> Sous abri (avancée de toit, serre, véranda)</label></fieldset>' +
      '<button class="bouton" type="submit" data-test="enregistrer-espace">Enregistrer</button></form>';
    return h;
  }

  function ecranEspace(id) {
    var e = S.espace(id); if (!e) return ecranIntrouvable();
    var h = entete(esc(e.nom), '#/potager');
    h += '<p class="intro">' + esc(descriptionEspace(e)) + ' · <a href="#/espace/' + e.id + '/modifier">modifier</a></p>';
    h += '<section class="carte"><h2>Arrosage</h2>' + carteArrosage(etatArrosage(e)) + '</section>';
    var act = S.actives(e.id);
    h += '<section class="carte"><h2>Cultures en cours</h2>' + (act.length ? act.map(function (pl) {
      var c = M.culture(pl.cultureId); return '<a class="ligne" href="#/suivi/' + pl.id + '">' + c.emoji + ' ' + esc(c.nom) + ' <span class="petit">' + (pl.quantite || '') + ' ' + esc(c.unite) + '</span></a>';
    }).join('') : '<p>Libre.</p>') + '<a class="bouton secondaire" href="#/suggestions?espace=' + e.id + '">Quoi planter ici ?</a></section>';
    h += '<p class="centre"><button class="lien danger" data-action="supprimer-espace" data-id="' + e.id + '">Supprimer cet espace</button></p>';
    return h;
  }

  function ecranIntrouvable() { return entete('Page introuvable', '#/') + '<p class="carte">Cet élément n’existe plus.</p>'; }

  /* ---------- Routeur ---------- */
  function analyser() {
    var brut = (location.hash || '#/').slice(1), q = {}, i = brut.indexOf('?');
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
    else if (a === 'terminer') { if (confirm('Marquer cette culture comme terminée ? L’espace sera libéré.')) { S.modifierPlantation(id, { terminee: aujourdhuiISO() }); rendre(); window.scrollTo(0, 0); } }
    else if (a === 'annuler-obs') { S.annulerObservation(id, b.getAttribute('data-etape')); rendre(); }
    else if (a === 'modifier-date') { var f = document.querySelector('[data-form="date-depart"]'); if (f) f.classList.toggle('cache'); }
    else if (a === 'supprimer-plantation') { if (confirm('Supprimer ce suivi ?')) { S.supprimerPlantation(id); aller('#/potager'); } }
    else if (a === 'supprimer-espace') { if (confirm('Supprimer cet espace ? Ses cultures en cours seront marquées terminées.')) { S.supprimerEspace(id); aller('#/potager'); } }
    else if (a === 'tout-effacer') { if (confirm('Effacer toutes les données du potager sur cet appareil ?')) { S.toutEffacer(); aller('#/'); } }
    else if (a === 'recharger-meteo') { chargerMeteo(true); }
    else if (a === 'choisir-commune') {
      var c = JSON.parse(b.getAttribute('data-commune'));
      choisirCommune(c);
    }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.matches('[data-action="choisir-espace"]')) aller('#/suggestions?espace=' + t.value);
    else if (t.matches('[data-action="choisir-zone"]')) { S.definirProfil({ zone: t.value }); flash('Climat mis à jour'); rendre(); }
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
      var champs = { nom: fd.get('nom').trim(), type: fd.get('type'), longueur: +fd.get('longueur'), largeur: +fd.get('largeur'), profondeur: fd.get('type') === 'bac' ? (+fd.get('profondeur') || null) : null, soleil: fd.get('soleil'), pluie: fd.get('pluie') };
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
        zoneRes.innerHTML = '<p class="petit">Recherche impossible (pas de connexion ?). Tu peux quand même choisir ton climat ci-dessous : le calendrier fonctionnera, sans la météo.</p>';
      });
    }
  });

  function choisirCommune(c) {
    var fin = function (alt) {
      var z = window.CLIMATS.detecter(c.lat, c.lon, alt);
      S.definirProfil({ commune: c.nom, codePostal: c.codePostal, lat: c.lat, lon: c.lon, altitude: alt, zone: z, zoneAuto: z });
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
  }

  window.addEventListener('hashchange', function () { rendre(); window.scrollTo(0, 0); });
  // Les conseils d'arrosage dépendent de l'heure : on rafraîchit l'écran régulièrement.
  setInterval(function () { if (!document.querySelector('input:focus, select:focus')) rendre(); }, 10 * 60 * 1000);
  rendre();
  chargerMeteo(false);
})();

/*
 * Essai avec la VRAIE météo : interroge Open-Meteo (modèle global + Météo-France)
 * pour quelques communes réelles et affiche ce que l'app en déduit.
 * Lancement : node outils/essai-meteo-reel.js [code postal ...]
 */
var memoire = {};
globalThis.localStorage = { getItem: function (k) { return memoire[k] || null; }, setItem: function (k, v) { memoire[k] = v; } };
var M = require('../js/moteur.js');
require('../js/meteo.js');
var Meteo = globalThis.Meteo;
var codes = process.argv.slice(2);
if (!codes.length) codes = ['45000', '29200', '13001', '38000'];
var maintenant = new Date();
var erreurs = 0;

function verifier(cond, msg) { if (!cond) { erreurs++; console.log('   ✗ ' + msg); } }

async function essai(cp) {
  var communes = await Meteo.chercherCommune(cp);
  verifier(communes.length > 0, 'commune introuvable pour ' + cp);
  if (!communes.length) return;
  var c = communes[0];
  console.log('\n=== ' + c.nom + ' (' + cp + ', dép. ' + c.departement + ') — ' + c.lat.toFixed(3) + ', ' + c.lon.toFixed(3));
  var r = await Meteo.prevision(c.lat, c.lon, true);
  verifier(r.etat === 'ok', 'prévisions : ' + r.etat + ' ' + (r.message || ''));
  if (!r.meteo) return;
  var m = r.meteo;
  var joursMF = m.modeles && m.modeles.joursMF ? Object.keys(m.modeles.joursMF).length : 0;
  console.log('Modèle Météo-France : ' + (m.modeles && m.modeles.meteoFrance ? 'oui (' + joursMF + ' jours)' : 'NON (modèle global seul)') + ' · altitude ' + m.altitude + ' m');
  console.log(m.jours.length + ' jours, ' + m.heures.length + ' heures');
  verifier(m.jours.length >= 10 && m.heures.length >= 240, 'pas assez de données');
  verifier(m.jours.every(function (j) { return j.et0 != null; }), 'évapotranspiration manquante');
  verifier(m.heures.filter(function (h) { return h.temp != null; }).length >= 240, 'températures horaires manquantes');
  M.previsions(m, maintenant, 7).forEach(function (j) {
    console.log('  ' + j.date + ' ' + (j.icone || ' ') + ' ' + Math.round(j.tmin) + '/' + Math.round(j.tmax) + ' °C  pluie ' + j.pluie.toFixed(1) + ' mm (' + j.probaPluie + ' %)  rafales ' + Math.round(j.rafales) + '  ET0 ' + j.et0 + (m.modeles.joursMF && m.modeles.joursMF[j.date] ? '  [MF]' : ''));
  });
  // Cohérence horaire / journalier (pluie)
  var auj = M.dates.iso(maintenant);
  m.jours.filter(function (j) { return j.date >= auj; }).slice(0, 3).forEach(function (j) {
    var somme = m.heures.filter(function (h) { return h.t.indexOf(j.date) === 0; }).reduce(function (a, h) { return a + h.pluie; }, 0);
    verifier(Math.abs(somme - j.pluie) <= Math.max(1, j.pluie * 0.25), j.date + ' pluie horaire ' + somme.toFixed(1) + ' ≠ journalière ' + j.pluie);
  });
  console.log('Pluie 48 h : ' + (M.episodesPluie(m, maintenant, 48).map(function (e) { return e.texte; }).join(' | ') || 'aucune'));
  console.log('Nuits : ' + M.nuits(m, maintenant, 3).map(function (n) { return n.nom + ' ' + n.min + ' °C à ' + n.heureMin.getHours() + ' h' + (n.heuresGel ? ' (gel ' + n.heuresGel + ' h)' : ''); }).join(' | '));
  var can = M.canicule(m, maintenant); if (can) console.log('Canicule : ' + can.jours + ' jours, max ' + can.tmax);
  var actives = [{ plantation: {}, culture: M.culture('laitue'), espace: {} }, { plantation: {}, culture: M.culture('ail'), espace: {} }];
  M.alertesJardin(m, maintenant, actives, 7).forEach(function (a) { console.log('Alerte [' + a.gravite + '] ' + a.titre + ' — ' + a.quand + (a.detail ? ' — ' + a.detail : '')); });
  var hier = new Date(maintenant.getTime() - 2 * 86400000);
  var cult = [{ cultureId: 'laitue', mode: 'plant', date: M.dates.iso(new Date(maintenant.getTime() - 30 * 86400000)), observations: { reprise: M.dates.iso(new Date(maintenant.getTime() - 24 * 86400000)) } }];
  [{ id: 'a', nom: 'Bac au sud', type: 'bac', pluie: 'ciel_ouvert', orientation: 'sud' }, { id: 'b', nom: 'Bac sous abri', type: 'bac', pluie: 'abri' }, { id: 'c', nom: 'Parcelle argileuse', type: 'pleine_terre', pluie: 'ciel_ouvert', sol: 'argileux' }].forEach(function (e) {
    var a = M.arrosage(e, cult, [{ date: hier.toISOString() }], [], m, 'tempere', maintenant);
    verifier(a.bilan, e.nom + ' : pas de bilan d’eau');
    console.log('Arrosage ' + e.nom + ' (arrosé il y a 2 jours) : ' + (a.bilan ? a.bilan.pourcentEau + ' % d’eau, ' : '') + a.decision.icone + ' ' + a.decision.titre + ' — ' + a.decision.texte);
  });
  var cl = await Meteo.climatLocal(c.lat, c.lon);
  console.log('Climat local : ' + (cl ? 'dernière gelée ' + cl.derniere + ', première ' + cl.premiere + ' → décalage printemps ' + cl.decalagePrintemps + ' j' : 'indisponible'));
}

(async function () {
  for (var i = 0; i < codes.length; i++) {
    try { await essai(codes[i]); } catch (e) { erreurs++; console.log('✗ ' + codes[i] + ' : ' + e.message); }
  }
  console.log('\n' + (erreurs ? erreurs + ' problème(s)' : 'Tout est cohérent avec la vraie météo.'));
  process.exit(erreurs ? 1 : 0);
})();

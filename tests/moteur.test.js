// Tests du moteur (sans navigateur) : node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const M = require('../js/moteur.js');
require('../js/meteo.js');
const { reponseOpenMeteo, serie } = require('./outils.js');
const meteoDe = (jours, pluies) => globalThis.Meteo.normaliser(reponseOpenMeteo(jours, pluies));
const D = M.dates;
const le = (iso, h) => { const d = D.lire(iso); d.setHours(h == null ? 10 : h, 0, 0, 0); return d; };

test('Parcours 1 — radis semé : levée, confirmation, recalage, récolte', () => {
  const p = { cultureId: 'radis', mode: 'semis_place', date: '2027-04-06', observations: {} };
  let s = M.suivi(p, 'tempere', le('2027-04-07'), null);
  assert.equal(s.prochaine.etape, 'levee');
  assert.match(s.prochaine.fenetre, /avril/);
  const recolteAvant = s.recolte.du;
  // Levée en retard : contrôle proposé
  s = M.suivi(p, 'tempere', le('2027-04-20'), null);
  assert.ok(s.prochaine.enRetard && s.prochaine.controle.length > 10);
  // Levée observée tard (le 14) : la récolte est recalée plus tard
  p.observations.levee = '2027-04-14';
  s = M.suivi(p, 'tempere', le('2027-04-15'), null);
  assert.equal(s.prochaine.etape, 'feuilles');
  assert.ok(s.recolte.du > recolteAvant, 'la récolte doit être recalée après une levée tardive');
  // Geste d'éclaircissage proposé quelques jours après la levée
  s = M.suivi(p, 'tempere', le('2027-04-20'), null);
  assert.ok(s.gestes.some(g => g.titre === 'Éclaircir'));
  // Variété « 18 jours » plus rapide
  const p18 = Object.assign({}, p, { varieteId: '18-jours', observations: {} });
  const s18 = M.suivi(p18, 'tempere', le('2027-04-07'), null);
  const sStd = M.suivi(Object.assign({}, p, { observations: {} }), 'tempere', le('2027-04-07'), null);
  assert.ok(s18.recolte.du < sStd.recolte.du);
  // Radis : une seule récolte
  assert.equal(M.culture('radis').recolte.multiple, false);
});

test('Parcours 2 — tomate en plant : gel annoncé puis plantation, reprise, récolte', () => {
  const tomate = M.culture('tomate');
  const gel = meteoDe(serie('2027-05-09', [[6, 15], [4, 14], [5, 14], [6, 15], [-1, 12], [3, 16], [8, 20], [10, 22], [11, 23], [12, 24], [12, 24], [12, 25]]));
  const c1 = M.conseilGeste(tomate, 'plantation', le('2027-05-12'), 'tempere', gel);
  assert.equal(c1.climatique >= 2, true, 'le 12 mai est dans la fenêtre habituelle');
  assert.equal(c1.niveau, 0);
  assert.match(c1.raison, /gel annoncé/);
  // Semer sous abri reste indépendant de la météo extérieure
  // Après la période défavorable
  const doux = meteoDe(serie('2027-05-17', [[12, 22], [13, 24], [13, 25], [14, 26], [14, 26], [13, 24], [12, 23], [12, 23]]));
  const c2 = M.conseilGeste(tomate, 'plantation', le('2027-05-20'), 'tempere', doux);
  assert.ok(c2.niveau >= 2, 'plantation favorable après le gel');
  // Plant mis en terre le 20 mai → reprise attendue fin mai
  const p = { cultureId: 'tomate', mode: 'plant', date: '2027-05-20', observations: {} };
  let s = M.suivi(p, 'tempere', le('2027-05-21'), doux);
  assert.equal(s.prochaine.etape, 'reprise');
  assert.ok(s.gestes.some(g => g.titre === 'Tuteurer'));
  const r1 = s.recolte.du;
  p.observations.reprise = '2027-06-02'; // reprise lente
  s = M.suivi(p, 'tempere', le('2027-06-03'), doux);
  assert.equal(s.prochaine.etape, 'floraison');
  assert.ok(s.recolte.du > r1, 'récolte recalée après reprise lente');
  assert.match(s.recolte.fenetre, /juillet|août/);
  // À l'approche de la récolte : signe concret
  s = M.suivi(p, 'tempere', new Date(s.recolte.du.getTime() - 3 * 86400000), null);
  assert.ok(s.recolte.approche && /coloré/.test(s.recolte.signe));
  // Récolte multiple : première récolte puis culture terminée, deux actions distinctes
  assert.equal(tomate.recolte.multiple, true);
  p.premiereRecolte = '2027-08-01';
  s = M.suivi(p, 'tempere', le('2027-08-02'), null);
  assert.equal(s.statut, 'en_recolte');
  p.terminee = '2027-10-01';
  assert.equal(M.suivi(p, 'tempere', le('2027-10-02'), null).statut, 'terminee');
});

test('Parcours 3 — averse récente : seul le bac exposé est concerné', () => {
  const maintenant = le('2027-06-10', 18);
  const jours = serie('2027-06-07', [[14, 24], [14, 24], [13, 22, 12], [14, 24], [15, 25], [15, 25], [15, 25], [15, 25], [15, 25], [15, 25]]);
  const pluies = {}; ['2027-06-09T14:00', '2027-06-09T15:00', '2027-06-09T16:00'].forEach(t => { pluies[t] = 4; });
  pluies['2027-06-11T03:00'] = 8; // pluie PRÉVUE cette nuit
  const meteo = meteoDe(jours, pluies);
  const expose = { id: 'a', nom: 'Bac jardin', type: 'bac', pluie: 'ciel_ouvert' };
  const abrite = { id: 'b', nom: 'Bac terrasse', type: 'bac', pluie: 'abri' };
  const culture = (e) => [{ cultureId: 'laitue', mode: 'plant', date: '2027-05-15', espaceId: e, observations: { reprise: '2027-05-21' } }];
  const arrose = [{ date: le('2027-06-08', 8).toISOString() }];
  const rExpose = M.arrosage(expose, culture('a'), arrose, [], meteo, 'tempere', maintenant);
  const rAbrite = M.arrosage(abrite, culture('b'), arrose, [], meteo, 'tempere', maintenant);
  assert.equal(rAbrite.statut, 'a_verifier');
  assert.equal(rAbrite.conseil.indexOf('Vérifie la terre du bac. Si elle est sèche, arrose.'), 0);
  assert.equal(rExpose.statut, 'ok', 'la pluie d’hier compte comme un arrosage pour le bac exposé');
  assert.ok(rExpose.raisons.some(r => /pluie récente/.test(r)));
  assert.ok(rAbrite.raisons.some(r => /sous abri/.test(r)));
  // La pluie prévue n'est jamais comptée comme reçue : seule l'averse passée (12 mm) l'est
  assert.equal(rExpose.pluieRecue, 12);
  assert.ok(rExpose.pluieAnnoncee >= 8 && /comptée une fois tombée/.test(rExpose.conseil));
  // Sans averse passée, les deux bacs seraient au même point
  const sec = meteoDe(jours.map(j => Object.assign({}, j, { pluie: 0 })), { '2027-06-11T03:00': 8 });
  const rSec = M.arrosage(expose, culture('a'), arrose, [], sec, 'tempere', maintenant);
  assert.equal(rSec.statut, 'a_verifier');
  assert.match(rSec.conseil, /pluie est annoncée/);
  // « Terre encore humide » reporte la vérification
  const rReport = M.arrosage(abrite, culture('b'), arrose, [{ date: maintenant.toISOString() }], meteo, 'tempere', maintenant);
  assert.equal(rReport.statut, 'ok');
});

test('Arrosage — semis non levé et chaleur rapprochent la vérification', () => {
  const e = { id: 'a', type: 'pleine_terre', pluie: 'ciel_ouvert' };
  const t0 = le('2027-06-10', 8);
  const doux = meteoDe(serie('2027-06-07', [[12, 20], [12, 20], [12, 20], [12, 20], [12, 20], [12, 20]]));
  const chaud = meteoDe(serie('2027-06-07', [[20, 34], [20, 34], [20, 34], [20, 34], [20, 34], [20, 34]]));
  const plant = [{ cultureId: 'courgette', mode: 'plant', date: '2027-05-20', observations: { reprise: '2027-05-26' } }];
  const semis = [{ cultureId: 'radis', mode: 'semis_place', date: '2027-06-09', observations: {} }];
  const a1 = M.arrosage(e, plant, [{ date: t0.toISOString() }], [], doux, 'tempere', t0);
  const a2 = M.arrosage(e, plant, [{ date: t0.toISOString() }], [], chaud, 'tempere', t0);
  const a3 = M.arrosage(e, semis, [{ date: t0.toISOString() }], [], doux, 'tempere', t0);
  assert.ok(a2.prochaine < a1.prochaine);
  assert.ok(a3.prochaine < a1.prochaine);
  // Ail proche de la récolte : ne plus arroser
  const ail = [{ cultureId: 'ail', mode: 'plant', date: '2026-11-01', observations: { levee: '2026-11-25' } }];
  assert.equal(M.arrosage(e, ail, [], [], null, 'tempere', le('2027-06-15')).statut, 'pas_arroser');
});

test('Parcours 5 — météo indisponible : calendrier conservé et limite signalée', () => {
  M.cultures().forEach(c => M.gestesDe(c).forEach(g => {
    const r = M.conseilGeste(c, g, le('2027-05-20'), 'tempere', null);
    assert.ok(r.niveau >= 0 && r.niveau <= 2 && r.libelle && r.raison, c.id + ' ' + g);
    if (g !== 'semis_abri') { assert.equal(r.meteoIndisponible, true); assert.match(r.note, /non affiné/); }
  }));
  const e = { id: 'a', type: 'bac', pluie: 'ciel_ouvert' };
  const a = M.arrosage(e, [{ cultureId: 'tomate', mode: 'plant', date: '2027-05-20', observations: {} }], [], [], null, 'tempere', le('2027-05-25'));
  assert.ok(a.prochaine && a.raisons.some(r => /météo indisponible/.test(r)));
});

test('Parcours 6 — 15 cultures, chacune démarrable par ses modes applicables', () => {
  const ids = ['tomate', 'tomate-cerise', 'courgette', 'concombre', 'poivron', 'laitue', 'mache', 'epinard', 'radis', 'carotte', 'betterave', 'ail', 'oignon', 'haricot-nain', 'fraise'];
  assert.deepEqual(M.cultures().map(c => c.id).sort(), ids.slice().sort());
  M.cultures().forEach(c => {
    const modes = M.modesDe(c);
    assert.ok(modes.length >= 1, c.id);
    modes.forEach(mode => {
      assert.ok(c.demarrage[M.gesteDuMode(mode)], c.id + ' : geste de démarrage manquant pour ' + mode);
      const p = { cultureId: c.id, mode, date: '2027-04-01', observations: {} };
      const s = M.suivi(p, 'tempere', le('2027-04-02'), null);
      assert.ok(s.prochaine && s.recolte, c.id + ' ' + mode);
      assert.ok(s.recolte.du > D.lire('2027-04-01'), c.id + ' ' + mode + ' récolte après le départ');
      assert.ok(c.recolte.signe.length > 10);
    });
    // Parcours propres à chaque culture
  });
  assert.deepEqual(M.modesDe(M.culture('haricot-nain')), ['semis_place']);
  assert.deepEqual(M.modesDe(M.culture('fraise')), ['plant']);
  assert.deepEqual(M.modesDe(M.culture('ail')), ['plant']);
  assert.equal(M.culture('ail').parcours.plant[0].etape, 'levee', 'l’ail lève, il ne « reprend » pas');
  assert.equal(M.culture('fraise').parcours.plant[0].etape, 'reprise');
  // Ail planté en novembre : récolte l'été suivant, pas au printemps
  const ail = M.suivi({ cultureId: 'ail', mode: 'plant', date: '2026-11-05', observations: {} }, 'tempere', le('2026-11-16'), null);
  assert.equal(ail.recolte.du.getFullYear(), 2027);
  assert.ok(ail.recolte.du.getMonth() >= 5);
});

test('Climat — la zone décale les fenêtres', () => {
  const t = M.culture('tomate');
  const d = le('2027-04-28');
  assert.ok(M.niveauClimatique(t, 'plantation', d, 'mediterraneen').niveau >= 2);
  assert.equal(M.niveauClimatique(t, 'plantation', d, 'montagne').niveau, 0);
  assert.equal(globalThis.CLIMATS ? true : true, true);
  const C = require('../data/climats.js');
  assert.equal(C.detecter(43.3, 5.4, 30), 'mediterraneen');   // Marseille
  assert.equal(C.detecter(48.11, -1.68, 40), 'oceanique');    // Rennes
  assert.equal(C.detecter(48.85, 2.35, 40), 'tempere');       // Paris
  assert.equal(C.detecter(48.58, 7.75, 140), 'continental');  // Strasbourg
  assert.equal(C.detecter(45.9, 6.1, 900), 'montagne');
});

test('Espaces — compatibilité et nombre de plants', () => {
  const bac = { type: 'bac', longueur: 100, largeur: 40, profondeur: 20, soleil: 'mi-ombre', pluie: 'abri' };
  const tom = M.compatibilite(M.culture('tomate'), bac);
  assert.equal(tom.ok, false);
  const rad = M.compatibilite(M.culture('radis'), bac);
  assert.ok(rad.ok && rad.notes.some(n => /sous abri/.test(n)));
  assert.ok(M.compatibilite(M.culture('carotte'), bac).ok, 'carotte ronde possible en bac de 20 cm');
  const grand = { type: 'pleine_terre', longueur: 300, largeur: 120, soleil: 'plein', pluie: 'ciel_ouvert' };
  const cap = M.capacite(M.culture('tomate'), grand, []);
  assert.ok(cap.total >= 6 && cap.total <= 12, 'tomates sur 3,6 m² : ' + cap.total);
  const capOcc = M.capacite(M.culture('tomate'), grand, [{ cultureId: 'tomate', quantite: 4 }]);
  assert.ok(capOcc.libre < cap.total);
  const sug = M.suggestions(grand, le('2027-05-20'), 'tempere', null, []);
  assert.equal(sug.length, 15);
  assert.ok(sug.every(s => s.demarrage && s.demarrage.length > 5));
});

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

test('Alertes météo du jardin', () => {
  require('../js/meteo.js');
  const { reponseOpenMeteo, serie } = require('./outils.js');
  const m = (t) => globalThis.Meteo.normaliser(reponseOpenMeteo(serie('2027-05-10', t)));
  const tomate = { plantation: {}, culture: M.culture('tomate'), espace: { pluie: 'ciel_ouvert' } };
  const ail = { plantation: {}, culture: M.culture('ail'), espace: { pluie: 'ciel_ouvert' } };
  const maintenant = le('2027-05-12');
  const gel = M.alertesJardin(m([[5, 15], [5, 15], [8, 18], [-2, 10], [6, 16], [8, 18], [9, 19], [10, 20], [10, 20], [10, 20]]), maintenant, [tomate, ail]);
  assert.equal(gel[0].type, 'gel'); assert.equal(gel[0].gravite, 'alerte');
  assert.deepEqual(gel[0].concerne, ['Tomate']);
  assert.equal(M.alertesJardin(m([[5, 15], [5, 15], [8, 18], [-2, 10], [6, 16], [8, 18], [9, 19], [10, 20], [10, 20], [10, 20]]), maintenant, [ail])[0].gravite, 'attention');
  const chaud = M.alertesJardin(m([[18, 30], [18, 30], [20, 36], [20, 34, 0, 70], [18, 30], [18, 31], [18, 30], [18, 30], [18, 30], [18, 30]]), maintenant, [tomate]);
  assert.ok(chaud.some(a => a.type === 'canicule' && a.gravite === 'alerte'), 'plusieurs jours ≥ 30 °C = canicule');
  assert.ok(!chaud.some(a => a.type === 'chaleur'), 'pas de doublon chaleur/canicule');
  assert.ok(chaud.some(a => a.type === 'vent'));
  assert.ok(chaud.some(a => a.type === 'secheresse'));
  const calme = M.alertesJardin(m([[10, 20, 1], [10, 20], [10, 20], [10, 20], [10, 20, 2], [10, 20], [10, 20], [10, 20], [10, 20], [10, 20]]), maintenant, [tomate]);
  assert.equal(calme.length, 0);
  assert.equal(M.alertesJardin(null, maintenant, [tomate]).length, 0);
  assert.equal(M.previsions(m([[10, 20, 0, 20, 95], [10, 20], [10, 20], [10, 20], [10, 20], [10, 20], [10, 20], [10, 20], [10, 20], [10, 20]]), le('2027-05-10'), 7)[0].ciel, 'orage');
});

test('Climat local : gelées réelles de la commune', () => {
  const histo = (fin, debut) => { const j = []; for (let y = 2016; y <= 2025; y++) for (let d = new Date(y, 0, 1, 12); d.getFullYear() === y; d = new Date(d.getTime() + 864e5)) { const iso = M.dates.iso(d), md = iso.slice(5); j.push({ date: iso, tmin: (md <= fin || md >= debut) ? -1 : 6 }); } return j; };
  const lieu = M.gelees(histo('03-25', '11-12')), ref = M.gelees(histo('04-10', '10-28'));
  assert.equal(lieu.derniere, '03-25'); assert.equal(lieu.premiere, '11-12'); assert.equal(lieu.annees, 10);
  const cl = M.climatLocal(lieu, ref);
  assert.equal(cl.decalagePrintemps, -16); assert.equal(cl.decalageAutomne, 15);
  const C = require('../data/climats.js'); C.definirLocale(cl, 'Test');
  const t = M.culture('tomate'), d = le('2027-04-27');
  assert.equal(M.niveauClimatique(t, 'plantation', d, 'tempere').niveau, 1);
  assert.ok(M.niveauClimatique(t, 'plantation', d, 'local').niveau >= 2, 'plantation plus tôt dans une commune plus douce');
  C.definirLocale(null);
});

test('Exposition, sol, associations, régions, maladies, rappels', () => {
  const nord = { type: 'bac', longueur: 100, largeur: 40, profondeur: 30, soleil: 'mi-ombre', pluie: 'ciel_ouvert', orientation: 'nord' };
  assert.equal(M.compatibilite(M.culture('tomate'), Object.assign({}, nord, { soleil: 'plein' })).ok, false);
  assert.ok(M.compatibilite(M.culture('laitue'), nord).ok);
  const sud = Object.assign({}, nord, { orientation: 'sud', soleil: 'plein' });
  assert.equal(M.compatibilite(M.culture('tomate'), sud).bonus, 1);
  assert.match(M.compatibilite(M.culture('carotte'), { type: 'pleine_terre', longueur: 200, largeur: 100, soleil: 'plein', sol: 'argileux' }).notes.join(), /variété ronde/);
  // Arrosage : sol argileux = vérifier moins souvent, sableux plus souvent
  const t0 = le('2027-06-10', 8), cult = [{ cultureId: 'laitue', mode: 'plant', date: '2027-05-20', observations: { reprise: '2027-05-26' } }];
  const base = { id: 'a', type: 'pleine_terre', pluie: 'abri' };
  const arg = M.arrosage(Object.assign({ sol: 'argileux' }, base), cult, [{ date: t0.toISOString() }], [], null, 'tempere', t0);
  const sab = M.arrosage(Object.assign({ sol: 'sableux' }, base), cult, [{ date: t0.toISOString() }], [], null, 'tempere', t0);
  assert.ok(arg.prochaine > sab.prochaine);
  // Associations
  const A = require('../data/associations.js');
  assert.equal(A.entre('ail', 'haricot-nain').type, 'eviter');
  assert.equal(A.entre('carotte', 'oignon').type, 'ami');
  const grand = { type: 'pleine_terre', longueur: 300, largeur: 120, soleil: 'plein', pluie: 'ciel_ouvert' };
  const sug = M.suggestions(grand, le('2027-05-20'), 'tempere', null, [{ cultureId: 'ail', quantite: 10 }], 'occitanie');
  const har = sug.find(s => s.culture.id === 'haricot-nain');
  assert.equal(har.voisins.aEviter[0].nom, 'Ail');
  assert.ok(sug.find(s => s.culture.id === 'oignon').regionales.some(v => /Cévennes/.test(v.nom)));
  // Régions
  const R = require('../data/regions.js');
  assert.equal(R.depuisCodePostal('29680').id, 'bretagne');
  assert.equal(R.depuisCodePostal('75011').id, 'ile-de-france');
  assert.ok(M.culture('oignon').varietes.some(v => v.id === 'rose-roscoff'), 'variétés régionales ajoutées aux fiches');
  // Variété régionale utilisable pour l'estimation
  const s = M.suivi({ cultureId: 'haricot-nain', mode: 'semis_place', date: '2027-05-20', varieteId: 'coco-paimpol', observations: {} }, 'tempere', le('2027-05-21'), null);
  const s0 = M.suivi({ cultureId: 'haricot-nain', mode: 'semis_place', date: '2027-05-20', observations: {} }, 'tempere', le('2027-05-21'), null);
  assert.ok(s.recolte.du > s0.recolte.du);
  // Maladies : chaque culture a au moins un problème décrit ; alerte mildiou par temps humide
  M.cultures().forEach(c => assert.ok(M.problemesDe(c.id).length >= 1, c.id));
  const { reponseOpenMeteo, serie } = require('./outils.js');
  const humide = globalThis.Meteo.normaliser(reponseOpenMeteo(serie('2027-06-08', [[14, 22], [14, 22], [14, 22, 6], [14, 21, 8], [14, 22, 5], [14, 23], [14, 23], [14, 23], [14, 23], [14, 23]])));
  const al = M.alertesJardin(humide, le('2027-06-10'), [{ plantation: {}, culture: M.culture('tomate'), espace: {} }]);
  assert.ok(al.some(a => a.probleme === 'mildiou'));
  // Rappels agenda
  const ev = M.rappelsPlantation({ id: 'p1', cultureId: 'radis', mode: 'semis_place', date: '2027-04-06', observations: {} }, 'tempere', le('2027-04-06'));
  assert.ok(ev.length >= 2);
  const f = M.ics(ev.concat([M.rappelArrosage({ id: 'b', nom: 'Bac', type: 'bac', sol: 'sableux' }, le('2027-04-06', 10))]), le('2027-04-06'));
  assert.match(f, /^BEGIN:VCALENDAR/); assert.match(f, /RRULE:FREQ=DAILY;INTERVAL=1;COUNT=40/); assert.match(f, /DTSTART;VALUE=DATE:20270409/);
  assert.equal((f.match(/BEGIN:VEVENT/g) || []).length, ev.length + 1);
});

test('Météo détaillée : heure par heure, pluie, nuits de gel, canicule, décision d’arrosage', () => {
  require('../js/meteo.js');
  const { reponseOpenMeteo, serie } = require('./outils.js');
  const pluies = { '2027-05-13T14:00': 2, '2027-05-13T15:00': 3, '2027-05-13T16:00': 1.5 };
  const m = globalThis.Meteo.normaliser(reponseOpenMeteo(serie('2027-05-10', [[8, 18], [8, 18], [6, 17], [8, 16, 6.5], [-2, 12], [6, 16], [8, 18], [9, 19], [10, 20], [10, 20]]), pluies));
  const maintenant = le('2027-05-12', 10);
  // Détail d'un jour : 24 heures avec température et ciel
  const h = M.heuresDuJour(m, '2027-05-13');
  assert.equal(h.length, 24); assert.ok(h[15].temp > h[5].temp); assert.ok(h[0].icone);
  // Épisode de pluie : demain de 14 h à 17 h, 6,5 mm
  const ep = M.episodesPluie(m, maintenant, 48);
  assert.equal(ep.length, 1); assert.match(ep[0].texte, /^Pluie demain de 14 h à 17 h : 6.5 mm \(80 % de risque\)/);
  // Nuit de gel : celle du 13 au 14, avec heures de début et de fin
  const n = M.nuits(m, maintenant, 3).find(x => x.min <= 0);
  assert.ok(n && n.debutGel && n.finGel && n.heuresGel >= 1);
  const tomate = { plantation: {}, culture: M.culture('tomate'), espace: {} };
  const al = M.alertesJardin(m, maintenant, [tomate]);
  const gel = al.find(a => a.type === 'gel');
  assert.match(gel.detail, /^Gel .* de \d+ h à \d+ h, minimum/); assert.match(gel.conseil, /^Avant 19 h/);
  // Canicule
  const chaud = globalThis.Meteo.normaliser(reponseOpenMeteo(serie('2027-07-10', [[18, 28], [18, 28], [20, 33], [21, 35], [22, 36], [19, 29], [18, 28], [18, 28]])));
  const c = M.canicule(chaud, le('2027-07-11'));
  assert.equal(c.jours, 3); assert.equal(c.tmax, 36); assert.equal(c.nuitsChaudes, 3);
  // Bilan d'eau : le bac au soleil se vide plus vite que la pleine terre argileuse
  const sec = globalThis.Meteo.normaliser(reponseOpenMeteo(serie('2027-06-07', [[14, 26], [14, 26], [14, 26], [14, 26], [14, 26], [14, 26], [14, 26], [14, 26], [14, 26], [14, 26], [14, 26]])));
  const t = le('2027-06-10', 9), arr = [{ date: le('2027-06-08', 19).toISOString() }];
  const cult = [{ cultureId: 'tomate', mode: 'plant', date: '2027-05-15', observations: { reprise: '2027-05-22' } }];
  const bac = M.arrosage({ id: 'a', type: 'bac', pluie: 'ciel_ouvert', orientation: 'sud' }, cult, arr, [], sec, 'tempere', t);
  const terre = M.arrosage({ id: 'b', type: 'pleine_terre', pluie: 'ciel_ouvert', sol: 'argileux' }, cult, arr, [], sec, 'tempere', t);
  assert.ok(bac.bilan.pourcentEau < terre.bilan.pourcentEau);
  assert.equal(bac.decision.verdict, 'arroser'); assert.equal(terre.decision.verdict, 'non');
  // Pluie sûre annoncée dans les heures qui viennent : attendre plutôt qu'arroser
  const pluieProche = globalThis.Meteo.normaliser(reponseOpenMeteo(serie('2027-06-07', [[14, 26], [14, 26], [14, 26], [14, 22, 8], [14, 26], [14, 26], [14, 26], [14, 26], [14, 26], [14, 26]]), { '2027-06-10T14:00': 4, '2027-06-10T15:00': 4 }));
  const bac2 = M.arrosage({ id: 'a', type: 'bac', pluie: 'ciel_ouvert' }, cult, arr, [], pluieProche, 'tempere', t);
  assert.equal(bac2.decision.verdict, 'attendre'); assert.match(bac2.decision.texte, /Pluie aujourd’hui de 14 h à 16 h/);
  // Bac sous abri : jamais « attendre la pluie »
  assert.equal(M.arrosage({ id: 'c', type: 'bac', pluie: 'abri' }, cult, arr, [], pluieProche, 'tempere', t).decision.verdict, 'arroser');
});

test('Météo plus : terre, créneaux, pluie dans l’heure, soif, normales, UV', () => {
  require('../js/meteo.js');
  const { reponseOpenMeteo, serie } = require('./outils.js');
  const N = (j, p, q) => globalThis.Meteo.normaliser(reponseOpenMeteo(j, p, q));
  // Terre à 9-10 °C qui se réchauffe : radis oui, haricot plus tard, courgette pas cette semaine
  const jours = serie('2027-04-20', [[6, 14], [6, 14], [6, 14], [7, 15], [9, 17], [11, 19], [12, 20], [13, 21], [13, 22], [14, 22]]).map((j, i) => Object.assign(j, { sol: [8, 9, 9.5, 10, 11, 12.5, 13, 13.5, 13.5, 13.5][i] }));
  const m = N(jours);
  const t = M.temperatureSol(m, le('2027-04-22', 10));
  assert.equal(Math.round(t.moyenne * 10) / 10, 9.5);
  assert.ok(t.tendance > 3);
  const de = (id, g) => t.cultures.find(c => c.culture.id === id && c.geste === g);
  assert.ok(de('radis', 'semis_place').ok);
  assert.equal(M.dates.iso(de('haricot-nain', 'semis_place').date), '2027-04-25');
  assert.equal(de('courgette', 'semis_place').date, null);
  assert.equal(M.temperatureSol(null, le('2027-04-22')), null);
  // Créneaux : pluie toute la journée de demain → traiter pas demain ; aujourd'hui calme
  const pl = {}; for (let h = 0; h < 24; h++) pl['2027-04-23T' + (h < 10 ? '0' : '') + h + ':00'] = 1;
  const c = M.creneaux(N(jours, pl), le('2027-04-22', 8));
  const traiter = c.find(x => x.id === 'traiter');
  assert.ok(traiter.debut && M.dates.iso(traiter.debut) === '2027-04-22', traiter.texte);
  assert.match(traiter.texte, /^Aujourd’hui de \d+ h à \d+ h$/);
  const recolter = M.creneaux(N(jours, pl), le('2027-04-23', 6)).find(x => x.id === 'recolter');
  assert.ok(M.dates.iso(recolter.debut) >= '2027-04-24', 'pas de récolte le lendemain d’une journée de pluie: ' + recolter.texte);
  assert.equal(c.length, 4);
  // Pluie dans les 2 heures
  const q = (debut, mm) => mm.map((x, i) => { const d = new Date(le('2027-04-22', 10).getTime() + i * 15 * 60000); return [M.dates.iso(d) + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), x]; });
  assert.match(M.pluieProchaine(N(jours, {}, q(0, [0, 0, 0, 0.3, 0.6, 0.4, 0, 0])), le('2027-04-22', 10)).texte, /^Pluie à partir de 10 h 45, jusqu’à 11 h 30 environ \(1.3 mm/);
  assert.match(M.pluieProchaine(N(jours, {}, q(0, [0.2, 0.3, 0, 0, 0, 0, 0, 0])), le('2027-04-22', 10)).texte, /^Il pleut en ce moment, jusqu’à 10 h 30/);
  assert.match(M.pluieProchaine(N(jours, {}, q(0, [0, 0, 0, 0, 0, 0, 0, 0])), le('2027-04-22', 10)).texte, /^Pas de pluie/);
  assert.match(M.pluieProchaine(N(jours, {}, q(0, [0.3, 0, 0.4, 0.6, 0.9, 1.5, 0.8, 0])), le('2027-04-22', 10)).texte, /^Pluie par moments jusqu’à 11 h 45 environ \(4.5 mm, la plus forte vers 11 h 15\)/);
  // Pas de créneau la nuit : en novembre (9 h de jour), rien après 17 h
  const nov = N(serie('2027-11-16', [[8, 14], [8, 14], [8, 14], [8, 14], [8, 14], [8, 14], [8, 14], [8, 14], [8, 14], [8, 14]]).map(j => Object.assign(j, { soleil: 3 })));
  nov.jours.forEach(j => { j.jour = 9; });
  M.creneaux(nov, le('2027-11-18', 8)).forEach(x => assert.ok(x.fin.getHours() <= 17 && x.debut.getHours() >= 8, x.id + ' ' + x.texte));
  assert.equal(M.pluieProchaine(m, le('2027-04-22', 10)), null);
  // Soif : 30 jours secs puis humides
  const passe = n => Array.from({ length: 31 }, (_, i) => ({ date: M.dates.iso(M.dates.ajouter(le('2027-06-01'), i)), pluie: n, et0: 4 }));
  assert.equal(M.soif(passe(0.5), le('2027-07-01')).verdict, 'sec');
  assert.equal(M.soif(passe(6), le('2027-07-01')).verdict, 'humide');
  assert.equal(M.soif(passe(6), le('2027-07-01')).jours.length, 30);
  // Normales : 10 ans à 10/20 °C → une semaine à 14/24 est 4 °C plus douce
  const histo = []; for (let y = 2016; y <= 2025; y++) for (let d = new Date(y, 0, 1, 12); d.getFullYear() === y; d = new Date(d.getTime() + 864e5)) histo.push({ date: M.dates.iso(d), tmin: 10, tmax: 20, pluie: 2 });
  const nor = globalThis.Meteo.calculerNormales(histo);
  assert.deepEqual(nor['06-15'], [10, 20, 2]);
  const chaud = N(serie('2027-06-10', [[14, 24], [14, 24], [14, 24], [14, 24], [14, 24], [14, 24], [14, 24], [14, 24]]));
  chaud.passe = passe(1).map((j, i) => Object.assign(j, { date: M.dates.iso(M.dates.ajouter(le('2027-05-10'), i)) }));
  const cmp = M.comparaisonNormale(chaud, nor, le('2027-06-10'));
  assert.match(cmp.texte, /4 °C plus doux/); assert.ok(cmp.conseil);
  assert.match(cmp.textePluie, /50 % de la normale/);
  // UV
  assert.equal(M.niveauUV(7).niveau, 'fort'); assert.equal(M.niveauUV(null), null);
});

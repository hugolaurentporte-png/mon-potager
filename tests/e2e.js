// Parcours de bout en bout dans un vrai navigateur (Chromium via Playwright).
// Lancement : node tests/e2e.js   (le serveur local est démarré automatiquement)
// Les services web (météo, communes) sont simulés pour des résultats reproductibles.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { reponseOpenMeteo, serie } = require('./outils.js');

const RACINE = path.join(__dirname, '..');
const CAPTURES = process.env.CAPTURES || null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
function serveur() {
  return new Promise(res => {
    const s = http.createServer((req, rep) => {
      const f = path.join(RACINE, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
      if (!f.startsWith(RACINE) || !fs.existsSync(f)) { rep.writeHead(404); return rep.end(); }
      rep.writeHead(200, { 'Content-Type': (TYPES[path.extname(f)] || 'text/plain') + '; charset=utf-8' });
      fs.createReadStream(f).pipe(rep);
    }).listen(0, () => res(s));
  });
}

let meteoCourante = null; // null = service en panne
const etapes = [];
function ok(nom) { etapes.push(nom); console.log('  ✓ ' + nom); }

(async () => {
  const srv = await serveur();
  const base = 'http://localhost:' + srv.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => { console.error('Erreur JS :', e); process.exitCode = 1; });
  await ctx.route('https://geo.api.gouv.fr/**', r => r.fulfill({ json: [{ nom: 'Paris', code: '75056', codeDepartement: '75', codesPostaux: ['75011'], centre: { type: 'Point', coordinates: [2.379, 48.859] } }] }));
  await ctx.route('https://api.open-meteo.com/v1/elevation**', r => r.fulfill({ json: { elevation: [42] } }));
  await ctx.route('https://api.open-meteo.com/v1/forecast**', r => meteoCourante ? r.fulfill({ json: meteoCourante }) : r.abort('failed'));

  const heure = async (iso) => { await page.clock.setFixedTime(new Date(iso)); };
  const ouvrir = async (hash) => { await page.goto(base + hash); await page.evaluate(() => localStorage.removeItem('potager.meteo.v1')); await page.reload(); await page.waitForTimeout(150); };
  const texte = async (sel) => (await page.locator(sel).first().innerText());
  const capture = async (nom) => { if (CAPTURES) await page.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: true }); };

  // ---------- Mise en place du potager ----------
  await heure('2027-04-06T09:00:00+02:00');
  meteoCourante = reponseOpenMeteo(serie('2027-04-03', [[4, 14], [5, 15], [6, 16], [6, 17], [5, 16], [7, 18], [8, 18], [7, 17], [6, 16], [6, 16], [7, 17]]));
  await ouvrir('#/');
  assert.match(await page.innerText('main'), /Bienvenue/);
  await page.click('a[href="#/potager"]');
  await page.fill('input[name="q"]', '75011');
  await page.click('form[data-form="chercher-commune"] button');
  await page.click('button[data-action="choisir-commune"]');
  await page.waitForSelector('[data-test="commune"]');
  assert.match(await page.innerText('main'), /Paris/);
  assert.equal(await page.inputValue('select[data-action="choisir-zone"]'), 'tempere');
  const ajouterEspace = async (nom, type, L, l, p, pluie) => {
    await page.goto(base + '#/espace/nouveau');
    await page.fill('input[name="nom"]', nom);
    await page.check('input[name="type"][value="' + type + '"]');
    await page.fill('input[name="longueur"]', String(L));
    await page.fill('input[name="largeur"]', String(l));
    if (p) await page.fill('input[name="profondeur"]', String(p));
    await page.check('input[name="pluie"][value="' + pluie + '"]');
    await page.click('[data-test="enregistrer-espace"]');
    await page.waitForTimeout(100);
  };
  await ajouterEspace('Bac jardin', 'bac', 120, 40, 30, 'ciel_ouvert');
  await ajouterEspace('Bac terrasse', 'bac', 100, 40, 30, 'abri');
  await ajouterEspace('Parcelle', 'pleine_terre', 300, 120, null, 'ciel_ouvert');
  await page.goto(base + '#/potager');
  assert.equal(await page.locator('a.ligne[href^="#/espace/"]').count(), 3);
  ok('Profil : commune par code postal, climat détecté, 3 espaces créés');

  // Suggestions pour un bac
  await page.goto(base + '#/suggestions');
  await page.waitForTimeout(100);
  const sug = await page.innerText('main');
  assert.match(sug, /Radis/); assert.match(sug, /Place pour environ \d+ radis/);
  assert.match(sug, /Semer en place/);
  await capture('suggestions');
  ok('« Quoi planter cette semaine ? » : cultures compatibles, nombre de plants, comment démarrer');

  // ---------- 1. Radis semé ----------
  await page.goto(base + '#/culture/radis');
  await page.click('[data-test="jai-seme"]');
  await page.fill('input[name="date"]', '2027-04-05');
  await page.selectOption('select[name="espace"]', { label: 'Bac jardin' });
  await page.selectOption('select[name="variete"]', '18-jours');
  await page.click('[data-test="enregistrer"]');
  await page.waitForSelector('[data-test="prochaine"]');
  assert.match(await texte('[data-test="prochaine"] h2'), /Levée/);
  const fenLevee = await texte('[data-test="fenetre"]');
  assert.match(fenLevee, /avril/);
  const recolte1 = await texte('[data-test="fenetre-recolte"]');
  await capture('radis-seme');
  await heure('2027-04-12T19:00:00+02:00'); await page.reload();
  await page.click('[data-test="obs-levee"]');
  await page.waitForTimeout(100);
  assert.match(await texte('[data-test="prochaine"] h2'), /Nouvelles feuilles/);
  const recolte2 = await texte('[data-test="fenetre-recolte"]');
  assert.match(await page.innerText('main'), /observé le 12 avril/); assert.notEqual(recolte2, recolte1, 'récolte recalée');
  console.log('    levée attendue ' + fenLevee + ' ; récolte ' + recolte1 + ' → après levée le 12 : ' + recolte2);
  await heure('2027-04-17T19:00:00+02:00'); await page.reload();
  assert.match(await page.innerText('main'), /Éclaircir/);
  await capture('radis-leve');
  ok('Parcours 1 : radis semé (date réelle), fenêtre de levée, levée confirmée, récolte recalée, geste « Éclaircir »');

  // ---------- 2. Tomate en plant ----------
  await heure('2027-05-12T09:00:00+02:00');
  meteoCourante = reponseOpenMeteo(serie('2027-05-09', [[6, 15], [4, 14], [5, 14], [6, 15], [-1, 12], [3, 16], [8, 20], [10, 22], [11, 23], [12, 24], [12, 24]]));
  await ouvrir('#/culture/tomate');
  await page.waitForSelector('.jours');
  const fiche = await page.innerText('main');
  assert.match(fiche, /Planter dehors · attendre/);
  assert.match(fiche, /gel annoncé/i);
  assert.match(fiche, /Semer sous abri · /);
  await capture('tomate-gel');
  await heure('2027-05-20T09:00:00+02:00');
  meteoCourante = reponseOpenMeteo(serie('2027-05-17', [[12, 22], [13, 24], [13, 25], [14, 26], [14, 26], [13, 24], [12, 23], [12, 23], [13, 24], [13, 24], [13, 24]]));
  await ouvrir('#/culture/tomate');
  await page.waitForSelector('.jours');
  assert.match(await page.innerText('main'), /Planter dehors · (très )?favorable/);
  await page.click('[data-test="jai-plante"]');
  await page.selectOption('select[name="espace"]', { label: 'Parcelle' });
  await page.fill('input[name="quantite"]', '4');
  await page.click('[data-test="enregistrer"]');
  await page.waitForSelector('[data-test="prochaine"]');
  assert.match(await texte('[data-test="prochaine"] h2'), /Reprise/);
  assert.match(await page.innerText('main'), /Tuteurer/);
  const r1 = await texte('[data-test="fenetre-recolte"]');
  const urlTomate = page.url();
  await heure('2027-06-03T09:00:00+02:00'); await page.reload();
  assert.match(await page.innerText('[data-test="prochaine"]'), /fenêtre est dépassée/);
  await page.fill('form[data-etape="reprise"] input[name="date"]', '2027-06-02');
  await page.click('[data-test="obs-reprise"]');
  await page.waitForTimeout(100);
  assert.match(await texte('[data-test="prochaine"] h2'), /Premières fleurs/);
  const r2 = await texte('[data-test="fenetre-recolte"]');
  console.log('    récolte estimée ' + r1 + ' → après reprise le 2 juin : ' + r2);
  await heure('2027-08-01T09:00:00+02:00'); await page.reload();
  assert.match(await page.innerText('[data-test="recolte"]'), /Signe à observer/);
  await capture('tomate-recolte');
  await page.click('[data-test="premiere-recolte"]');
  await page.waitForTimeout(100);
  assert.match(await page.innerText('[data-test="recolte"]'), /Récolte en cours/);
  await page.goto(base + '#/');
  assert.match(await page.innerText('main'), /Récolte proche[\s\S]*Tomate/);
  await page.goto(urlTomate);
  await page.click('[data-test="terminer"]');
  await page.waitForSelector('[data-test="ensuite"]');
  assert.match(await page.innerText('[data-test="ensuite"]'), /se libère/);
  await capture('tomate-ensuite');
  ok('Parcours 2 : tomate en plant, « attendre, gel annoncé », plantation après le gel, reprise suivie, récolte puis « Culture terminée » et suite proposée');

  // ---------- 3 et 4. Arrosage : deux bacs, dont un sous abri ----------
  await heure('2027-06-08T08:00:00+02:00');
  meteoCourante = null;
  for (const nom of ['Bac jardin', 'Bac terrasse']) {
    await page.goto(base + '#/demarrer/laitue/plante');
    await page.selectOption('select[name="espace"]', { label: nom });
    await page.fill('input[name="date"]', '2027-05-20');
    await page.click('[data-test="enregistrer"]');
    await page.waitForSelector('[data-test="prochaine"]');
    await page.click('[data-test="obs-reprise"]');
  }
  await page.goto(base + '#/arrosage');
  await page.locator('label.radio', { hasText: 'Bac jardin' }).locator('input').check();
  await page.locator('label.radio', { hasText: 'Bac terrasse' }).locator('input').check();
  await page.click('[data-test="arroser-selection"]');
  await page.waitForTimeout(100);
  let arr = await page.innerText('main');
  assert.equal((arr.match(/Dernier arrosage : aujourd’hui à 08:00/g) || []).length, 2);
  await page.reload();
  arr = await page.innerText('main');
  assert.equal((arr.match(/Dernier arrosage : aujourd’hui à 08:00/g) || []).length, 2, 'persistance après rechargement');
  assert.match(arr, /Prochaine vérification/);
  await capture('arrosage-multiple');
  ok('Parcours 4 : arrosage de plusieurs bacs d’un coup, dernier arrosage et prochaines vérifications conservés après rechargement');

  await heure('2027-06-10T18:00:00+02:00');
  const pluies = { '2027-06-09T14:00': 4, '2027-06-09T15:00': 4, '2027-06-09T16:00': 4, '2027-06-11T03:00': 8 };
  meteoCourante = reponseOpenMeteo(serie('2027-06-07', [[14, 24], [14, 24], [13, 22, 12], [14, 24], [15, 25], [15, 25], [15, 25], [15, 25], [15, 25], [15, 25], [15, 25]]), pluies);
  await ouvrir('#/arrosage');
  await page.waitForSelector('[data-test="meteo"]');
  const carteJardin = await page.locator('section .arrosage', { hasText: 'Bac jardin' }).innerText();
  const carteTerrasse = await page.locator('section .arrosage', { hasText: 'Bac terrasse' }).innerText();
  assert.match(carteTerrasse, /Vérifie la terre du bac\. Si elle est sèche, arrose\./);
  assert.match(carteTerrasse, /sous abri : la pluie ne compte pas/i);
  assert.doesNotMatch(carteJardin, /Vérifie la terre/);
  assert.match(carteJardin, /pluie récente \(12 mm\)/i);
  assert.match(carteJardin, /Dernier arrosage : mardi 8 juin/);
  await capture('arrosage-averse');
  await page.goto(base + '#/');
  const accueil = await page.innerText('main');
  assert.match(accueil, /Arrosage à vérifier[\s\S]*Bac terrasse/);
  assert.doesNotMatch(accueil.split('À observer')[0].split('Arrosage à vérifier')[1] || '', /Bac jardin/);
  await page.click('.arrosage[data-espace] [data-action="humide"]');
  await page.waitForTimeout(100);
  assert.doesNotMatch(await page.innerText('main'), /Arrosage à vérifier/);
  await capture('accueil');
  ok('Parcours 3 : averse d’hier (12 mm) → seul le bac à ciel ouvert est reporté ; pluie prévue non comptée ; « Terre encore humide » reporte');

  // ---------- 5. Météo indisponible ----------
  meteoCourante = null;
  await heure('2027-05-12T09:00:00+02:00');
  await ouvrir('#/culture/tomate');
  await page.waitForTimeout(200);
  const sansMeteo = await page.innerText('main');
  assert.match(sansMeteo, /Météo indisponible/);
  assert.match(sansMeteo, /non affiné/);
  assert.match(sansMeteo, /Planter dehors · favorable/);
  assert.equal(await page.locator('.cal-ligne').count(), 2);
  await capture('sans-meteo');
  await page.goto(base + '#/');
  assert.match(await page.innerText('main'), /calendrier climatique reste valable/);
  ok('Parcours 5 : météo indisponible → calendrier climatique conservé, limite affichée');

  // ---------- 6. Les 15 cultures ----------
  await heure('2027-04-15T09:00:00+02:00');
  await page.goto(base + '#/envie');
  const tuiles = await page.locator('a.tuile').count();
  assert.equal(tuiles, 15);
  const ids = await page.$$eval('a.tuile', as => as.map(a => a.getAttribute('href').split('/').pop()));
  let demarrages = 0; const resume = [];
  for (const id of ids) {
    await page.goto(base + '#/culture/' + id);
    const actions = [];
    if (await page.locator('[data-test="jai-seme"]').count()) actions.push('seme');
    if (await page.locator('[data-test="jai-plante"]').count()) actions.push('plante');
    assert.ok(actions.length, id);
    const modesFaits = [];
    for (const a of actions) {
      await page.goto(base + '#/demarrer/' + id + '/' + a);
      const radios = await page.locator('input[name="mode"][type="radio"]').count();
      const modes = radios ? await page.$$eval('input[name="mode"]', is => is.map(i => i.value)) : [await page.inputValue('input[name="mode"]')];
      for (const m of modes) {
        await page.goto(base + '#/demarrer/' + id + '/' + a);
        if (radios) await page.check('input[name="mode"][value="' + m + '"]');
        await page.selectOption('select[name="espace"]', { label: 'Parcelle' });
        await page.click('[data-test="enregistrer"]');
        await page.waitForSelector('[data-test="prochaine"]');
        assert.match(await page.innerText('main'), /Prochaine étape/);
        assert.match(await page.innerText('main'), /Première récolte estimée/);
        modesFaits.push(m); demarrages++;
      }
    }
    resume.push(id + ' (' + modesFaits.join(', ') + ')');
  }
  console.log('    ' + resume.join(' ; '));
  ok('Parcours 6 : 15 cultures consultables, ' + demarrages + ' démarrages testés (tous les modes applicables)');

  await browser.close(); srv.close();
  console.log('\n' + etapes.length + ' vérifications de bout en bout réussies.');
})().catch(e => { console.error('ÉCHEC :', e); process.exit(1); });

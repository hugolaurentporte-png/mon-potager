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
  // Historique : gelées jusqu'au 25 mars dans la commune, jusqu'au 10 avril au lieu de référence
  const historique = (url) => {
    const ref = /latitude=47\.9/.test(url), time = [], tmin = [];
    for (let y = 2016; y <= 2025; y++) for (let d = new Date(Date.UTC(y, 0, 1)); d.getUTCFullYear() === y; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10), md = iso.slice(5);
      time.push(iso); tmin.push(md <= (ref ? '04-10' : '03-25') || md >= (ref ? '10-28' : '11-12') ? -2 : 8);
    }
    return { daily: { time, temperature_2m_min: tmin, temperature_2m_max: tmin.map(t => t + 10), precipitation_sum: tmin.map(() => 2) } };
  };
  await ctx.route('https://archive-api.open-meteo.com/**', r => r.fulfill({ json: historique(r.request().url()) }));
  // 30 derniers jours (pluie / évaporation) : série fabriquée qui se termine au jour « aujourd'hui » du jeu de données
  const trenteJours = () => {
    const fin = new Date(meteoCourante.daily.time[3] + 'T12:00:00'), deb = new Date(fin.getTime() - 31 * 864e5);
    const iso = deb.toISOString().slice(0, 10);
    return reponseOpenMeteo(serie(iso, Array.from({ length: 32 }, (_, i) => [10, 20, i % 5 === 0 ? 6 : 0])));
  };
  await ctx.route('https://api.open-meteo.com/v1/forecast**', r => !meteoCourante ? r.abort('failed') : r.fulfill({ json: /past_days=31/.test(r.request().url()) ? trenteJours() : meteoCourante }));

  const heure = async (iso) => { await page.clock.setFixedTime(new Date(iso)); };
  const ouvrir = async (hash) => { await page.goto(base + hash); await page.evaluate(() => localStorage.removeItem('potager.meteo.v4')); await page.reload(); await page.waitForTimeout(150); };
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
  await page.waitForSelector('[data-test="climat-local"]');
  assert.equal(await page.inputValue('select[data-action="choisir-zone"]'), 'local');
  assert.match(await page.innerText('[data-test="climat-local"]'), /dernières gelées vers le 25 mars, premières vers le 12 novembre/);
  await page.selectOption('select[data-action="choisir-zone"]', 'tempere');
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
  // Écran météo et alertes : gel avec une tomate en terre
  await heure('2027-05-25T09:00:00+02:00');
  meteoCourante = reponseOpenMeteo(serie('2027-05-22', [[10, 20], [11, 21], [9, 19], [6, 15], [1, 12], [8, 18, 25, 70, 95], [10, 22], [11, 23], [12, 24], [12, 24], [12, 24]]), {}, [['2027-05-25T09:00', 0], ['2027-05-25T09:15', 0], ['2027-05-25T09:30', 0.2], ['2027-05-25T09:45', 0.5], ['2027-05-25T10:00', 0.3], ['2027-05-25T10:15', 0], ['2027-05-25T10:30', 0], ['2027-05-25T10:45', 0]]);
  await ouvrir('#/meteo');
  await page.waitForSelector('[data-test="previsions"]');
  const ecranM = await page.innerText('main');
  assert.equal(await page.locator('.prevision').count(), 7);
  assert.match(ecranM, /Risque de gelée blanche : 1 °C/);
  assert.match(ecranM, /Concerne : Tomate/);
  assert.match(ecranM, /Forte pluie : 25 mm/);
  assert.match(ecranM, /Orage possible/);
  await capture('meteo');
  // Prochaines 48 h, « Faut-il arroser ? », puis un jour en détail heure par heure
  assert.match(await page.innerText('[data-test="48h"]'), /minimum/);
  assert.match(await page.innerText('[data-test="eau-bacs"]'), /Eau disponible estimée/);
  assert.match(await page.innerText('[data-test="pluie-heure"]'), /Pluie à partir de 9 h 30, jusqu’à 10 h 15 environ \(1 mm/);
  assert.equal(await page.locator('[data-test="creneaux"] .creneau').count(), 4);
  assert.match(await page.innerText('[data-test="terre"]'), /°C/);
  assert.match(await page.innerText('[data-test="soleil"]'), /UV 3/);
  assert.match(await page.innerText('[data-test="soif"]'), /mm tombés/);
  await page.waitForSelector('[data-test="normales"] >> text=/d’habitude chez toi|proches des normales/');
  await page.locator('[data-test="soif"] .cible').last().dispatchEvent('pointerdown');
  assert.match(await page.innerText('[data-test="soif"] .bulle'), /évaporation/);
  await page.click('.prevision >> nth=1');
  await page.waitForSelector('[data-test="heures"]');
  assert.match(await page.innerText('[data-test="jour-titre"]'), /Mercredi 26 mai/);
  assert.equal(await page.locator('.heure:not(.entete-h)').count(), 24);
  assert.ok(await page.locator('.trait-temp').count() === 1, 'courbe des températures');
  assert.match(await page.innerText('[data-test="jour-resume"]'), /Terre à 6 cm/);
  assert.match(await page.innerText('main'), /Prévision très fiable/);
  assert.match(await page.innerText('main'), /Gelée blanche|gelée blanche/);
  await capture('meteo-jour');
  await page.click('.jour-nav a >> text=›');
  assert.match(await page.innerText('[data-test="jour-titre"]'), /Jeudi 27 mai/);
  assert.match(await page.innerText('main'), /Quand va-t-il pleuvoir/);
  assert.match(await page.innerText('[data-test="graphe-pluie"]'), /25 mm sur la journée/);
  assert.ok(await page.locator('[data-test="graphe-pluie"] .barre-pluie').count() >= 4);
  await page.locator('[data-test="graphe-pluie"] .cible >> nth=14').dispatchEvent('pointerdown');
  assert.match(await page.innerText('[data-test="graphe-pluie"] .bulle'), /14 h : 6,3 mm · risque 80 %/);
  await capture('meteo-pluie');
  await page.goto(base + '#/');
  assert.match(await page.innerText('[data-test="jardin-jour"]'), /Aujourd’hui au jardin/);
  await capture('accueil-jardin-jour');
  assert.match(await page.innerText('[data-test="alertes-accueil"]'), /gelée blanche/);
  await page.goto(urlTomate);
  await heure('2027-05-21T09:00:00+02:00');
  meteoCourante = reponseOpenMeteo(serie('2027-05-17', [[12, 22], [13, 24], [13, 25], [14, 26], [14, 26], [13, 24], [12, 23], [12, 23], [13, 24], [13, 24], [13, 24]]));
  await ouvrir('#' + urlTomate.split('#')[1]);
  ok('Écran Météo : 7 jours, alertes gel / forte pluie / orage avec cultures concernées, rappel sur l’accueil');
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

  // ---------- Nouveautés : exposition, sol, associations, maladies, région, rappels ----------
  meteoCourante = reponseOpenMeteo(serie('2027-04-12', [[6, 16], [6, 16], [6, 16], [7, 17], [7, 17], [7, 17], [8, 18], [8, 18], [8, 18], [8, 18], [8, 18]]));
  await heure('2027-04-15T09:00:00+02:00');
  await ouvrir('#/espace/nouveau');
  await page.fill('input[name="nom"]', 'Coin nord');
  await page.check('input[name="orientation"][value="nord"]');
  await page.selectOption('select[name="sol"]', 'terreau');
  await page.click('[data-test="enregistrer-espace"]');
  await page.waitForTimeout(150);
  const pageEsp = await page.innerText('main');
  assert.match(pageEsp, /exposé nord/); assert.match(pageEsp, /terreau du commerce/i); assert.match(pageEsp, /s’épuise en un an/);
  const idNord = page.url().split('/').pop();
  await page.goto(base + '#/suggestions?espace=' + idNord);
  await page.waitForTimeout(100);
  const sugNord = await page.innerText('main');
  assert.match(sugNord, /Peu adapté[\s\S]*Tomate[^\n]*exposition nord/);
  assert.match(await page.innerText('[data-test="sugg-laitue"]'), /se plaît en exposition nord/);
  // Associations dans les suggestions : de l'ail dans la parcelle → le haricot est à éviter
  await page.goto(base + '#/demarrer/ail/plante');
  await page.selectOption('select[name="espace"]', { label: 'Parcelle' });
  await page.fill('input[name="quantite"]', '10');
  await page.click('[data-test="enregistrer"]');
  await page.waitForSelector('[data-test="prochaine"]');
  const urlAil = page.url();
  const idParcelle = await page.evaluate(() => Store.etat.espaces.find(e => e.nom === 'Parcelle').id);
  await page.goto(base + '#/suggestions?espace=' + idParcelle);
  await page.waitForTimeout(100);
  assert.match(await page.innerText('[data-test="sugg-carotte"]'), /Bon voisin de : Ail/);
  // Fiche culture : bons voisins et problèmes
  await page.goto(base + '#/culture/haricot-nain');
  assert.match(await page.innerText('[data-test="associations"]'), /À éviter à côté de[\s\S]*Ail/);
  await page.goto(base + '#/culture/tomate');
  await page.click('#pb-mildiou summary');
  assert.match(await page.innerText('[data-test="problemes"]'), /Arrose au pied, jamais le feuillage/);
  // Un souci depuis le suivi
  await page.goto(urlAil);
  await page.click('[data-test="souci"]');
  await page.waitForTimeout(100);
  assert.match(await page.innerText('main'), /Un souci avec ail[\s\S]*Rouille/);
  // Région (Paris → Île-de-France)
  await page.goto(base + '#/');
  assert.match(await page.innerText('[data-test="region"]'), /Île-de-France[\s\S]*Laitue Gotte/);
  await page.goto(base + '#/demarrer/laitue/seme');
  assert.match(await page.innerText('select[name="variete"]'), /Gotte jaune d’or — spécialité de ta région/);
  // Rappels agenda
  await page.goto(base + '#/potager');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-test="rappels"]')]);
  const fichier = fs.readFileSync(await dl.path(), 'utf8');
  assert.equal(dl.suggestedFilename(), 'potager-rappels.ics');
  assert.match(fichier, /BEGIN:VCALENDAR/); assert.match(fichier, /RRULE:FREQ=DAILY/); assert.match(fichier, /Ail/);
  console.log('    agenda : ' + (fichier.match(/BEGIN:VEVENT/g) || []).length + ' rappels générés');
  await capture('nouveautes-potager');
  ok('Nouveautés : exposition nord écarte les tomates, sol pris en compte, bons voisins / à éviter, fiche maladies, spécialités régionales, fichier de rappels agenda');

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

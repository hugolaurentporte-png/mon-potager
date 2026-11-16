/*
 * Enregistrement des données du potager.
 *  - Toujours une copie dans le navigateur (localStorage), quand il le permet.
 *  - Dans l'app hébergée sur claude.ai : copie privée dans ton espace Claude
 *    (capacité « db »), retrouvée sur tous tes appareils.
 */
(function (racine) {
  var CLE = 'potager.v1';
  var vide = function () { return { version: 1, maj: 0, profil: null, espaces: [], plantations: [], arrosages: [], reports: [] }; };
  var etat = charger();
  var distant = null, ecritureEnCours = false, aRecrire = false, minuteur = null;
  var abonnes = [];

  function charger() {
    try {
      var e = JSON.parse(localStorage.getItem(CLE) || 'null');
      if (e && e.version === 1) return Object.assign(vide(), e);
    } catch (err) { /* stockage indisponible ou illisible */ }
    return vide();
  }
  function sauverLocal() { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) { /* navigation privée */ } }
  function sauver() {
    etat.maj = Date.now();
    sauverLocal();
    if (distant) { clearTimeout(minuteur); minuteur = setTimeout(envoyer, 600); }
  }
  function envoyer() {
    if (!distant) return;
    if (ecritureEnCours) { aRecrire = true; return; }
    ecritureEnCours = true;
    distant.set({ json: JSON.stringify(etat), maj: etat.maj }).catch(function (e) {
      Store.erreurSynchro = (e && e.code) || 'erreur';
    }).then(function () {
      ecritureEnCours = false;
      if (aRecrire) { aRecrire = false; envoyer(); }
    });
  }

  /* Connexion à l'enregistrement claude.ai, si la page y est hébergée. */
  function connecter() {
    if (!(racine.claude && racine.claude.use)) return;
    Promise.all([racine.claude.use('db'), racine.claude.use('user')]).then(function (r) {
      var db = r[0], user = r[1];
      if (!db || !user) return null;
      return user.id().then(function (uid) {
        if (!uid) return null;
        var ref = db.doc('data/users/' + uid + '/potager');
        return ref.get().then(function (snap) {
          distant = ref;
          Store.synchro = true;
          var d = snap.exists ? snap.data() : null;
          if (d && d.json && (d.maj || 0) > (etat.maj || 0)) {
            try { etat = Object.assign(vide(), JSON.parse(d.json)); sauverLocal(); } catch (e) { /* ignorer */ }
          } else if (etat.maj) {
            envoyer();
          }
          abonnes.forEach(function (f) { f(); });
        });
      });
    }).catch(function () { /* pas de synchronisation : le navigateur garde les données */ });
  }

  function id(prefixe) { return prefixe + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6); }

  var Store = {
    synchro: false,
    get etat() { return etat; },
    surChargement: function (f) { abonnes.push(f); },
    recharger: function () { etat = charger(); },
    definirProfil: function (p) { etat.profil = Object.assign({}, etat.profil || {}, p); sauver(); },
    ajouterEspace: function (e) { e.id = id('esp'); etat.espaces.push(e); sauver(); return e; },
    modifierEspace: function (idE, champs) { var e = Store.espace(idE); if (e) { Object.assign(e, champs); sauver(); } },
    supprimerEspace: function (idE) {
      etat.espaces = etat.espaces.filter(function (e) { return e.id !== idE; });
      etat.plantations.forEach(function (p) { if (p.espaceId === idE && !p.terminee) p.terminee = new Date().toISOString().slice(0, 10); });
      sauver();
    },
    espace: function (idE) { return etat.espaces.filter(function (e) { return e.id === idE; })[0]; },
    ajouterPlantation: function (p) { p.id = id('cult'); p.observations = p.observations || {}; etat.plantations.push(p); sauver(); return p; },
    plantation: function (idP) { return etat.plantations.filter(function (p) { return p.id === idP; })[0]; },
    modifierPlantation: function (idP, champs) { var p = Store.plantation(idP); if (p) { Object.assign(p, champs); sauver(); } return p; },
    observer: function (idP, etape, date) { var p = Store.plantation(idP); if (!p) return; p.observations[etape] = date; sauver(); },
    annulerObservation: function (idP, etape) { var p = Store.plantation(idP); if (!p) return; delete p.observations[etape]; sauver(); },
    supprimerPlantation: function (idP) { etat.plantations = etat.plantations.filter(function (p) { return p.id !== idP; }); sauver(); },
    actives: function (idE) { return etat.plantations.filter(function (p) { return !p.terminee && (!idE || p.espaceId === idE); }); },
    arroser: function (ids, quand) {
      var d = (quand || new Date()).toISOString();
      ids.forEach(function (i) { etat.arrosages.push({ espaceId: i, date: d }); });
      etat.arrosages = etat.arrosages.slice(-500);
      sauver();
    },
    terreHumide: function (idE, quand) { etat.reports.push({ espaceId: idE, date: (quand || new Date()).toISOString() }); etat.reports = etat.reports.slice(-200); sauver(); },
    arrosagesDe: function (idE) { return etat.arrosages.filter(function (a) { return a.espaceId === idE; }); },
    reportsDe: function (idE) { return etat.reports.filter(function (a) { return a.espaceId === idE; }); },
    toutEffacer: function () { etat = vide(); sauver(); }
  };
  racine.Store = Store;
  connecter();
})(typeof window !== 'undefined' ? window : globalThis);

/*
 * Enregistrement local (dans le navigateur, localStorage).
 * Aucune donnée n'est envoyée sur un serveur.
 */
(function (racine) {
  var CLE = 'potager.v1';
  var vide = function () { return { version: 1, profil: null, espaces: [], plantations: [], arrosages: [], reports: [] }; };
  var etat = charger();

  function charger() {
    try {
      var e = JSON.parse(localStorage.getItem(CLE) || 'null');
      if (e && e.version === 1) return Object.assign(vide(), e);
    } catch (err) { /* données illisibles : on repart de zéro */ }
    return vide();
  }
  function sauver() { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) { alert('Impossible d’enregistrer sur cet appareil (stockage plein ou navigation privée).'); } }
  function id(prefixe) { return prefixe + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6); }

  var Store = {
    get etat() { return etat; },
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
})(typeof window !== 'undefined' ? window : globalThis);

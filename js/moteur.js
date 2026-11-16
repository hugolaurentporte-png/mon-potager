/*
 * MOTEUR DE CONSEILS — logique pure, sans interface.
 * Tout ce qui dépend du temps reçoit `maintenant` en paramètre (testable).
 * Les règles chiffrées propres au moteur (seuils d'arrosage, marges) sont
 * regroupées dans REGLES ci-dessous ; les données par culture sont dans
 * data/cultures.js.
 */
(function (racine) {
  var CULTURES = racine.CULTURES || (typeof require !== 'undefined' && require('../data/cultures.js'));
  var ETAPES = racine.ETAPES || (typeof require !== 'undefined' && require('../data/etapes.js'));
  var CLIMATS = racine.CLIMATS || (typeof require !== 'undefined' && require('../data/climats.js'));

  var REGLES = {
    margeConditionsJours: 14,      // avant/après une fenêtre : « possible sous conditions »
    horizonMeteoJours: 5,          // nuits regardées pour un geste dehors
    arrosage: {
      intervalleBase: { bac: 2, pleine_terre: 4 },   // jours entre deux vérifications par temps doux
      seuilPluie: { bac: 6, pleine_terre: 10 },       // mm de pluie tombée équivalents à un arrosage
      pluieAnnonceeSignificative: 4,                  // mm dans les 24 h pour en parler
      facteurStade: { semisNonLeve: 0.5, reprise: 0.6, fructificationGourmande: 0.75 },
      facteurBesoin: { faible: 1.4, moyen: 1, eleve: 0.85 },
      chaleur: [ // tmax (°C) -> facteur
        { min: 32, f: 0.5 }, { min: 28, f: 0.7 }, { min: 24, f: 0.85 }, { min: 16, f: 1 }, { min: 10, f: 1.4 }, { min: -99, f: 2 }
      ],
      intervalleMin: 0.5,
      intervalleMax: 7
    },
    approcheRecolteJours: 7
  };

  var JOUR = 86400000;
  var NIVEAUX = ['attendre', 'possible sous conditions', 'favorable', 'très favorable'];
  var GESTES = {
    semis_abri: { id: 'semis_abri', nom: 'Semer sous abri', court: 'semer sous abri' },
    semis_place: { id: 'semis_place', nom: 'Semer dehors', court: 'semer en place' },
    plantation: { id: 'plantation', nom: 'Planter dehors', court: 'mettre un plant en terre' }
  };
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  /* ---------- Dates ---------- */
  function jourDe(d) { var x = new Date(d.getTime()); x.setHours(12, 0, 0, 0); return x; }
  function lireDate(iso) {
    if (iso instanceof Date) return jourDe(iso);
    var p = String(iso).slice(0, 10).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0, 0);
  }
  function isoDate(d) {
    var m = d.getMonth() + 1, j = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (j < 10 ? '0' : '') + j;
  }
  function ajouterJours(d, n) { var x = new Date(d.getTime() + n * JOUR); return x; }
  function ecartJours(a, b) { return Math.round((jourDe(b) - jourDe(a)) / JOUR); }
  function dateMMJJ(annee, mmjj) { var p = mmjj.split('-'); return new Date(annee, +p[0] - 1, +p[1], 12); }
  function formatDate(d) { return d.getDate() + ' ' + MOIS[d.getMonth()]; }
  function formatJour(d) { return JOURS[d.getDay()] + ' ' + formatDate(d); }
  function formatFenetre(a, b) {
    if (ecartJours(a, b) <= 0) return 'vers le ' + formatDate(a);
    if (a.getMonth() === b.getMonth()) return 'entre le ' + a.getDate() + ' et le ' + formatDate(b);
    return 'entre le ' + formatDate(a) + ' et le ' + formatDate(b);
  }
  function quand(d, maintenant) {
    var n = ecartJours(maintenant, d);
    var h = d.getHours();
    var moment = h < 12 ? 'matin' : (h < 18 ? 'après-midi' : 'soir');
    if (n <= 0) return d <= maintenant ? 'maintenant' : 'aujourd’hui ' + (moment === 'matin' ? 'dans la matinée' : (moment === 'soir' ? 'en soirée' : 'dans l’après-midi'));
    if (n === 1) return 'demain ' + moment;
    if (n < 7) return JOURS[d.getDay()] + ' ' + moment;
    return 'le ' + formatDate(d);
  }

  /* ---------- Cultures ---------- */
  function culture(id) { for (var i = 0; i < CULTURES.length; i++) if (CULTURES[i].id === id) return CULTURES[i]; return null; }
  function gestesDe(c) { return ['semis_abri', 'semis_place', 'plantation'].filter(function (g) { return !!c.demarrage[g]; }); }
  function nomGeste(c, g) { return (g === 'plantation' && c.demarrage.plantation && c.demarrage.plantation.libelle) || GESTES[g].nom; }
  /** Modes de démarrage applicables : semis_place, semis_abri (semer puis mettre en terre), plant */
  function modesDe(c) {
    var m = [];
    if (c.parcours.semis_place) m.push('semis_place');
    if (c.parcours.semis_abri) m.push('semis_abri');
    if (c.parcours.plant) m.push('plant');
    return m;
  }
  var NOMS_MODES = { semis_place: 'Semé dehors (en place)', semis_abri: 'Semé sous abri', plant: 'Plant mis en terre' };
  function gesteDuMode(mode) { return mode === 'plant' ? 'plantation' : mode; }

  /* ---------- Climat ---------- */
  function zone(id) { return CLIMATS.zones[id] || CLIMATS.zones[CLIMATS.reference]; }
  function decalage(mmjj, zoneId) {
    var z = zone(zoneId), mois = +mmjj.split('-')[0];
    return mois <= 7 ? z.decalagePrintemps : z.decalageAutomne;
  }
  function dateClimat(annee, mmjj, zoneId) { return ajouterJours(dateMMJJ(annee, mmjj), decalage(mmjj, zoneId)); }

  /** Périodes réelles (dates) d'un geste pour une zone, sur l'année et ses voisines */
  function periodes(c, geste, zoneId, annee) {
    var d = c.demarrage[geste]; if (!d) return [];
    var res = [];
    [annee - 1, annee, annee + 1].forEach(function (y) {
      d.fenetres.forEach(function (f) {
        var du = dateClimat(y, f.du, zoneId), au = dateClimat(y, f.au, zoneId);
        if (au < du) au = dateClimat(y + 1, f.au, zoneId);
        res.push({
          du: du, au: au,
          top: (f.top || []).map(function (t) { return { du: dateClimat(y, t[0], zoneId), au: dateClimat(y, t[1], zoneId) }; })
        });
      });
    });
    return res;
  }

  /** Niveau « climatique » (année normale) pour un geste à une date */
  function niveauClimatique(c, geste, date, zoneId) {
    var d = jourDe(date), ps = periodes(c, geste, zoneId, d.getFullYear());
    var marge = REGLES.margeConditionsJours, z = zone(zoneId);
    var meilleur = { niveau: 0, libelle: 'hors saison', raison: '' };
    var prochaine = null;
    ps.forEach(function (p) {
      if (p.du > d && (!prochaine || p.du < prochaine)) prochaine = p.du;
      var dedans = d >= p.du && d <= p.au;
      if (dedans) {
        var top = p.top.some(function (t) { return d >= t.du && d <= t.au; });
        var n = top ? 3 : 2;
        if (n > meilleur.niveau) meilleur = {
          niveau: n, libelle: NIVEAUX[n],
          raison: top ? 'pleine saison en climat ' + z.nom.toLowerCase().replace(' (référence)', '') : 'dans la période habituelle (jusqu’au ' + formatDate(p.au) + ')'
        };
      } else if (meilleur.niveau < 1) {
        var avant = ecartJours(d, p.du), apres = ecartJours(p.au, d);
        if (avant > 0 && avant <= marge) {
          meilleur = { niveau: 1, libelle: NIVEAUX[1], raison: geste === 'semis_abri' ? 'un peu tôt : possible au chaud et avec beaucoup de lumière' : 'un peu tôt : possible si le temps est doux, sous voile de protection' };
        } else if (apres > 0 && apres <= marge) {
          meilleur = { niveau: 1, libelle: NIVEAUX[1], raison: 'un peu tard : encore possible, mais la culture aura moins de temps' };
        }
      }
    });
    if (meilleur.niveau === 0) {
      meilleur.raison = prochaine ? 'hors saison, prochaine période à partir du ' + formatDate(prochaine) : 'hors saison';
    }
    meilleur.prochaine = prochaine;
    return meilleur;
  }

  /* ---------- Météo ---------- */
  function joursMeteo(meteo, depuis, nb) {
    if (!meteo || !meteo.jours) return [];
    var a = isoDate(jourDe(depuis)), b = isoDate(ajouterJours(jourDe(depuis), nb - 1));
    return meteo.jours.filter(function (j) { return j.date >= a && j.date <= b; });
  }
  function dateHeure(s) { var p = s.split('T'), d = p[0].split('-'), h = (p[1] || '00:00').split(':'); return new Date(+d[0], +d[1] - 1, +d[2], +h[0], +h[1] || 0); }

  /**
   * Conseil pour un geste à une date : niveau climatique, affiné par la météo
   * des prochains jours pour les gestes faits dehors.
   */
  function conseilGeste(c, geste, date, zoneId, meteo) {
    var clim = niveauClimatique(c, geste, date, zoneId);
    var r = { geste: geste, nomGeste: nomGeste(c, geste), niveau: clim.niveau, libelle: clim.libelle, raison: clim.raison, climatique: clim.niveau, affine: false, meteoIndisponible: false, prochaine: clim.prochaine };
    if (geste === 'semis_abri') { r.affine = true; if (r.niveau > 0) r.note = 'À l’intérieur, la météo extérieure compte peu.'; return r; }
    var jours = joursMeteo(meteo, date, REGLES.horizonMeteoJours);
    if (jours.length < 2) {
      r.meteoIndisponible = true;
      if (r.niveau === 3) { r.niveau = 2; r.libelle = NIVEAUX[2]; }
      r.note = 'Conseil du jour non affiné : météo indisponible.';
      return r;
    }
    r.affine = true;
    var plusFroid = jours.reduce(function (a, j) { return j.tmin < a.tmin ? j : a; });
    var plusChaud = jours.reduce(function (a, j) { return j.tmax > a.tmax ? j : a; });
    var tmin = plusFroid.tmin, f = c.froid, quandFroid = formatJour(lireDate(plusFroid.date));
    if (clim.niveau === 0) {
      r.libelle = 'hors saison';
      return r;
    }
    if (tmin <= f.gelTolere) {
      r.niveau = 0; r.libelle = 'attendre';
      r.raison = (tmin <= 0 ? 'gel annoncé' : 'risque de gelée au sol') + ' (' + fmtT(tmin) + ' ' + quandFroid + ')';
      return r;
    }
    if (tmin < f.nuitMin) {
      r.niveau = 0; r.libelle = 'attendre';
      r.raison = 'nuits trop fraîches (' + fmtT(tmin) + ' annoncés ' + quandFroid + ')';
      return r;
    }
    var gene = [];
    if (tmin < f.nuitIdeale) gene.push('nuits fraîches (' + fmtT(tmin) + ') : protège avec un voile la nuit');
    if (geste === 'semis_place' && c.chaleur && c.chaleur.semisMax && plusChaud.tmax > c.chaleur.semisMax) gene.push('chaleur annoncée (' + fmtT(plusChaud.tmax) + ') : sème le soir à l’ombre et garde humide');
    if (gene.length) {
      r.niveau = Math.min(r.niveau, 1); r.libelle = NIVEAUX[r.niveau];
      r.raison = gene.join(' ; ');
      return r;
    }
    if (r.niveau === 3) r.raison += ' et météo favorable (nuits ≥ ' + fmtT(tmin) + ')';
    else r.raison += ', météo sans risque cette semaine';
    return r;
  }
  function fmtT(t) { return Math.round(t) + ' °C'; }

  /** Conseil jour par jour sur les jours couverts par les prévisions */
  function conseilParJour(c, geste, depuis, zoneId, meteo, nb) {
    var out = [];
    for (var i = 0; i < (nb || 7); i++) {
      var d = ajouterJours(jourDe(depuis), i);
      var j = joursMeteo(meteo, d, 1)[0];
      if (!j) break;
      var cg = conseilGeste(c, geste, d, zoneId, meteo);
      if (cg.meteoIndisponible) break;
      out.push({ date: d, tmin: j.tmin, tmax: j.tmax, pluie: j.pluie, niveau: cg.niveau, libelle: cg.libelle, raison: cg.raison });
    }
    return out;
  }

  /** Bandeau annuel : 36 décades avec niveau climatique */
  function bandeauAnnuel(c, geste, zoneId, annee) {
    var cases = [];
    for (var m = 0; m < 12; m++) {
      [5, 15, 25].forEach(function (j) {
        var d = new Date(annee, m, j, 12);
        cases.push({ date: d, niveau: niveauClimatique(c, geste, d, zoneId).niveau });
      });
    }
    return cases;
  }

  /* ---------- Espaces ---------- */
  function surfacePlant(c) { return c.espacement.plant * c.espacement.rang; }
  function capacite(c, espace, plantationsActives) {
    var L = +espace.longueur || 0, l = +espace.largeur || 0, ep = c.espacement.plant, er = c.espacement.rang;
    var g1 = Math.floor(L / ep) * Math.floor(l / er), g2 = Math.floor(l / ep) * Math.floor(L / er);
    var total = Math.max(g1, g2);
    if (total === 0 && L * l >= ep * er * 0.7) total = 1;
    var occupe = 0;
    (plantationsActives || []).forEach(function (p) {
      var cp = culture(p.cultureId); if (!cp) return;
      occupe += (p.quantite || 1) * surfacePlant(cp);
    });
    var libreSurface = Math.max(0, L * l - occupe);
    var libre = Math.min(total, Math.floor(libreSurface / surfacePlant(c) + 0.0001));
    if (libre === 0 && total >= 1 && libreSurface >= surfacePlant(c) * 0.7) libre = 1;
    return { total: total, libre: libre };
  }
  function compatibilite(c, espace) {
    var raisons = [], notes = [];
    var soleil = espace.soleil || 'plein';
    if (c.soleil.indexOf(soleil) < 0) raisons.push(soleil === 'ombre' ? 'trop d’ombre' : 'demande le plein soleil');
    if (espace.type === 'bac') {
      var p = +espace.profondeur || 0;
      if (!c.bac.possible) raisons.push('déconseillé en bac');
      else if (p && p < c.bac.profondeurMin) {
        if (c.id === 'carotte' && p >= 15) notes.push('bac peu profond : choisis une carotte ronde (type Marché de Paris)');
        else raisons.push('bac trop peu profond (' + c.bac.profondeurMin + ' cm conseillés)');
      }
    }
    if (capacite(c, espace, []).total < 1) raisons.push('espace trop petit (' + c.espacement.plant + ' × ' + c.espacement.rang + ' cm par plant)');
    if (espace.pluie === 'abri') notes.push('sous abri : pense à arroser, la pluie ne l’atteint pas');
    return { ok: raisons.length === 0, raisons: raisons, notes: notes };
  }

  function phraseDemarrage(c, g) {
    var com = c.demarrage[g].comment || GESTES[g].nom;
    return com;
  }

  /** Suggestions « Quoi planter cette semaine ? » pour un espace (ou sans espace) */
  function suggestions(espace, date, zoneId, meteo, plantationsActives) {
    var res = [];
    CULTURES.forEach(function (c) {
      var compat = espace ? compatibilite(c, espace) : { ok: true, raisons: [], notes: [] };
      var conseils = gestesDe(c).map(function (g) { return conseilGeste(c, g, date, zoneId, meteo); });
      var best = conseils.reduce(function (a, b) {
        if (b.niveau !== a.niveau) return b.niveau > a.niveau ? b : a;
        return (b.geste === 'semis_place' || (b.geste === 'plantation' && a.geste === 'semis_abri')) ? b : a;
      });
      var cap = espace ? capacite(c, espace, plantationsActives || []) : null;
      res.push({ culture: c, compat: compat, conseils: conseils, meilleur: best, capacite: cap, demarrage: phraseDemarrage(c, best.geste) });
    });
    return res.sort(function (a, b) {
      if (a.compat.ok !== b.compat.ok) return a.compat.ok ? -1 : 1;
      return b.meilleur.niveau - a.meilleur.niveau || a.culture.nom.localeCompare(b.culture.nom);
    });
  }

  /* ---------- Suivi des cultures ---------- */
  function facteurVariete(c, varieteId) {
    if (!varieteId) return 1;
    var v = (c.varietes || []).filter(function (x) { return x.id === varieteId; })[0];
    return v ? v.facteur : 1;
  }
  function texteEtape(c, etape, cle) {
    return (c.etapes && c.etapes[etape] && c.etapes[etape][cle]) || (ETAPES[etape] && ETAPES[etape][cle]) || '';
  }
  function prochaineOccurrence(mmjj, apres, zoneId) {
    var y = apres.getFullYear(), d = dateClimat(y, mmjj, zoneId);
    if (d < jourDe(apres)) d = dateClimat(y + 1, mmjj, zoneId);
    return d;
  }

  /**
   * Calcule la chronologie d'une plantation : pour chaque étape, date observée
   * ou fenêtre estimée. Les estimations repartent de la dernière observation réelle.
   */
  function chronologie(p, zoneId, maintenant) {
    var c = culture(p.cultureId), parcours = c.parcours[p.mode] || [];
    var f = facteurVariete(c, p.varieteId), depart = lireDate(p.date);
    var obs = p.observations || {};
    if (p.premiereRecolte) obs = Object.assign({}, obs, { recolte: p.premiereRecolte });
    var dernierObs = -1;
    parcours.forEach(function (s, i) { if (obs[s.etape]) dernierObs = i; });
    var centre = depart, variance = 0, etapes = [];
    parcours.forEach(function (s, i) {
      var e = { etape: s.etape, titre: (ETAPES[s.etape] || {}).titre, bouton: (ETAPES[s.etape] || {}).bouton };
      if (obs[s.etape]) {
        var d = lireDate(obs[s.etape]);
        centre = d; variance = 0;
        e.observe = d; e.du = d; e.au = d; e.statut = 'fait';
      } else {
        var moy = (s.j[0] + s.j[1]) / 2 * f, dem = (s.j[1] - s.j[0]) / 2 * f;
        centre = ajouterJours(centre, moy); variance += dem * dem;
        var ec = Math.sqrt(variance);
        var du = ajouterJours(centre, -ec), au = ajouterJours(centre, ec);
        if (s.calendaire) {
          var cdu = prochaineOccurrence(s.calendaire.du, i === 0 ? depart : (etapes[i - 1].du), zoneId);
          var cau = ajouterJours(cdu, ecartJours(dateMMJJ(2001, s.calendaire.du), dateMMJJ(2001, s.calendaire.au)) + (decalage(s.calendaire.au, zoneId) - decalage(s.calendaire.du, zoneId)));
          if (du < cdu) {
            var nau = au > cau ? au : cau;
            du = cdu; au = nau;
            centre = new Date((du.getTime() + au.getTime()) / 2);
            variance = Math.pow(ecartJours(du, au) / 2, 2);
          }
        }
        e.du = jourDe(du); e.au = jourDe(au);
        e.statut = i < dernierObs ? 'passe' : 'attendu';
      }
      etapes.push(e);
    });
    var prochaine = null;
    for (var i = dernierObs + 1; i < etapes.length; i++) { prochaine = etapes[i]; break; }
    return { culture: c, etapes: etapes, prochaine: prochaine, depart: depart, recolte: etapes.filter(function (e) { return e.etape === 'recolte'; })[0] };
  }

  function dateEtape(chrono, p, etape) {
    var depart = p.mode === 'plant' ? 'plantation' : 'semis';
    if (etape === depart) return { date: chrono.depart, observe: true };
    var e = chrono.etapes.filter(function (x) { return x.etape === etape; })[0];
    if (!e) return null;
    if (e.observe || e.statut === 'passe') return { date: e.observe || e.du, observe: true };
    return { date: e.du, observe: false };
  }

  /** Fiche de suivi complète d'une plantation */
  function suivi(p, zoneId, maintenant, meteo) {
    var auj = jourDe(maintenant), chrono = chronologie(p, zoneId, maintenant), c = chrono.culture;
    var r = { plantation: p, culture: c, chronologie: chrono, gestes: [] };
    var pro = chrono.prochaine;
    if (p.terminee) { r.statut = 'terminee'; return r; }
    if (p.premiereRecolte) {
      r.statut = 'en_recolte';
      r.message = c.recolte.multiple ? 'Récolte en cours' + (c.recolte.duree ? ' (' + c.recolte.duree + ')' : '') + '. Continue de cueillir au fur et à mesure.' : '';
    } else if (pro) {
      r.statut = 'en_cours';
      r.prochaine = {
        etape: pro.etape, titre: pro.titre, bouton: pro.bouton, du: pro.du, au: pro.au,
        fenetre: formatFenetre(pro.du, pro.au),
        normal: texteEtape(c, pro.etape, 'normal'),
        enRetard: auj > pro.au,
        controle: auj > pro.au ? texteEtape(c, pro.etape, 'controle') : ''
      };
      if (pro.etape === 'plantation') {
        r.prochaine.conseilPlantation = conseilGeste(c, 'plantation', auj, zoneId, meteo);
      }
    }
    var rec = chrono.recolte;
    if (rec && !p.premiereRecolte) {
      r.recolte = { du: rec.du, au: rec.au, fenetre: formatFenetre(rec.du, rec.au), approche: ecartJours(auj, rec.du) <= REGLES.approcheRecolteJours, signe: c.recolte.signe };
    }
    (c.gestes || []).forEach(function (g) {
      var ancre = dateEtape(chrono, p, g.apres);
      if (!ancre) return;
      if (!ancre.observe && !(g.apres === 'recolte')) return;
      if (g.apres === 'recolte' && p.premiereRecolte) return;
      var debut = ajouterJours(ancre.date, g.j[0]), fin = ajouterJours(ancre.date, g.j[1]);
      if (auj >= jourDe(debut) && auj <= jourDe(fin)) r.gestes.push(g);
    });
    return r;
  }

  /** Étapes qu'on peut confirmer à la main (dans l'ordre du parcours) */
  function etapesConfirmables(p) {
    var c = culture(p.cultureId);
    return (c.parcours[p.mode] || []).map(function (s) { return s.etape; }).filter(function (e) { return e !== 'recolte'; });
  }

  /* ---------- Arrosage ---------- */
  function facteurChaleur(tmax) {
    var t = REGLES.arrosage.chaleur;
    for (var i = 0; i < t.length; i++) if (tmax >= t[i].min) return t[i].f;
    return 1;
  }

  /**
   * Estime quand vérifier la terre d'un espace.
   *  espace : { id, type: 'bac'|'pleine_terre', pluie: 'ciel_ouvert'|'abri' }
   *  actives : plantations en cours dans cet espace
   *  arrosages : [{ date: ISO datetime }] de cet espace
   *  reports : [{ date: ISO datetime }] « Terre encore humide »
   */
  function arrosage(espace, actives, arrosages, reports, meteo, zoneId, maintenant) {
    var R = REGLES.arrosage, type = espace.type === 'bac' ? 'bac' : 'pleine_terre';
    var nomLieu = type === 'bac' ? 'du bac' : 'de la parcelle';
    var res = { espace: espace, raisons: [], dernierArrosage: null };
    var derniers = (arrosages || []).map(function (a) { return new Date(a.date); }).sort(function (a, b) { return b - a; });
    res.dernierArrosage = derniers[0] || null;
    if (!actives || !actives.length) { res.statut = 'vide'; res.conseil = 'Aucune culture en cours : pas d’arrosage à prévoir.'; return res; }

    var fStade = Infinity, aArroser = [], stop = [];
    actives.forEach(function (p) {
      var c = culture(p.cultureId), s = suivi(p, zoneId, maintenant, meteo), f = R.facteurBesoin[c.arrosage.besoin] || 1;
      var pro = s.prochaine && s.prochaine.etape;
      if (c.arrosage.stopAvantRecolte && s.recolte && ecartJours(maintenant, s.recolte.du) <= c.arrosage.stopAvantRecolte) {
        stop.push(c.nom); return;
      }
      if (pro === 'levee' && p.mode !== 'plant') { f = Math.min(f, R.facteurStade.semisNonLeve); res.raisons.push(c.nom + ' pas encore levé : surface à garder humide'); }
      else if (pro === 'levee' || pro === 'reprise') { f = Math.min(f, R.facteurStade.reprise); res.raisons.push(c.nom + ' en reprise : racines encore courtes'); }
      else if (c.arrosage.besoin === 'eleve' && (pro === 'fruits' || pro === 'recolte' || s.statut === 'en_recolte')) { f = Math.min(f, R.facteurStade.fructificationGourmande); res.raisons.push(c.nom + ' en production : gros besoin d’eau'); }
      aArroser.push(c.nom);
      fStade = Math.min(fStade, f);
    });
    if (stop.length) res.raisons.push(stop.join(', ') + ' : ne plus arroser, la récolte approche');
    if (!aArroser.length) { res.statut = 'pas_arroser'; res.conseil = 'Ne plus arroser : la récolte approche (meilleure conservation).'; return res; }

    var reference = res.dernierArrosage, depuisPlantation = false;
    if (!reference) {
      reference = actives.map(function (p) { var d = lireDate(p.date); d.setHours(18); return d; }).sort(function (a, b) { return b - a; })[0];
      depuisPlantation = true;
      res.raisons.push('je compte depuis le semis ou la plantation');
    }

    // Chaleur : du jour de référence à demain
    var fChaleur = 1;
    if (meteo && meteo.jours && meteo.jours.length) {
      var a = isoDate(jourDe(reference)), b = isoDate(ajouterJours(jourDe(maintenant), 1));
      var js = meteo.jours.filter(function (j) { return j.date >= a && j.date <= b; });
      if (js.length) {
        var tmax = Math.max.apply(null, js.map(function (j) { return j.tmax; }));
        fChaleur = facteurChaleur(tmax);
        if (fChaleur < 1) res.raisons.push('chaleur (' + fmtT(tmax) + ') : la terre sèche plus vite');
        else if (fChaleur > 1) res.raisons.push('temps frais (' + fmtT(tmax) + ') : la terre sèche lentement');
      }
      res.meteoUtilisee = true;
    } else {
      res.meteoUtilisee = false;
      res.raisons.push('météo indisponible : estimation sans chaleur ni pluie');
    }
    var intervalle = Math.max(R.intervalleMin, Math.min(R.intervalleMax, R.intervalleBase[type] * fStade * fChaleur));
    res.intervalleJours = intervalle;

    // Pluie tombée (uniquement si l'espace y est exposé, et uniquement le passé)
    var refEffective = reference, partielle = 0, totalPluie = 0;
    if (espace.pluie === 'abri') {
      res.raisons.push('sous abri : la pluie ne compte pas');
    } else if (meteo && meteo.heures) {
      var seuil = R.seuilPluie[type], cumul = 0;
      meteo.heures.forEach(function (h) {
        var t = dateHeure(h.t);
        if (t <= reference || t > maintenant || !h.pluie) return;
        cumul += h.pluie; totalPluie += h.pluie;
        if (cumul >= seuil) { refEffective = t; cumul = 0; }
      });
      partielle = cumul;
      if (refEffective !== reference) res.raisons.push('pluie récente (' + arrondi(totalPluie) + ' mm) : compte comme un arrosage');
      else if (totalPluie >= 1) res.raisons.push('petite pluie (' + arrondi(totalPluie) + ' mm) : prise en compte en partie');
      res.pluieRecue = totalPluie;
    }
    var prochaine = new Date(refEffective.getTime() + intervalle * JOUR * (1 + 0.5 * Math.min(1, partielle / R.seuilPluie[type])));

    // « Terre encore humide »
    var dernierReport = (reports || []).map(function (r) { return new Date(r.date); }).filter(function (d) { return d > refEffective; }).sort(function (a, b) { return b - a; })[0];
    if (dernierReport) {
      var apresReport = new Date(dernierReport.getTime() + Math.max(R.intervalleMin, intervalle / 2) * JOUR);
      if (apresReport > prochaine) prochaine = apresReport;
      res.raisons.push('terre encore humide le ' + formatDate(dernierReport) + ' : vérification reportée');
    }
    res.prochaine = prochaine;

    // Pluie annoncée : influe sur le conseil, n'est jamais comptée comme reçue
    var annoncee = 0;
    if (espace.pluie !== 'abri' && meteo && meteo.heures) {
      var lim = new Date(maintenant.getTime() + JOUR);
      meteo.heures.forEach(function (h) { var t = dateHeure(h.t); if (t > maintenant && t <= lim) annoncee += h.pluie || 0; });
    }
    res.pluieAnnoncee = annoncee;

    if (maintenant >= prochaine) {
      res.statut = 'a_verifier';
      res.conseil = 'Vérifie la terre ' + nomLieu + '. Si elle est sèche, arrose.';
      if (annoncee >= R.pluieAnnonceeSignificative) {
        res.conseil += ' De la pluie est annoncée (' + arrondi(annoncee) + ' mm d’ici demain) : si la terre n’est sèche qu’en surface, tu peux l’attendre.';
      }
    } else {
      res.statut = 'ok';
      res.conseil = 'Prochaine vérification : ' + quand(prochaine, maintenant) + '.';
      if (annoncee >= R.pluieAnnonceeSignificative) res.conseil += ' Pluie annoncée (' + arrondi(annoncee) + ' mm) : elle sera comptée une fois tombée.';
    }
    return res;
  }
  function arrondi(x) { return Math.round(x * 10) / 10; }

  /** Cultures à proposer quand un espace se libère */
  function apresCulture(cultureId, espace, date, zoneId, meteo, actives) {
    var c = culture(cultureId), ids = c.ensuite || [];
    var toutes = suggestions(espace, date, zoneId, meteo, actives || []);
    var proposees = toutes.filter(function (s) { return s.compat.ok && s.meilleur.niveau >= 1; });
    proposees.sort(function (a, b) {
      var ia = ids.indexOf(a.culture.id) >= 0 ? 0 : 1, ib = ids.indexOf(b.culture.id) >= 0 ? 0 : 1;
      return ia - ib || b.meilleur.niveau - a.meilleur.niveau;
    });
    return proposees.slice(0, 5);
  }

  var Moteur = {
    REGLES: REGLES, NIVEAUX: NIVEAUX, GESTES: GESTES, NOMS_MODES: NOMS_MODES,
    cultures: function () { return CULTURES; }, culture: culture, gestesDe: gestesDe, modesDe: modesDe, nomGeste: nomGeste, gesteDuMode: gesteDuMode,
    zone: zone, niveauClimatique: niveauClimatique, conseilGeste: conseilGeste, conseilParJour: conseilParJour, bandeauAnnuel: bandeauAnnuel,
    capacite: capacite, compatibilite: compatibilite, suggestions: suggestions, apresCulture: apresCulture,
    chronologie: chronologie, suivi: suivi, etapesConfirmables: etapesConfirmables, texteEtape: texteEtape,
    arrosage: arrosage,
    dates: { lire: lireDate, iso: isoDate, ajouter: ajouterJours, ecart: ecartJours, format: formatDate, formatJour: formatJour, fenetre: formatFenetre, quand: quand, jour: jourDe }
  };
  racine.Moteur = Moteur;
  if (typeof module !== 'undefined') module.exports = Moteur;
})(typeof window !== 'undefined' ? window : globalThis);

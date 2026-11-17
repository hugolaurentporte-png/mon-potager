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
  var TERRAIN = racine.TERRAIN || (typeof require !== 'undefined' && require('../data/terrain.js'));
  var ASSOCIATIONS = racine.ASSOCIATIONS || (typeof require !== 'undefined' && require('../data/associations.js'));
  var PROBLEMES = racine.PROBLEMES || (typeof require !== 'undefined' && require('../data/problemes.js'));
  var REGIONS = racine.REGIONS || (typeof require !== 'undefined' && require('../data/regions.js'));
  if (REGIONS && !racine.REGIONS) REGIONS.enrichir(CULTURES);

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
    var o = espace.orientation && TERRAIN.orientations[espace.orientation], bonus = 0;
    if (o) {
      if ((o.evite || []).indexOf(c.id) >= 0) raisons.push('exposition nord : trop fraîche pour cette culture');
      else if ((o.aime || []).indexOf(c.id) >= 0) { bonus += 1; notes.push('se plaît en exposition ' + o.nom.toLowerCase()); }
    }
    var sol = espace.sol && TERRAIN.sols[espace.sol];
    if (sol && sol.cultures && sol.cultures[c.id]) notes.push(sol.cultures[c.id]);
    return { ok: raisons.length === 0, raisons: raisons, notes: notes, bonus: bonus };
  }

  function phraseDemarrage(c, g) {
    var com = c.demarrage[g].comment || GESTES[g].nom;
    return com;
  }

  /** Suggestions « Quoi planter cette semaine ? » pour un espace (ou sans espace) */
  /** Bons voisins et voisins à éviter parmi les cultures déjà présentes */
  function voisinage(cultureId, actives) {
    var amis = [], eviter = [], vus = {};
    actives.forEach(function (p) {
      if (p.cultureId === cultureId || vus[p.cultureId]) return;
      vus[p.cultureId] = true;
      var r = ASSOCIATIONS.entre(cultureId, p.cultureId), c = culture(p.cultureId);
      if (!r || !c) return;
      if (r.type === 'ami') amis.push(c.nom); else eviter.push({ nom: c.nom, raison: r.raison });
    });
    return { amis: amis, aEviter: eviter };
  }
  function suggestions(espace, date, zoneId, meteo, plantationsActives, regionId) {
    var res = [];
    CULTURES.forEach(function (c) {
      var compat = espace ? compatibilite(c, espace) : { ok: true, raisons: [], notes: [] };
      var conseils = gestesDe(c).map(function (g) { return conseilGeste(c, g, date, zoneId, meteo); });
      var best = conseils.reduce(function (a, b) {
        if (b.niveau !== a.niveau) return b.niveau > a.niveau ? b : a;
        return (b.geste === 'semis_place' || (b.geste === 'plantation' && a.geste === 'semis_abri')) ? b : a;
      });
      var cap = espace ? capacite(c, espace, plantationsActives || []) : null;
      var voisins = voisinage(c.id, plantationsActives || []);
      var score = (compat.bonus || 0) + voisins.amis.length - 2 * voisins.aEviter.length;
      var spe = regionId ? REGIONS.specialitesDe(regionId).filter(function (x) { return x.culture === c.id; }).map(function (x) { return x.variete; }) : [];
      if (spe.length) score += 0.5;
      res.push({ culture: c, compat: compat, conseils: conseils, meilleur: best, capacite: cap, demarrage: phraseDemarrage(c, best.geste), voisins: voisins, regionales: spe, score: score });
    });
    return res.sort(function (a, b) {
      if (a.compat.ok !== b.compat.ok) return a.compat.ok ? -1 : 1;
      return b.meilleur.niveau - a.meilleur.niveau || b.score - a.score || a.culture.nom.localeCompare(b.culture.nom);
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

  /* ---------- Météo détaillée ---------- */
  function heuresEntre(meteo, debut, fin) {
    if (!meteo || !meteo.heures) return [];
    return meteo.heures.filter(function (h) { var t = dateHeure(h.t); return t >= debut && t < fin; }).map(function (h) { return Object.assign({ date: dateHeure(h.t) }, h); });
  }
  function heureTxt(d) { return d.getHours() + ' h'; }
  /** Heures d'une journée (pour le détail d'un jour) */
  function heuresDuJour(meteo, iso) {
    var d = lireDate(iso); d.setHours(0, 0, 0, 0);
    return heuresEntre(meteo, d, new Date(d.getTime() + JOUR)).map(function (h) { return Object.assign(h, ciel(h.code)); });
  }
  /** Épisodes de pluie à venir (heures consécutives avec pluie) sur `heures` heures */
  function episodesPluie(meteo, maintenant, duree) {
    var hs = heuresEntre(meteo, maintenant, new Date(maintenant.getTime() + (duree || 48) * 3600000));
    var eps = [], cur = null;
    hs.forEach(function (h) {
      if ((h.pluie || 0) >= 0.2) {
        if (!cur) { cur = { debut: h.date, fin: h.date, total: 0, probaMax: 0 }; eps.push(cur); }
        cur.fin = h.date; cur.total += h.pluie; cur.probaMax = Math.max(cur.probaMax, h.proba || 0);
      } else if (cur && (h.date - cur.fin) >= 2 * 3600000) cur = null;
    });
    return eps.filter(function (e) { return e.total >= 0.5; }).map(function (e) {
      e.fin = new Date(e.fin.getTime() + 3600000);
      var n = ecartJours(maintenant, e.debut), jour = n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : JOURS[e.debut.getDay()];
      e.texte = 'Pluie ' + jour + ' de ' + heureTxt(e.debut) + ' à ' + heureTxt(e.fin) + ' : ' + arrondi(e.total) + ' mm' + (e.probaMax ? ' (' + e.probaMax + ' % de risque)' : '');
      return e;
    });
  }
  /** Prochaines nuits : température minimale, heure, durée du gel */
  function nuits(meteo, maintenant, nb) {
    var res = [];
    for (var i = 0; i < (nb || 3); i++) {
      var soir = jourDe(ajouterJours(maintenant, i)); soir.setHours(18, 0, 0, 0);
      var matin = new Date(soir.getTime() + 16 * 3600000);
      if (matin <= maintenant) continue;
      var hs = heuresEntre(meteo, soir, matin).filter(function (h) { return h.temp != null; });
      if (hs.length < 8) continue;
      var min = hs.reduce(function (a, h) { return h.temp < a.temp ? h : a; });
      var gel = hs.filter(function (h) { return h.temp <= 0; });
      var claire = hs.filter(function (h) { return h.nuages != null && h.nuages < 30; }).length >= hs.length / 2;
      res.push({ soir: soir, min: min.temp, heureMin: min.date, debutGel: gel[0] && gel[0].date, finGel: gel.length ? new Date(gel[gel.length - 1].date.getTime() + 3600000) : null, heuresGel: gel.length, claire: claire,
        nom: i === 0 ? 'cette nuit' : i === 1 ? 'demain soir' : JOURS[soir.getDay()] + ' soir' });
    }
    return res;
  }
  /** Canicule : au moins 3 jours ≥ 30 °C consécutifs dans les prévisions */
  function canicule(meteo, maintenant) {
    var auj = isoDate(jourDe(maintenant)), js = (meteo && meteo.jours || []).filter(function (j) { return j.date >= auj; }), serie = [], best = [];
    js.forEach(function (j) { if (j.tmax >= 30) { serie.push(j); if (serie.length > best.length) best = serie.slice(); } else serie = []; });
    return best.length >= 3 ? { debut: lireDate(best[0].date), jours: best.length, tmax: Math.max.apply(null, best.map(function (j) { return j.tmax; })), nuitsChaudes: best.filter(function (j) { return j.tmin >= 20; }).length } : null;
  }

  function nomJourCourt(d, maintenant) {
    var n = ecartJours(maintenant, d);
    return n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : JOURS[d.getDay()] + ' ' + d.getDate();
  }
  function hMin(d) { var m = d.getMinutes(); return d.getHours() + ' h' + (m ? ' ' + (m < 10 ? '0' : '') + m : ''); }

  /* ---------- Température de la terre ---------- */
  // Température minimale de la terre (à 6 cm) pour semer dehors ou planter. Valeurs indicatives.
  REGLES.tempSol = {
    semis_place: { radis: 8, laitue: 8, mache: 5, epinard: 5, carotte: 8, betterave: 10, oignon: 8, 'haricot-nain': 12, courgette: 14, concombre: 15 },
    plantation: { tomate: 12, 'tomate-cerise': 12, poivron: 15, courgette: 14, concombre: 15 }
  };
  function solParJour(meteo) {
    var j = {};
    (meteo && meteo.heures || []).forEach(function (h) { if (h.sol == null) return; var k = h.t.slice(0, 10); (j[k] = j[k] || []).push(h.sol); });
    var r = {}; Object.keys(j).forEach(function (k) { if (j[k].length >= 12) r[k] = j[k].reduce(function (a, b) { return a + b; }, 0) / j[k].length; });
    return r;
  }
  /** Terre : température actuelle, tendance, et ce qu'on peut semer ou planter */
  function temperatureSol(meteo, maintenant) {
    var pj = solParJour(meteo), auj = isoDate(jourDe(maintenant));
    if (pj[auj] == null) return null;
    var maintenantH = (meteo.heures || []).filter(function (h) { return h.sol != null && dateHeure(h.t) <= maintenant; }).pop();
    var futurs = Object.keys(pj).filter(function (k) { return k >= auj; }).sort();
    var cultures = [];
    ['semis_place', 'plantation'].forEach(function (geste) {
      var t = REGLES.tempSol[geste];
      Object.keys(t).forEach(function (id) {
        var c = culture(id); if (!c) return;
        var ok = pj[auj] >= t[id], date = null;
        if (!ok) futurs.some(function (k) { if (pj[k] >= t[id]) { date = lireDate(k); return true; } return false; });
        cultures.push({ culture: c, geste: geste, min: t[id], ok: ok, date: date });
      });
    });
    var dernier = futurs[futurs.length - 1];
    return { actuel: maintenantH ? maintenantH.sol : pj[auj], moyenne: pj[auj], tendance: pj[dernier] - pj[auj], jours: futurs.map(function (k) { return { date: k, moyenne: pj[k] }; }), cultures: cultures, gele: maintenantH ? maintenantH.sol <= 0 : pj[auj] <= 0 };
  }

  /* ---------- Bons créneaux pour les gestes ---------- */
  REGLES.creneaux = {
    traiter: { titre: 'Traiter (purin, bouillie, savon noir)', icone: '🧴', pourquoi: 'ni pluie pendant 6 h, ni vent, ni forte chaleur' },
    repiquer: { titre: 'Repiquer ou planter', icone: '🌱', pourquoi: 'temps doux et couvert (ou fin de journée), pas de gel la nuit suivante' },
    semer: { titre: 'Semer dehors', icone: '🫘', pourquoi: 'terre ni gelée ni détrempée, pas d’averse juste après' },
    recolter: { titre: 'Récolter pour conserver', icone: '🧺', pourquoi: 'temps sec depuis la veille, légumes secs (meilleure conservation)' }
  };
  function creneaux(meteo, maintenant) {
    if (!meteo || !meteo.heures) return [];
    var debut = new Date(maintenant.getTime()); debut.setMinutes(0, 0, 0);
    var tous = heuresEntre(meteo, new Date(debut.getTime() - 24 * 3600000), new Date(debut.getTime() + 8 * JOUR)).filter(function (h) { return h.temp != null; });
    var i0 = 0; while (i0 < tous.length && tous[i0].date < debut) i0++;
    var fin7 = new Date(debut.getTime() + 7 * JOUR);
    // Heures de jour : du lever + 30 min au coucher − 30 min (midi solaire selon la longitude)
    var dureeJour = {}; (meteo.jours || []).forEach(function (j) { if (j.jour) dureeJour[j.date] = j.jour; });
    var lon = meteo.lon == null ? 2 : meteo.lon;
    function bornesJour(d) {
      var dj = dureeJour[isoDate(d)] || 12, midi = 12 - lon / 15 - d.getTimezoneOffset() / 60;
      return { lever: midi - dj / 2 + 0.5, coucher: midi + dj / 2 - 0.5 };
    }
    function deJour(d) { var b = bornesJour(d), H = d.getHours(); return H >= Math.max(7, Math.ceil(b.lever)) && H + 1 <= Math.min(21, Math.floor(b.coucher) + 1) ; }
    function somme(a, b) { var s = 0; for (var k = Math.max(0, a); k < Math.min(tous.length, b); k++) s += tous[k].pluie || 0; return s; }
    function minTemp(a, b) { var m = Infinity; for (var k = a; k < Math.min(tous.length, b); k++) m = Math.min(m, tous[k].temp); return m; }
    var regles = {
      traiter: function (h, i) { return i + 6 <= tous.length && somme(i, i + 6) < 0.2 && (h.vent == null || h.vent <= 15) && (h.rafales == null || h.rafales <= 35) && h.temp >= 8 && h.temp <= 25; },
      repiquer: function (h, i) { var H = h.date.getHours(); return h.temp >= 8 && h.temp <= 24 && ((h.nuages != null && h.nuages >= 60) || H >= bornesJour(h.date).coucher - 3) && somme(i, i + 2) < 1 && (h.vent == null || h.vent <= 25) && minTemp(i, i + 16) > 1; },
      semer: function (h, i) { return h.temp >= 6 && (h.sol == null || h.sol > 2) && somme(i - 24, i) < 15 && somme(i, i + 6) < 5 && (h.vent == null || h.vent <= 30); },
      recolter: function (h, i) { var H = h.date.getHours(); return H >= 10 && somme(i - 18, i + 1) < 0.2 && h.temp >= 5 && h.temp <= 28; }
    };
    return Object.keys(regles).map(function (id) {
      var run = null, best = null;
      for (var i = i0; i < tous.length && tous[i].date < fin7; i++) {
        var h = tous[i], ok = deJour(h.date) && regles[id](h, i);
        var memeJour = run && isoDate(run.fin) === isoDate(h.date);
        if (ok && run && memeJour && h.date - run.fin === 3600000) run.fin = h.date;
        else if (ok) run = { debut: h.date, fin: h.date };
        else run = null;
        if (run && (run.fin - run.debut) >= 3600000) { best = { debut: run.debut, fin: run.fin }; break; }
      }
      var R = REGLES.creneaux[id], r = { id: id, titre: R.titre, icone: R.icone, pourquoi: R.pourquoi };
      if (best) {
        // prolonge le créneau trouvé jusqu'à sa vraie fin
        for (var k = 0; k < tous.length; k++) if (tous[k].date - best.fin === 3600000 && isoDate(tous[k].date) === isoDate(best.fin) && deJour(tous[k].date) && regles[id](tous[k], k)) best.fin = tous[k].date;
        r.debut = best.debut; r.fin = new Date(best.fin.getTime() + 3600000);
        r.texte = capitaliser(nomJourCourt(r.debut, maintenant)) + ' de ' + hMin(r.debut) + ' à ' + hMin(r.fin);
      } else r.texte = 'Pas de bon créneau dans les 7 prochains jours';
      return r;
    });
  }
  function capitaliser(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  /* ---------- Pluie dans les 2 prochaines heures (quart d'heure par quart d'heure) ---------- */
  function pluieProchaine(meteo, maintenant) {
    if (!meteo || !meteo.quarts || !meteo.quarts.length) return null;
    var qs = meteo.quarts.map(function (q) { return { date: dateHeure(q.t), pluie: q.pluie || 0 }; }).filter(function (q) { return q.date.getTime() + 15 * 60000 > maintenant.getTime(); }).slice(0, 8);
    if (qs.length < 4) return null;
    var seuil = 0.1, total = qs.reduce(function (a, q) { return a + q.pluie; }, 0);
    var pluvieux = qs.filter(function (q) { return q.pluie >= seuil; });
    var res = { quarts: qs, total: total }, finQ = function (q) { return new Date(q.date.getTime() + 15 * 60000); };
    if (!pluvieux.length) res.texte = 'Pas de pluie prévue dans les 2 prochaines heures : tu as le temps d’aller au jardin.';
    else {
      var dernier = pluvieux[pluvieux.length - 1], premier = pluvieux[0];
      var trou = qs.some(function (q) { return q.date > premier.date && q.date < dernier.date && q.pluie < seuil; });
      var jusque = dernier === qs[qs.length - 1] ? 'pendant les 2 prochaines heures' : 'jusqu’à ' + hMin(finQ(dernier)) + ' environ';
      var fort = qs.reduce(function (a, q) { return q.pluie > a.pluie ? q : a; });
      if (qs[0].pluie >= seuil) res.texte = (trou ? 'Pluie par moments ' : 'Il pleut en ce moment, ') + jusque + ' (' + arrondi(total) + ' mm' + (trou ? ', la plus forte vers ' + hMin(fort.date) : '') + ').';
      else res.texte = 'Pluie ' + (trou ? 'par moments ' : '') + 'à partir de ' + hMin(premier.date) + ', ' + jusque + ' (' + arrondi(total) + ' mm).';
    }
    return res;
  }

  /* ---------- Le jardin a-t-il eu soif ? (30 derniers jours) ---------- */
  function soif(passe, maintenant, nb) {
    if (!passe || !passe.length) return null;
    var auj = isoDate(jourDe(maintenant));
    var js = passe.filter(function (j) { return j.date < auj && j.et0 != null; }).slice(-(nb || 30));
    if (js.length < 10) return null;
    var pluie = 0, et0 = 0; js.forEach(function (j) { pluie += j.pluie; et0 += j.et0; });
    var sem = js.slice(-7), p7 = 0, e7 = 0; sem.forEach(function (j) { p7 += j.pluie; e7 += j.et0; });
    var ratio = et0 > 0 ? pluie / et0 : 9, verdict, texte;
    if (et0 < 15 && pluie >= et0) { verdict = 'humide'; texte = 'Période fraîche : la terre perd peu d’eau et la pluie a largement suffi. Les cultures en pleine terre n’ont pas eu soif ; seuls les bacs sous abri ont besoin de toi.'; }
    else if (ratio >= 1.2) { verdict = 'humide'; texte = 'Il est tombé plus d’eau que la terre n’en a perdu : pas de soif en pleine terre. Attention aux limaces et aux maladies.'; }
    else if (ratio >= 0.6) { verdict = 'equilibre'; texte = 'La pluie a compensé une bonne partie de l’évaporation. Les bacs et les cultures gourmandes ont pu manquer d’eau entre deux pluies.'; }
    else { verdict = 'sec'; texte = 'Période sèche : la terre a perdu bien plus d’eau qu’elle n’en a reçu. Arrose en profondeur (moins souvent mais plus copieusement) et paille le sol.'; }
    return { jours: js, pluie: pluie, et0: et0, ecart: pluie - et0, verdict: verdict, texte: texte, semaine: { pluie: p7, et0: e7 } };
  }

  /* ---------- Comparaison avec la normale ---------- */
  function normaleDe(normales, iso) { return normales && normales[iso.slice(5)]; }
  function comparaisonNormale(meteo, normales, maintenant) {
    if (!meteo || !normales) return null;
    var auj = isoDate(jourDe(maintenant)), js = (meteo.jours || []).filter(function (j) { return j.date >= auj; }).slice(0, 7);
    var e = [], n = [];
    js.forEach(function (j) { var x = normaleDe(normales, j.date); if (x) { e.push((j.tmin + j.tmax) / 2 - (x[0] + x[1]) / 2); n.push(x); } });
    if (e.length < 4) return null;
    var ecart = e.reduce(function (a, b) { return a + b; }, 0) / e.length;
    var nTmin = n.reduce(function (a, x) { return a + x[0]; }, 0) / n.length, nTmax = n.reduce(function (a, x) { return a + x[1]; }, 0) / n.length;
    var r = { ecart: ecart, normaleTmin: nTmin, normaleTmax: nTmax };
    var a = Math.abs(Math.round(ecart * 10) / 10);
    r.texte = a < 1 ? 'Les 7 prochains jours sont proches des normales de saison.' : 'Les 7 prochains jours seront ' + String(a).replace('.', ',') + ' °C plus ' + (ecart > 0 ? 'doux' : 'frais') + ' que d’habitude chez toi.';
    if (ecart >= 3) r.conseil = 'Douceur inhabituelle : la végétation peut repartir trop tôt. Ne te fie pas à la douceur pour planter des légumes frileux, un retour du froid reste possible.';
    else if (ecart <= -3) r.conseil = 'Fraîcheur inhabituelle : les levées et la croissance seront plus lentes que prévu ; les dates de récolte peuvent glisser de quelques jours.';
    var p = meteo.passe, p30 = 0, n30 = 0, k = 0;
    (p || []).filter(function (j) { return j.date < auj; }).slice(-30).forEach(function (j) { var x = normaleDe(normales, j.date); if (x) { p30 += j.pluie; n30 += x[2]; k++; } });
    if (k >= 20 && n30 > 5) {
      r.pluie30 = p30; r.normalePluie30 = n30;
      var pc = Math.round(100 * p30 / n30);
      r.textePluie = 'Pluie des 30 derniers jours : ' + Math.round(p30) + ' mm, soit ' + pc + ' % de la normale (' + Math.round(n30) + ' mm).';
    }
    return r;
  }

  /* ---------- Soleil et UV ---------- */
  function niveauUV(uv) {
    if (uv == null) return null;
    if (uv < 3) return { niveau: 'faible', texte: 'UV faibles' };
    if (uv < 6) return { niveau: 'modere', texte: 'UV modérés', conseil: 'Chapeau conseillé si tu jardines longtemps.' };
    if (uv < 8) return { niveau: 'fort', texte: 'UV forts', conseil: 'Jardine plutôt avant 11 h ou après 17 h (chapeau, crème). Ombre les semis et les repiquages tout juste faits.' };
    return { niveau: 'tres-fort', texte: 'UV très forts', conseil: 'Évite de jardiner entre 12 h et 16 h. Ombre les jeunes plants (voile, cagette) et arrose le soir.' };
  }

  /**
   * Bilan d'eau d'un espace : réserve facilement utilisable (mm), consommation
   * = évapotranspiration (ET0, Open-Meteo) × coefficient de culture, recharge
   * par la pluie tombée (si l'espace y est exposé). Renvoie null sans ET0.
   */
  REGLES.bilan = {
    reserve: { bac: { terreau: 7, defaut: 6 }, pleine_terre: { limoneux: 18, argileux: 25, sableux: 9, caillouteux: 11, terreau: 14, defaut: 15 } },
    kc: { faible: 0.6, moyen: 0.85, eleve: 1.0 }, majorationBac: 1.2, efficacitePluieBac: 0.8, seuilVerifier: 0.75, reserveSemis: 3
  };
  function bilanEau(espace, kc, fStade, reference, meteo, maintenant, semis) {
    if (!meteo || !meteo.jours || !meteo.jours.some(function (j) { return j.et0 != null; })) return null;
    var B = REGLES.bilan, type = espace.type === 'bac' ? 'bac' : 'pleine_terre';
    var reserve = (B.reserve[type][espace.sol] || B.reserve[type].defaut) * Math.max(0.4, Math.min(1, fStade));
    if (semis) reserve = Math.min(reserve, B.reserveSemis); // graines : seule la surface compte
    var o = espace.orientation && TERRAIN.orientations[espace.orientation];
    var conso = kc * (type === 'bac' ? B.majorationBac : 1) / (o ? o.facteurArrosage : 1);
    var et0 = {}; meteo.jours.forEach(function (j) { et0[j.date] = j.et0; });
    var pluie = {}; (meteo.heures || []).forEach(function (h) { pluie[h.t.slice(0, 13)] = h.pluie || 0; });
    var expose = espace.pluie !== 'abri', eff = type === 'bac' ? B.efficacitePluieBac : 1;
    var deficit = 0, t = new Date(reference.getTime()), etat = null, prochaine = null, fin = ajouterJours(maintenant, 8), recue = 0;
    t.setMinutes(0, 0, 0); t = new Date(t.getTime() + 3600000);
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    while (t <= fin) {
      var cle = isoDate(t), h = t.getHours();
      var e = et0[cle]; if (e == null) e = et0[isoDate(ajouterJours(t, -1))] || 3;
      if (h >= 8 && h < 20) deficit += e / 12 * conso;
      if (expose && t <= maintenant) {
        var mm = pluie[cle + 'T' + p2(h)] || 0;
        if (mm) { recue += mm; deficit = Math.max(0, deficit - mm * eff); }
      }
      if (t <= maintenant) etat = deficit;
      if (t > maintenant && !prochaine && deficit >= reserve * B.seuilVerifier) prochaine = new Date(t.getTime());
      t = new Date(t.getTime() + 3600000);
    }
    if (etat == null) etat = 0; // arrosé à l’instant
    if (etat >= reserve * B.seuilVerifier) prochaine = new Date(maintenant.getTime());
    return { reserve: reserve, deficit: etat, pourcentEau: Math.max(0, Math.round(100 * (1 - etat / reserve))), prochaine: prochaine, pluieRecue: recue };
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

    var fStade = Infinity, aArroser = [], stop = [], kcMax = 0, semisNonLeve = false;
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
      var k = REGLES.bilan.kc[c.arrosage.besoin] || 0.85;
      if (c.arrosage.besoin === 'eleve' && (pro === 'fruits' || pro === 'recolte' || s.statut === 'en_recolte')) k = 1.1;
      kcMax = Math.max(kcMax, k);
      if (pro === 'levee' && p.mode !== 'plant') semisNonLeve = true;
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
    var fTerrain = 1, o = espace.orientation && TERRAIN.orientations[espace.orientation], so = espace.sol && TERRAIN.sols[espace.sol];
    if (o && o.facteurArrosage !== 1) { fTerrain *= o.facteurArrosage; res.raisons.push('exposition ' + o.nom.toLowerCase() + (o.facteurArrosage < 1 ? ' : sèche plus vite' : ' : sèche plus lentement')); }
    if (so && so.facteurArrosage !== 1) { fTerrain *= so.facteurArrosage; res.raisons.push(so.nom.toLowerCase() + (so.facteurArrosage < 1 ? ' : retient peu l’eau' : ' : garde l’eau longtemps')); }
    var intervalle = Math.max(R.intervalleMin, Math.min(R.intervalleMax, R.intervalleBase[type] * fStade * fChaleur * fTerrain));
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

    // Bilan d'eau réel si l'évapotranspiration est disponible (remplace l'estimation simple)
    var bilan = bilanEau(espace, kcMax || 0.85, fStade, reference, meteo, maintenant, semisNonLeve);
    if (bilan) {
      res.bilan = bilan;
      var plusTard = new Date(maintenant.getTime() + R.intervalleMax * JOUR);
      prochaine = bilan.prochaine && bilan.prochaine < plusTard ? bilan.prochaine : plusTard;
      res.raisons = res.raisons.filter(function (r) { return !/chaleur \(|temps frais|compte comme un arrosage|prise en compte en partie/.test(r); });
      res.raisons.unshift('calcul : évaporation mesurée depuis le dernier arrosage' + (espace.pluie === 'abri' ? '' : ' moins la pluie tombée'));
      if (espace.pluie !== 'abri' && bilan.pluieRecue >= 1) res.raisons.push('pluie récente (' + arrondi(bilan.pluieRecue) + ' mm) : la terre a été réhumidifiée');
    }
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
    res.decision = decisionArrosage(res, espace, meteo, maintenant, semisNonLeve);
    return res;
  }
  /** Verdict court et clair : arroser, attendre la pluie, pas besoin, à surveiller */
  function decisionArrosage(res, espace, meteo, maintenant, semisNonLeve) {
    var lieu = espace.type === 'bac' ? 'le bac' : 'la parcelle';
    var eps = espace.pluie === 'abri' ? [] : episodesPluie(meteo, maintenant, 14);
    var pluieSure = eps.filter(function (e) { return e.total >= 3 && (e.probaMax == null || e.probaMax === 0 || e.probaMax >= 70); })[0];
    if (res.statut === 'a_verifier') {
      if (pluieSure && !semisNonLeve) return { verdict: 'attendre', icone: '🌧️', titre: 'Attends la pluie', texte: pluieSure.texte + '. Si la terre n’est sèche qu’en surface, la pluie suffira ; arrose seulement si elle est sèche en profondeur.' };
      return { verdict: 'arroser', icone: '💧', titre: 'Arrose ' + lieu, texte: 'Vérifie la terre avec le doigt : si elle est sèche sur 2-3 cm, arrose au pied, de préférence le soir ou tôt le matin.' };
    }
    if (res.statut === 'ok') {
      var h = (res.prochaine - maintenant) / 3600000;
      if (h <= 24) return { verdict: 'surveiller', icone: '👀', titre: 'Pas encore', texte: 'À vérifier ' + quand(res.prochaine, maintenant) + '.' + (pluieSure ? ' ' + pluieSure.texte + '.' : '') };
      return { verdict: 'non', icone: '✅', titre: 'Pas besoin d’arroser', texte: 'Prochaine vérification ' + quand(res.prochaine, maintenant) + '.' };
    }
    if (res.statut === 'pas_arroser') return { verdict: 'non', icone: '🚫', titre: 'Ne pas arroser', texte: res.conseil };
    return null;
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

  /* ---------- Météo : alertes jardin ---------- */
  REGLES.alertes = { gel: 0, geleeBlanche: 2, chaleur: 32, chaleurForte: 35, fortePluie: 20, rafales: 60, secheresseJours: 7, secheresseTmax: 25 };
  var CODES_METEO = [
    [0, '☀️', 'ensoleillé'], [1, '🌤️', 'plutôt ensoleillé'], [2, '⛅', 'éclaircies'], [3, '☁️', 'couvert'],
    [45, '🌫️', 'brouillard'], [51, '🌦️', 'bruine'], [61, '🌧️', 'pluie'], [66, '🌧️', 'pluie verglaçante'],
    [71, '🌨️', 'neige'], [80, '🌦️', 'averses'], [85, '🌨️', 'averses de neige'], [95, '⛈️', 'orage']
  ];
  function ciel(code) {
    if (code == null) return { icone: '', texte: '' };
    var r = CODES_METEO[0];
    CODES_METEO.forEach(function (c) { if (code >= c[0]) r = c; });
    return { icone: r[1], texte: r[2] };
  }

  /**
   * Alertes utiles au jardin pour les prochains jours, traduites en gestes.
   * actives : [{ plantation, culture, espace }] cultures en cours
   * Renvoie [{ type, gravite: 'alerte'|'attention'|'info', titre, quand, date, conseil, concerne: [noms] }]
   */
  function alertesJardin(meteo, maintenant, actives, horizon) {
    var A = REGLES.alertes, res = [];
    if (!meteo || !meteo.jours) return res;
    var auj = isoDate(jourDe(maintenant));
    var futurs = meteo.jours.filter(function (j) { return j.date >= auj; }).slice(0, horizon || 7);
    if (!futurs.length) return res;
    actives = actives || [];
    var dehors = actives;
    function noms(filtre) {
      var vus = {};
      return dehors.filter(filtre).map(function (a) { return a.culture.nom; }).filter(function (n) { return vus[n] ? false : (vus[n] = true); });
    }
    function quandTxt(j) { var d = lireDate(j.date); var n = ecartJours(maintenant, d); return n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : JOURS[d.getDay()] + ' ' + d.getDate(); }

    // Gel / gelée blanche : la nuit la plus froide sous le seuil
    var froid = futurs.reduce(function (a, j) { return j.tmin < a.tmin ? j : a; });
    if (froid.tmin <= A.geleeBlanche) {
      var sensibles = noms(function (a) { return a.culture.froid.sensible || froid.tmin <= a.culture.froid.gelTolere; });
      var gel = froid.tmin <= A.gel;
      res.push({
        type: 'gel', gravite: sensibles.length ? 'alerte' : (gel ? 'attention' : 'info'), date: froid.date, quand: quandTxt(froid),
        titre: (gel ? 'Gel annoncé' : 'Risque de gelée blanche') + ' : ' + fmtT(froid.tmin) + ' la nuit',
        conseil: sensibles.length
          ? 'Protège la veille au soir avec un voile d’hivernage (ou un vieux drap), sans qu’il touche les feuilles si possible. Ne plante rien de frileux dehors.'
          : 'Pas de plantation frileuse dehors cette semaine (tomate, courgette, haricot…). Les cultures d’hiver (mâche, épinard, ail) le supportent.',
        concerne: sensibles
      });
    }
    // Détail horaire du gel (prochaines nuits), si les prévisions horaires sont là
    var lesNuits = nuits(meteo, maintenant, 3), nuitGel = lesNuits.filter(function (n) { return n.min <= A.geleeBlanche; })[0];
    if (nuitGel) {
      var g0 = res.filter(function (a) { return a.type === 'gel'; })[0];
      var detail = nuitGel.heuresGel ? 'Gel ' + nuitGel.nom + ' de ' + heureTxt(nuitGel.debutGel) + ' à ' + heureTxt(nuitGel.finGel) + ', minimum ' + fmtT(nuitGel.min) + ' vers ' + heureTxt(nuitGel.heureMin) + '.'
        : 'Minimum ' + fmtT(nuitGel.min) + ' ' + nuitGel.nom + ' vers ' + heureTxt(nuitGel.heureMin) + (nuitGel.claire ? ', ciel dégagé : gelée blanche probable au sol.' : '.');
      if (g0) { g0.detail = detail; g0.conseil = 'Avant 19 h, ' + g0.conseil.charAt(0).toLowerCase() + g0.conseil.slice(1); }
    }
    // Canicule
    var can = canicule(meteo, maintenant);
    if (can) res.push({
      type: 'canicule', gravite: 'alerte', date: isoDate(can.debut), quand: 'à partir de ' + JOURS[can.debut.getDay()] + ' ' + can.debut.getDate(),
      titre: 'Épisode de chaleur : ' + can.jours + ' jours à 30 °C ou plus (jusqu’à ' + fmtT(can.tmax) + ')',
      detail: can.nuitsChaudes ? can.nuitsChaudes + ' nuit' + (can.nuitsChaudes > 1 ? 's' : '') + ' à 20 °C ou plus : les plantes ne récupèrent pas la nuit.' : '',
      conseil: 'La veille : paille épais et arrose copieusement au pied. Pendant : arrose tôt le matin, vérifie les bacs matin et soir, ombre salades et semis aux heures chaudes, ne sème ni ne plante.',
      concerne: noms(function () { return true; })
    });
    // Chaleur
    var chaud = futurs.reduce(function (a, j) { return j.tmax > a.tmax ? j : a; });
    if (chaud.tmax >= A.chaleur && !can) {
      res.push({
        type: 'chaleur', gravite: chaud.tmax >= A.chaleurForte ? 'alerte' : 'attention', date: chaud.date, quand: quandTxt(chaud),
        titre: 'Forte chaleur : ' + fmtT(chaud.tmax),
        conseil: 'Arrose tôt le matin, au pied, et vérifie les bacs matin et soir. Paille la terre. Ombre les salades et les semis (voile ou cagette). Évite de semer ou planter en pleine chaleur.',
        concerne: noms(function (a) { return a.culture.arrosage.besoin === 'eleve' || a.culture.id === 'laitue' || a.culture.id === 'epinard'; })
      });
    }
    // Forte pluie
    var pluvieux = futurs.filter(function (j) { return j.pluie >= A.fortePluie; })[0];
    if (pluvieux) {
      res.push({
        type: 'pluie', gravite: 'attention', date: pluvieux.date, quand: quandTxt(pluvieux),
        titre: 'Forte pluie : ' + arrondi(pluvieux.pluie) + ' mm',
        conseil: 'Inutile d’arroser les espaces à ciel ouvert. Les jeunes semis peuvent être couchés : un voile les protège. Vérifie que les bacs s’égouttent bien (trous au fond).',
        concerne: []
      });
    }
    // Orage
    var orage = futurs.filter(function (j) { return j.code != null && j.code >= 95; })[0];
    if (orage) {
      res.push({
        type: 'orage', gravite: 'attention', date: orage.date, quand: quandTxt(orage),
        titre: 'Orage possible',
        conseil: 'Grêle et rafales possibles : vérifie les tuteurs, rentre les pots fragiles, un voile tendu peut limiter les dégâts de grêle.',
        concerne: noms(function (a) { return /tomate|concombre|poivron/.test(a.culture.id); })
      });
    }
    // Vent
    var venteux = futurs.reduce(function (a, j) { return (j.rafales || 0) > (a.rafales || 0) ? j : a; });
    if ((venteux.rafales || 0) >= A.rafales && !(orage && orage.date === venteux.date)) {
      res.push({
        type: 'vent', gravite: 'attention', date: venteux.date, quand: quandTxt(venteux),
        titre: 'Vent fort : rafales à ' + Math.round(venteux.rafales) + ' km/h',
        conseil: 'Vérifie les attaches des tuteurs et fixe les voiles. Le vent dessèche vite les bacs : vérifie la terre le lendemain.',
        concerne: noms(function (a) { return /tomate|concombre|poivron|courgette/.test(a.culture.id); })
      });
    }
    // Sécheresse : peu de pluie récente et à venir, temps chaud
    var tousJours = meteo.jours.filter(function (j) { return j.date >= isoDate(ajouterJours(jourDe(maintenant), -3)); }).slice(0, A.secheresseJours + 3);
    var cumul = tousJours.reduce(function (t, j) { return t + (j.pluie || 0); }, 0);
    var tmaxMoy = futurs.reduce(function (t, j) { return t + j.tmax; }, 0) / futurs.length;
    if (tousJours.length >= A.secheresseJours && cumul < 3 && tmaxMoy >= A.secheresseTmax) {
      res.push({
        type: 'secheresse', gravite: 'info', date: futurs[0].date, quand: 'cette semaine',
        titre: 'Temps sec : presque pas de pluie',
        conseil: 'Même les espaces à ciel ouvert vont dépendre de toi. Arrose copieusement mais moins souvent, et paille pour garder l’humidité.',
        concerne: []
      });
    }
    // Maladies et nuisibles favorisés par la météo, seulement pour les cultures présentes
    var passes = meteo.jours.filter(function (j) { return j.date < auj && j.date >= isoDate(ajouterJours(jourDe(maintenant), -2)); });
    PROBLEMES.filter(function (pb) { return pb.risque; }).forEach(function (pb) {
      var touchees = noms(function (a) { return pb.cultures.indexOf(a.culture.id) >= 0; });
      if (!touchees.length) return;
      var r = pb.risque, declenche = false, quandPb = 'ces jours-ci';
      if (r.joursPluvieux) {
        var humides = futurs.slice(0, 5).filter(function (j) { return (j.pluie || 0) >= 2 && j.tmax >= r.tmaxMin && j.tmax <= r.tmaxMax; });
        if (humides.length >= r.joursPluvieux) { declenche = true; quandPb = quandTxt(humides[0]); }
      }
      if (r.pluieRecente) {
        var tombe = passes.concat(futurs.slice(0, 1)).reduce(function (t, j) { return t + (j.pluie || 0); }, 0);
        var doux = futurs.slice(0, 2).every(function (j) { return j.tmin >= r.tminMin; });
        if (tombe >= r.pluieRecente && doux) { declenche = true; quandPb = 'après la pluie'; }
      }
      if (declenche) res.push({
        type: 'probleme', probleme: pb.id, gravite: 'attention', date: futurs[0].date, quand: quandPb,
        titre: pb.emoji + ' Risque : ' + pb.nom.toLowerCase(),
        conseil: pb.prevenir, concerne: touchees
      });
    });
    var ordre = { alerte: 0, attention: 1, info: 2 };
    return res.sort(function (a, b) { return ordre[a.gravite] - ordre[b.gravite] || (a.date < b.date ? -1 : 1); });
  }

  /** Jours de prévision à afficher (à partir d'aujourd'hui) avec le ciel décodé */
  function previsions(meteo, maintenant, nb) {
    if (!meteo || !meteo.jours) return [];
    var auj = isoDate(jourDe(maintenant));
    return meteo.jours.filter(function (j) { return j.date >= auj; }).slice(0, nb || 7).map(function (j) {
      var c = ciel(j.code);
      return Object.assign({}, j, { jour: lireDate(j.date), icone: c.icone, ciel: c.texte, gel: j.tmin <= REGLES.alertes.gel, chaleur: j.tmax >= REGLES.alertes.chaleur });
    });
  }

  /* ---------- Climat local (historique des gelées) ---------- */
  function jourAnnee(d) { return Math.round((jourDe(d) - new Date(d.getFullYear(), 0, 1, 12)) / JOUR) + 1; }
  function mmjjDepuisJour(j) { var d = ajouterJours(new Date(2001, 0, 1, 12), j - 1); var m = d.getMonth() + 1, x = d.getDate(); return (m < 10 ? '0' : '') + m + '-' + (x < 10 ? '0' : '') + x; }
  function mediane(t) { var a = t.slice().sort(function (x, y) { return x - y; }); var n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; }
  /**
   * À partir de températures minimales quotidiennes passées [{date, tmin}],
   * date médiane des dernières gelées de printemps (janv.-juin) et des premières
   * gelées d'automne (juil.-déc.). Seuil : tmin ≤ 0 °C.
   */
  function gelees(jours) {
    var parAn = {};
    jours.forEach(function (j) {
      if (j.tmin == null) return;
      var y = j.date.slice(0, 4); (parAn[y] = parAn[y] || []).push(j);
    });
    var derniers = [], premiers = [];
    Object.keys(parAn).forEach(function (y) {
      var js = parAn[y]; if (js.length < 300) return;
      var dern = null, prem = null;
      js.forEach(function (j) {
        if (j.tmin > 0) return;
        var m = +j.date.slice(5, 7), n = jourAnnee(lireDate(j.date));
        if (m <= 6) dern = n; else if (prem == null) prem = n;
      });
      derniers.push(dern == null ? 32 : dern);   // aucune gelée : 1er février
      premiers.push(prem == null ? 365 : prem);  // aucune gelée : fin décembre
    });
    if (derniers.length < 3) return null;
    var d = Math.round(mediane(derniers)), p = Math.round(mediane(premiers));
    return { derniere: mmjjDepuisJour(d), premiere: mmjjDepuisJour(p), jourDerniere: d, jourPremiere: p, annees: derniers.length };
  }
  /** Décalages de calendrier d'un lieu par rapport au lieu de référence (même méthode des deux côtés) */
  function climatLocal(lieu, reference) {
    if (!lieu || !reference) return null;
    var borne = function (x) { return Math.max(-45, Math.min(45, x)); };
    return {
      derniere: lieu.derniere, premiere: lieu.premiere, annees: lieu.annees,
      decalagePrintemps: borne(lieu.jourDerniere - reference.jourDerniere),
      decalageAutomne: borne(lieu.jourPremiere - reference.jourPremiere)
    };
  }

  /* ---------- Problèmes ---------- */
  function problemesDe(cultureId) { return PROBLEMES.filter(function (p) { return p.cultures.indexOf(cultureId) >= 0; }); }

  /* ---------- Rappels (fichier agenda .ics, lisible par iPhone, Android, Outlook) ---------- */
  function icsDate(d, journee) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    if (journee) return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
    return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + 'T' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + '00Z';
  }
  function icsTexte(t) { return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function plierLigne(l) { var c = Array.from(l), out = []; for (var i = 0; i < c.length; i += 40) out.push((i ? ' ' : '') + c.slice(i, i + 40).join('')); return out.join('\r\n'); }
  /** events : [{ id, titre, debut: Date, journee, description, rrule, alarmeMinutes }] */
  function ics(events, maintenant) {
    var l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mon potager//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    events.forEach(function (e) {
      l.push('BEGIN:VEVENT', 'UID:' + e.id + '@mon-potager', 'DTSTAMP:' + icsDate(maintenant || new Date(), false));
      if (e.journee) { l.push('DTSTART;VALUE=DATE:' + icsDate(e.debut, true), 'DTEND;VALUE=DATE:' + icsDate(ajouterJours(e.debut, 1), true)); }
      else { l.push('DTSTART:' + icsDate(e.debut, false), 'DTEND:' + icsDate(new Date(e.debut.getTime() + 15 * 60000), false)); }
      if (e.rrule) l.push('RRULE:' + e.rrule);
      l.push('SUMMARY:' + icsTexte(e.titre));
      if (e.description) l.push('DESCRIPTION:' + icsTexte(e.description));
      l.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsTexte(e.titre), 'TRIGGER:' + (e.journee ? 'PT9H' : '-PT0M'), 'END:VALARM', 'END:VEVENT');
    });
    l.push('END:VCALENDAR');
    return l.map(plierLigne).join('\r\n') + '\r\n';
  }
  /** Rappels d'une culture : étapes à venir, récolte, gestes datés */
  function rappelsPlantation(p, zoneId, maintenant) {
    var s = suivi(p, zoneId, maintenant, null), c = s.culture, ev = [], auj = jourDe(maintenant);
    if (s.statut === 'terminee') return ev;
    var nomEsp = p.espaceNom ? ' (' + p.espaceNom + ')' : '';
    s.chronologie.etapes.forEach(function (e) {
      if (e.observe || e.statut === 'passe' || e.etape === 'recolte' || e.du < auj) return;
      ev.push({ id: p.id + '-' + e.etape, journee: true, debut: e.du, alarmeMinutes: -540,
        titre: c.emoji + ' ' + c.nom + nomEsp + ' : à surveiller, ' + e.titre.toLowerCase(),
        description: 'Fenêtre estimée ' + formatFenetre(e.du, e.au) + '. ' + texteEtape(c, e.etape, 'normal') + ' Confirme-la dans l’app quand tu la vois.' });
    });
    if (s.recolte && s.recolte.du >= auj) {
      ev.push({ id: p.id + '-recolte', journee: true, debut: ajouterJours(s.recolte.du, -3), alarmeMinutes: -540,
        titre: c.emoji + ' ' + c.nom + nomEsp + ' : récolte bientôt',
        description: 'Première récolte estimée ' + s.recolte.fenetre + '. Signe à observer : ' + c.recolte.signe });
    }
    (c.gestes || []).forEach(function (g, i) {
      if (g.apres !== 'recolte' || !s.recolte) return;
      var d = ajouterJours(s.recolte.du, g.j[0]);
      if (d >= auj) ev.push({ id: p.id + '-geste' + i, journee: true, debut: d, alarmeMinutes: -540, titre: c.emoji + ' ' + c.nom + nomEsp + ' : ' + g.titre.toLowerCase(), description: g.consigne });
    });
    return ev;
  }
  /** Rappel récurrent de vérification de l'arrosage pour un espace (le soir, 19 h) */
  function rappelArrosage(espace, maintenant, nb) {
    var type = espace.type === 'bac' ? 'bac' : 'pleine_terre', R = REGLES.arrosage;
    var o = espace.orientation && TERRAIN.orientations[espace.orientation], so = espace.sol && TERRAIN.sols[espace.sol];
    var n = Math.max(1, Math.round(R.intervalleBase[type] * (o ? o.facteurArrosage : 1) * (so ? so.facteurArrosage : 1)));
    var d = new Date(maintenant.getTime()); d.setHours(19, 0, 0, 0); if (d <= maintenant) d = ajouterJours(d, 1);
    return { id: 'arrosage-' + espace.id, journee: false, debut: d, rrule: 'FREQ=DAILY;INTERVAL=' + n + ';COUNT=' + (nb || 40),
      titre: '💧 Vérifier la terre : ' + espace.nom,
      description: 'Enfonce un doigt dans la terre : si elle est sèche sur 2-3 cm, arrose au pied. Ouvre l’app pour noter « J’ai arrosé » : le prochain conseil tiendra compte de la météo.' , intervalle: n };
  }

  var Moteur = {
    REGLES: REGLES, NIVEAUX: NIVEAUX, GESTES: GESTES, NOMS_MODES: NOMS_MODES,
    cultures: function () { return CULTURES; }, culture: culture, gestesDe: gestesDe, modesDe: modesDe, nomGeste: nomGeste, gesteDuMode: gesteDuMode,
    zone: zone, niveauClimatique: niveauClimatique, conseilGeste: conseilGeste, conseilParJour: conseilParJour, bandeauAnnuel: bandeauAnnuel,
    capacite: capacite, compatibilite: compatibilite, suggestions: suggestions, apresCulture: apresCulture,
    chronologie: chronologie, suivi: suivi, etapesConfirmables: etapesConfirmables, texteEtape: texteEtape,
    gelees: gelees, climatLocal: climatLocal, heuresDuJour: heuresDuJour, episodesPluie: episodesPluie, temperatureSol: temperatureSol, creneaux: creneaux, pluieProchaine: pluieProchaine, soif: soif, comparaisonNormale: comparaisonNormale, niveauUV: niveauUV, nuits: nuits, canicule: canicule, bilanEau: bilanEau, voisinage: voisinage, problemesDe: problemesDe, ics: ics, rappelsPlantation: rappelsPlantation, rappelArrosage: rappelArrosage,
    arrosage: arrosage, alertesJardin: alertesJardin, previsions: previsions, ciel: ciel,
    dates: { lire: lireDate, iso: isoDate, ajouter: ajouterJours, ecart: ecartJours, format: formatDate, formatJour: formatJour, fenetre: formatFenetre, quand: quand, jour: jourDe }
  };
  racine.Moteur = Moteur;
  if (typeof module !== 'undefined') module.exports = Moteur;
})(typeof window !== 'undefined' ? window : globalThis);

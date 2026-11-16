/*
 * Zones climatiques simplifiées pour la France métropolitaine.
 *
 * Toutes les fenêtres de culture des fiches (data/cultures.js) sont écrites
 * pour la zone de RÉFÉRENCE « tempéré » (Bassin parisien, Centre, Val de Loire).
 * Pour une autre zone, on décale les dates :
 *   - les dates de janvier à juillet sont décalées de `decalagePrintemps` jours
 *     (négatif = plus tôt, positif = plus tard) ;
 *   - les dates d'août à décembre sont décalées de `decalageAutomne` jours
 *     (positif = la saison dure plus longtemps).
 *
 * `dernieresGelees` : date moyenne approximative des dernières gelées de printemps
 * (repère indicatif, cf. data/REFERENCES.md). Les saints de glace (11-13 mai)
 * restent le repère populaire en zone tempérée.
 */
var CLIMATS = {
  reference: 'tempere',
  zones: {
    mediterraneen: {
      id: 'mediterraneen',
      nom: 'Méditerranéen',
      description: 'Pourtour méditerranéen, Corse, basse vallée du Rhône',
      decalagePrintemps: -21,
      decalageAutomne: 21,
      dernieresGelees: '03-20'
    },
    oceanique: {
      id: 'oceanique',
      nom: 'Océanique',
      description: 'Bretagne, façade atlantique, Sud-Ouest',
      decalagePrintemps: -10,
      decalageAutomne: 10,
      dernieresGelees: '04-05'
    },
    tempere: {
      id: 'tempere',
      nom: 'Tempéré (référence)',
      description: 'Bassin parisien, Centre, Val de Loire, Nord',
      decalagePrintemps: 0,
      decalageAutomne: 0,
      dernieresGelees: '04-20'
    },
    continental: {
      id: 'continental',
      nom: 'Semi-continental',
      description: 'Est, Centre-Est, Bourgogne, Alsace, Lorraine',
      decalagePrintemps: 10,
      decalageAutomne: -10,
      dernieresGelees: '05-05'
    },
    montagne: {
      id: 'montagne',
      nom: 'Montagne (au-dessus de 700 m)',
      description: 'Massifs, plateaux d’altitude',
      decalagePrintemps: 25,
      decalageAutomne: -20,
      dernieresGelees: '05-25'
    }
  },

  /** Zone « Ma commune » calculée à partir des gelées réelles (voir js/meteo.js) */
  definirLocale: function (cl, commune) {
    if (!cl) { delete this.zones.local; return; }
    this.zones.local = {
      id: 'local', nom: 'Ma commune (gelées réelles)',
      description: 'dernières gelées vers le ' + cl.derniere.split('-').reverse().join('/') + ', premières vers le ' + cl.premiere.split('-').reverse().join('/') + (commune ? ' à ' + commune : '') + ' (' + cl.annees + ' ans)',
      decalagePrintemps: cl.decalagePrintemps, decalageAutomne: cl.decalageAutomne, dernieresGelees: cl.derniere
    };
  },

  /*
   * Détection approximative de la zone à partir des coordonnées.
   * Volontairement simple : l'utilisateur peut toujours corriger la zone
   * dans son profil.
   */
  detecter: function (lat, lon, altitude) {
    if (typeof altitude === 'number' && altitude >= 700) return 'montagne';
    // Corse
    if (lat < 43.1 && lon > 8.4) return 'mediterraneen';
    // Arc méditerranéen et basse vallée du Rhône (hors altitude)
    if (lat < 44.3 && lon > 2.8 && !(typeof altitude === 'number' && altitude > 450)) return 'mediterraneen';
    // Façade atlantique, Bretagne, Sud-Ouest
    if (lon < -1.2) return 'oceanique';
    if (lat < 46.5 && lon < 1.0) return 'oceanique';
    // Est et Centre-Est
    if (lon > 4.6 && lat > 45.3) return 'continental';
    return 'tempere';
  }
};

if (typeof module !== 'undefined') module.exports = CLIMATS;

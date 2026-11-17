/*
 * Associations de cultures (« compagnonnage »).
 * Savoir jardinier traditionnel, peu prouvé scientifiquement : à présenter comme
 * des repères. Les associations « à éviter » les plus citées concernent :
 *  - ail / oignon à côté des haricots (les alliacées freineraient les fabacées) ;
 *  - deux cultures de la même famille côte à côte (maladies communes).
 * Sources : guides Terre vivante, Rustica, Gerbeaud (repères courants).
 */
var ASSOCIATIONS = (function () {
  var amis = [
    ['tomate', 'carotte'], ['tomate', 'laitue'], ['tomate', 'radis'], ['tomate', 'ail'], ['tomate', 'oignon'], ['tomate', 'epinard'],
    ['tomate-cerise', 'carotte'], ['tomate-cerise', 'laitue'], ['tomate-cerise', 'radis'], ['tomate-cerise', 'ail'], ['tomate-cerise', 'oignon'],
    ['courgette', 'haricot-nain'], ['courgette', 'radis'], ['courgette', 'laitue'], ['courgette', 'oignon'],
    ['concombre', 'haricot-nain'], ['concombre', 'laitue'], ['concombre', 'radis'],
    ['poivron', 'carotte'], ['poivron', 'oignon'], ['poivron', 'epinard'], ['poivron', 'laitue'],
    ['laitue', 'radis'], ['laitue', 'carotte'], ['laitue', 'fraise'], ['laitue', 'betterave'], ['laitue', 'oignon'],
    ['mache', 'oignon'], ['mache', 'fraise'],
    ['epinard', 'fraise'], ['epinard', 'radis'], ['epinard', 'haricot-nain'],
    ['radis', 'carotte'], ['radis', 'haricot-nain'],
    ['carotte', 'oignon'], ['carotte', 'ail'],
    ['betterave', 'oignon'], ['betterave', 'haricot-nain'], ['betterave', 'ail'],
    ['ail', 'fraise'], ['oignon', 'fraise'],
    ['haricot-nain', 'carotte']
  ];
  var aEviter = [
    ['ail', 'haricot-nain', 'l’ail freinerait la croissance des haricots'],
    ['oignon', 'haricot-nain', 'l’oignon freinerait la croissance des haricots'],
    ['tomate', 'concombre', 'besoins d’arrosage différents et maladies favorisées par l’humidité'],
    ['tomate-cerise', 'concombre', 'besoins d’arrosage différents et maladies favorisées par l’humidité'],
    ['courgette', 'concombre', 'même famille : ils partagent l’oïdium'],
    ['tomate', 'poivron', 'même famille : maladies communes (mildiou), à espacer si possible'],
    ['betterave', 'epinard', 'même famille : se concurrencent et partagent leurs maladies']
  ];
  var table = {};
  function ajouter(a, b, type, raison) {
    (table[a] = table[a] || { amis: [], aEviter: [] })[type].push(type === 'amis' ? b : { id: b, raison: raison });
  }
  amis.forEach(function (p) { ajouter(p[0], p[1], 'amis'); ajouter(p[1], p[0], 'amis'); });
  aEviter.forEach(function (p) { ajouter(p[0], p[1], 'aEviter', p[2]); ajouter(p[1], p[0], 'aEviter', p[2]); });
  return {
    de: function (id) { return table[id] || { amis: [], aEviter: [] }; },
    /** Relation entre deux cultures : 'ami', 'eviter' (avec raison) ou null */
    entre: function (a, b) {
      var t = table[a]; if (!t) return null;
      if (t.amis.indexOf(b) >= 0) return { type: 'ami' };
      var e = t.aEviter.filter(function (x) { return x.id === b; })[0];
      return e ? { type: 'eviter', raison: e.raison } : null;
    }
  };
})();
if (typeof module !== 'undefined') module.exports = ASSOCIATIONS;

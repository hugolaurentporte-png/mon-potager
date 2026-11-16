/*
 * Zone climatique par département (repli quand la recherche de commune en ligne
 * n'est pas disponible). Approximatif : un département peut couvrir plusieurs
 * climats (littoral / montagne). L'utilisateur peut toujours corriger.
 */
var DEPARTEMENTS = (function () {
  var z = {
    mediterraneen: ['04', '06', '11', '13', '20', '2A', '2B', '30', '34', '66', '83', '84'],
    oceanique: ['14', '16', '17', '22', '24', '29', '32', '33', '35', '40', '44', '47', '49', '50', '53', '56', '64', '65', '79', '85', '86'],
    continental: ['01', '08', '10', '21', '25', '38', '39', '42', '51', '52', '54', '55', '57', '67', '68', '69', '70', '71', '73', '74', '88', '90'],
    montagne: ['05', '15', '48']
  };
  var table = {};
  Object.keys(z).forEach(function (k) { z[k].forEach(function (d) { table[d] = k; }); });
  return {
    /** Code postal → { departement, zone } (zone « tempere » par défaut) */
    depuisCodePostal: function (cp) {
      cp = String(cp || '').trim();
      if (!/^\d{5}$/.test(cp)) return null;
      var d = cp.slice(0, 2);
      if (d === '97' || d === '98') return null;
      return { departement: d, zone: table[d] || 'tempere' };
    }
  };
})();
if (typeof module !== 'undefined') module.exports = DEPARTEMENTS;

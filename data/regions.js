/*
 * Régions et spécialités locales.
 * Variétés traditionnelles ou sous signe de qualité (AOP, IGP, Label rouge) liées
 * à un terroir, parmi les 15 cultures de l'app. Elles s'ajoutent aux variétés de
 * chaque fiche (avec leur précocité) et sont mises en avant pour les jardiniers
 * de la région. Sources : INAO (signes de qualité), catalogues de semences
 * anciennes. Précocités estimées : à valider.
 */
var REGIONS = (function () {
  var regions = {
    'bretagne': { nom: 'Bretagne', deps: ['22', '29', '35', '56'] },
    'normandie': { nom: 'Normandie', deps: ['14', '27', '50', '61', '76'] },
    'hauts-de-france': { nom: 'Hauts-de-France', deps: ['02', '59', '60', '62', '80'] },
    'ile-de-france': { nom: 'Île-de-France', deps: ['75', '77', '78', '91', '92', '93', '94', '95'] },
    'grand-est': { nom: 'Grand Est', deps: ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'] },
    'pays-de-la-loire': { nom: 'Pays de la Loire', deps: ['44', '49', '53', '72', '85'] },
    'centre': { nom: 'Centre-Val de Loire', deps: ['18', '28', '36', '37', '41', '45'] },
    'bourgogne-franche-comte': { nom: 'Bourgogne-Franche-Comté', deps: ['21', '25', '39', '58', '70', '71', '89', '90'] },
    'nouvelle-aquitaine': { nom: 'Nouvelle-Aquitaine', deps: ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'] },
    'auvergne-rhone-alpes': { nom: 'Auvergne-Rhône-Alpes', deps: ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'] },
    'occitanie': { nom: 'Occitanie', deps: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'] },
    'paca': { nom: 'Provence-Alpes-Côte d’Azur', deps: ['04', '05', '06', '13', '83', '84'] },
    'corse': { nom: 'Corse', deps: ['20', '2A', '2B'] }
  };
  // Spécialités : culture, variété ajoutée à la fiche, régions concernées
  var specialites = [
    { culture: 'oignon', regions: ['bretagne'], variete: { id: 'rose-roscoff', nom: 'Oignon rosé de Roscoff', facteur: 1.05, note: 'AOP du Finistère, doux, se conserve bien' } },
    { culture: 'fraise', regions: ['bretagne'], variete: { id: 'plougastel', nom: 'Fraise de Plougastel (type Gariguette)', facteur: 0.95, note: 'tradition bretonne' } },
    { culture: 'haricot-nain', regions: ['bretagne'], variete: { id: 'coco-paimpol', nom: 'Coco de Paimpol', facteur: 1.2, note: 'AOP, haricot demi-sec à écosser' } },
    { culture: 'carotte', regions: ['normandie'], variete: { id: 'creances', nom: 'Carotte de Créances (type Nantaise)', facteur: 1.0, note: 'IGP de la Manche, terre sableuse' } },
    { culture: 'ail', regions: ['hauts-de-france'], variete: { id: 'arleux', nom: 'Ail d’Arleux (fumé)', facteur: 1.0, note: 'IGP du Nord' } },
    { culture: 'laitue', regions: ['ile-de-france', 'centre'], variete: { id: 'gotte', nom: 'Laitue Gotte jaune d’or', facteur: 0.9, note: 'ancienne variété maraîchère' } },
    { culture: 'carotte', regions: ['ile-de-france'], variete: { id: 'nantaise-paris', nom: 'Carotte Grelot (Marché de Paris)', facteur: 0.8, note: 'ronde, variété des maraîchers parisiens' } },
    { culture: 'mache', regions: ['pays-de-la-loire'], variete: { id: 'nantaise', nom: 'Mâche nantaise (verte à cœur plein)', facteur: 1.0, note: 'IGP Mâche nantaise' } },
    { culture: 'tomate', regions: ['nouvelle-aquitaine'], variete: { id: 'marmande-ag', nom: 'Tomate Marmande', facteur: 0.9, note: 'née en Lot-et-Garonne' } },
    { culture: 'fraise', regions: ['nouvelle-aquitaine'], variete: { id: 'perigord', nom: 'Fraise du Périgord (Gariguette, Mara des bois)', facteur: 1.0, note: 'IGP de Dordogne' } },
    { culture: 'poivron', regions: ['nouvelle-aquitaine'], variete: { id: 'doux-landes', nom: 'Piment doux des Landes', facteur: 0.95, note: 'poivron allongé, à poêler' } },
    { culture: 'ail', regions: ['occitanie'], variete: { id: 'violet-cadours', nom: 'Ail violet de Cadours', facteur: 1.0, note: 'AOP de Haute-Garonne' } },
    { culture: 'ail', regions: ['occitanie'], variete: { id: 'rose-lautrec', nom: 'Ail rose de Lautrec', facteur: 0.9, note: 'IGP du Tarn, planté en fin d’hiver' } },
    { culture: 'ail', regions: ['occitanie', 'nouvelle-aquitaine'], variete: { id: 'blanc-lomagne', nom: 'Ail blanc de Lomagne', facteur: 1.0, note: 'IGP Gers / Tarn-et-Garonne' } },
    { culture: 'oignon', regions: ['occitanie'], variete: { id: 'doux-cevennes', nom: 'Oignon doux des Cévennes', facteur: 1.05, note: 'AOP, cultivé en terrasses' } },
    { culture: 'fraise', regions: ['occitanie'], variete: { id: 'nimes', nom: 'Fraise de Nîmes', facteur: 0.95, note: 'précoce' } },
    { culture: 'courgette', regions: ['paca', 'corse'], variete: { id: 'ronde-nice-r', nom: 'Courgette ronde de Nice', facteur: 0.95, note: 'variété niçoise, à farcir' } },
    { culture: 'tomate', regions: ['paca', 'occitanie', 'corse'], variete: { id: 'coeur-boeuf-r', nom: 'Tomate Cœur de bœuf', facteur: 1.15, note: 'aime les étés chauds du Sud' } },
    { culture: 'fraise', regions: ['paca'], variete: { id: 'carpentras', nom: 'Fraise de Carpentras (Gariguette)', facteur: 0.9, note: 'IGP du Vaucluse, très précoce' } },
    { culture: 'poivron', regions: ['paca', 'corse'], variete: { id: 'lamuyo', nom: 'Poivron Lamuyo', facteur: 1.05, note: 'gros fruits, pour étés chauds' } },
    { culture: 'betterave', regions: ['grand-est', 'hauts-de-france'], variete: { id: 'crapaudine-r', nom: 'Betterave Crapaudine', facteur: 1.3, note: 'très ancienne, se conserve l’hiver' } },
    { culture: 'oignon', regions: ['grand-est', 'bourgogne-franche-comte'], variete: { id: 'jaune-vertus', nom: 'Oignon jaune paille des Vertus', facteur: 1.0, note: 'variété de garde rustique' } },
    { culture: 'laitue', regions: ['auvergne-rhone-alpes', 'bourgogne-franche-comte'], variete: { id: 'reine-glaces', nom: 'Laitue Reine des glaces', facteur: 1.0, note: 'croquante, résiste à la montée en graines' } },
    { culture: 'haricot-nain', regions: ['auvergne-rhone-alpes', 'centre', 'pays-de-la-loire'], variete: { id: 'lingot', nom: 'Haricot Lingot', facteur: 1.2, note: 'haricot à écosser traditionnel' } }
  ];
  function regionDuDepartement(dep) {
    if (!dep) return null;
    for (var k in regions) if (regions[k].deps.indexOf(dep) >= 0) return Object.assign({ id: k }, regions[k]);
    return null;
  }
  /** Ajoute les variétés régionales aux fiches (une seule fois) */
  function enrichir(cultures) {
    specialites.forEach(function (s) {
      var c = cultures.filter(function (x) { return x.id === s.culture; })[0];
      if (!c || c.varietes.some(function (v) { return v.id === s.variete.id; })) return;
      c.varietes.push(Object.assign({ regions: s.regions }, s.variete));
    });
  }
  return {
    regions: regions,
    specialites: specialites,
    depuisDepartement: regionDuDepartement,
    depuisCodePostal: function (cp) { cp = String(cp || ''); return /^\d{5}$/.test(cp) ? regionDuDepartement(cp.slice(0, 2)) : null; },
    specialitesDe: function (regionId) { return specialites.filter(function (s) { return s.regions.indexOf(regionId) >= 0; }); },
    enrichir: enrichir
  };
})();
if (typeof window !== 'undefined' && window.CULTURES) REGIONS.enrichir(window.CULTURES);
if (typeof module !== 'undefined') module.exports = REGIONS;

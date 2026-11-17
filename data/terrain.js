/*
 * Orientation et type de sol des espaces — effets sur les conseils et l'arrosage.
 * Valeurs indicatives (savoir jardinier courant), à valider à l'usage.
 *  - facteurArrosage : multiplie l'intervalle entre deux vérifications
 *    (< 1 = vérifier plus souvent).
 */
var TERRAIN = {
  orientations: {
    sud: { nom: 'Sud', aide: 'le plus chaud et le plus lumineux', facteurArrosage: 0.85,
      aime: ['tomate', 'tomate-cerise', 'poivron', 'courgette', 'concombre', 'haricot-nain', 'fraise'],
      note: 'exposition sud : idéale pour les légumes-fruits ; en été, ombre les salades et vérifie l’eau plus souvent' },
    ouest: { nom: 'Ouest', aide: 'soleil chaud l’après-midi', facteurArrosage: 0.9,
      aime: ['tomate', 'tomate-cerise', 'courgette', 'haricot-nain', 'fraise', 'betterave'],
      note: 'exposition ouest : soleil chaud l’après-midi, assez bien pour la plupart des légumes' },
    est: { nom: 'Est', aide: 'soleil doux du matin', facteurArrosage: 1,
      aime: ['laitue', 'epinard', 'radis', 'mache', 'carotte', 'betterave', 'fraise'],
      note: 'exposition est : soleil doux du matin, parfaite pour salades et légumes-racines' },
    nord: { nom: 'Nord', aide: 'frais, peu de soleil direct', facteurArrosage: 1.15,
      aime: ['laitue', 'epinard', 'mache', 'radis'],
      evite: ['tomate', 'tomate-cerise', 'poivron', 'concombre', 'courgette'],
      note: 'exposition nord : fraîche, réserve-la aux salades, épinards, mâche et radis' }
  },
  sols: {
    terreau: { nom: 'Terreau du commerce', aide: 'léger, riche, sèche vite en bac', facteurArrosage: 0.9,
      conseil: 'Le terreau s’épuise en un an : ajoute du compost ou un engrais organique à chaque nouvelle culture.' },
    limoneux: { nom: 'Terre de jardin équilibrée', aide: 'souple, ni collante ni sableuse', facteurArrosage: 1,
      conseil: 'Bonne terre : un apport de compost chaque année suffit.' },
    argileux: { nom: 'Terre lourde / argileuse', aide: 'colle aux bottes, fend en été', facteurArrosage: 1.3,
      conseil: 'Elle garde l’eau longtemps : arrose moins souvent mais vérifie en profondeur. Évite de la travailler mouillée et ajoute du compost pour l’alléger.',
      cultures: {
        carotte: 'terre lourde : carottes courtes ou fourchues, choisis une variété ronde ou demi-longue',
        ail: 'terre lourde : plante sur une petite butte pour éviter la pourriture',
        oignon: 'terre lourde : plante sur une petite butte pour éviter la pourriture',
        radis: 'terre lourde : ameublis bien la surface avant de semer'
      } },
    sableux: { nom: 'Terre sableuse / légère', aide: 's’effrite, sèche très vite', facteurArrosage: 0.7,
      conseil: 'Elle sèche vite : paille systématiquement et ajoute beaucoup de compost pour qu’elle retienne l’eau.',
      cultures: {
        carotte: 'terre sableuse : idéale pour de belles carottes droites',
        courgette: 'terre sableuse : enrichis bien le trou de plantation en compost',
        tomate: 'terre sableuse : paille épais, les tomates craignent les à-coups d’arrosage',
        laitue: 'terre sableuse : arrose souvent, la salade monte vite en graines si elle a soif'
      } },
    caillouteux: { nom: 'Terre caillouteuse', aide: 'beaucoup de pierres', facteurArrosage: 0.85,
      conseil: 'Retire les plus grosses pierres là où tu sèmes et ajoute du compost.',
      cultures: {
        carotte: 'terre caillouteuse : carottes fourchues, choisis une variété ronde ou cultive-les en bac',
        radis: 'terre caillouteuse : enlève les cailloux sur la ligne de semis'
      } }
  }
};
if (typeof module !== 'undefined') module.exports = TERRAIN;

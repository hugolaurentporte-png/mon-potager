/*
 * Étapes de croissance génériques.
 * Chaque culture (data/cultures.js) définit son propre parcours, étape par étape,
 * et peut remplacer les textes ci-dessous (« normal », « controle »).
 *
 *  - titre    : nom de l'étape attendue
 *  - bouton   : libellé du bouton qui confirme l'observation
 *  - normal   : ce qu'il est normal de voir en attendant cette étape
 *  - controle : vérification simple si la fenêtre estimée est dépassée
 */
var ETAPES = {
  levee: {
    titre: 'Levée',
    bouton: 'Ça a levé',
    normal: 'Rien de visible pendant quelques jours : les graines gonflent et germent sous la terre. Garde la surface humide sans la détremper.',
    controle: 'Gratte très délicatement la surface à un endroit : si les graines sont intactes, patiente (terre peut-être trop froide). Si elles ont pourri ou disparu, ou si une croûte dure s’est formée, ressème.'
  },
  plantation: {
    titre: 'Mise en terre',
    bouton: 'J’ai mis en terre',
    normal: 'Les jeunes plants grandissent en godet. Ils sont prêts quand ils ont 4 à 6 vraies feuilles et que le calendrier « Mettre un plant en terre » est favorable.',
    controle: 'Si les plants s’allongent et pâlissent, ils manquent de lumière : rapproche-les d’une fenêtre et mets-les dehors quelques heures par jour pour les endurcir avant la mise en terre.'
  },
  reprise: {
    titre: 'Reprise',
    bouton: 'Il a repris',
    normal: 'Le plant peut piquer du nez un jour ou deux après la mise en terre : c’est normal. Il a repris quand il se redresse et que le cœur forme de nouvelles feuilles.',
    controle: 'Si le plant reste flétri, vérifie que la terre est humide autour des racines (pas seulement en surface) et qu’il n’a pas été grignoté au collet (limaces, vers gris).'
  },
  feuilles: {
    titre: 'Nouvelles feuilles',
    bouton: 'Nouvelles feuilles',
    normal: 'Après les deux premières feuilles (cotylédons), de vraies feuilles, différentes, apparaissent au centre.',
    controle: 'Si la croissance stagne, regarde la couleur : des feuilles jaunes signalent souvent un excès d’eau ou un manque de nutriments ; trouées, des limaces ou altises.'
  },
  floraison: {
    titre: 'Premières fleurs',
    bouton: 'Premières fleurs',
    normal: 'La plante prend du volume et forme des feuilles avant de fleurir.',
    controle: 'Peu de fleurs ? Vérifie l’ensoleillement (6 h de soleil direct au moins pour les légumes-fruits) et évite les engrais trop riches en azote.'
  },
  fruits: {
    titre: 'Premiers fruits',
    bouton: 'Premiers fruits',
    normal: 'Des fleurs s’ouvrent et fanent ; certaines tombent sans donner de fruit, c’est fréquent au début.',
    controle: 'Si les fleurs tombent toutes : chaleur excessive (> 32 °C), nuits trop fraîches ou arrosage irrégulier. Arrose régulièrement au pied et patiente.'
  },
  recolte: {
    titre: 'Première récolte',
    bouton: 'Première récolte',
    normal: 'La culture se développe vers la maturité.',
    controle: 'La récolte tarde : la météo fraîche ralentit beaucoup la croissance. Observe le signe de maturité indiqué plutôt que la date.'
  }
};

if (typeof module !== 'undefined') module.exports = ETAPES;

/*
 * Maladies et nuisibles courants du potager amateur, avec des solutions simples.
 * Priorité à la prévention et aux gestes sans produit. Sources : fiches
 * jardinage de la SNHF, Terre vivante, Rustica, guides « jardiner autrement »
 * (Ecophyto / jardiner-autrement.fr). À valider.
 *  - risque : conditions météo qui favorisent le problème (utilisées pour les alertes)
 */
var PROBLEMES = [
  {
    id: 'limaces', nom: 'Limaces et escargots', emoji: '🐌',
    cultures: ['laitue', 'mache', 'epinard', 'fraise', 'courgette', 'concombre', 'haricot-nain', 'betterave', 'radis', 'carotte'],
    signes: 'Feuilles trouées ou dévorées par le bord, traces brillantes, jeunes plants coupés au ras du sol après une nuit humide.',
    prevenir: 'Arrose le matin plutôt que le soir. Évite de pailler autour des tout jeunes semis. Protège les jeunes plants avec une bouteille coupée.',
    agir: 'Ramasse-les à la lampe le soir après la pluie. Pose des planches ou tuiles au sol : elles s’y cachent, tu les ramasses le matin. Une bande de cendre sèche ou de coquilles broyées freine leur passage (à renouveler après la pluie).',
    risque: { pluieRecente: 5, tminMin: 5 }
  },
  {
    id: 'pucerons', nom: 'Pucerons', emoji: '🐜',
    cultures: ['laitue', 'poivron', 'haricot-nain', 'fraise', 'tomate', 'tomate-cerise', 'concombre', 'courgette', 'betterave', 'epinard'],
    signes: 'Petits insectes verts ou noirs en colonies sous les feuilles ou au bout des tiges, feuilles enroulées et collantes, fourmis qui montent.',
    prevenir: 'Évite les engrais trop riches en azote. Laisse des fleurs (souci, capucine) pour attirer coccinelles et syrphes, qui les mangent.',
    agir: 'Écrase-les entre les doigts ou chasse-les avec un jet d’eau. Si besoin, pulvérise de l’eau avec un peu de savon noir (1 cuillère à soupe par litre), le soir, sous les feuilles.'
  },
  {
    id: 'mildiou', nom: 'Mildiou', emoji: '🍂',
    cultures: ['tomate', 'tomate-cerise'],
    signes: 'Taches brunes qui s’étendent vite sur les feuilles (duvet blanc dessous par temps humide), tiges noircies, fruits marbrés de brun.',
    prevenir: 'Arrose au pied, jamais le feuillage. Espace les pieds pour que l’air circule. Couvre les tomates d’un abri contre la pluie si possible. Retire les feuilles du bas qui touchent la terre.',
    agir: 'Coupe et jette (pas au compost) les feuilles atteintes dès les premières taches. Une bouillie bordelaise en prévention, avant une période pluvieuse, limite la contamination (respecte la dose indiquée).',
    risque: { joursPluvieux: 2, tmaxMin: 15, tmaxMax: 28 }
  },
  {
    id: 'oidium', nom: 'Oïdium (« blanc »)', emoji: '⚪',
    cultures: ['courgette', 'concombre', 'fraise'],
    signes: 'Poudre blanche sur les feuilles, qui jaunissent puis sèchent. Fréquent en fin d’été quand les nuits sont humides et les journées chaudes.',
    prevenir: 'Arrose au pied. Évite de planter trop serré. Ne mets pas courgettes et concombres côte à côte.',
    agir: 'Coupe les feuilles très atteintes. Pulvérise du lait écrémé dilué (1 volume pour 9 d’eau) une fois par semaine sur les feuilles, le matin.'
  },
  {
    id: 'mouche-carotte', nom: 'Mouche de la carotte', emoji: '🪰',
    cultures: ['carotte'],
    signes: 'Galeries brun-rouille dans les carottes, feuillage qui rougit et flétrit.',
    prevenir: 'Éclaircis le soir et arrose après (l’odeur attire la mouche). Associe avec des oignons ou de l’ail. Un voile anti-insectes posé dès le semis est la protection la plus sûre.',
    agir: 'Arrache et jette les carottes atteintes. Laisse le voile en place jusqu’à la récolte.'
  },
  {
    id: 'altises', nom: 'Altises (« puces de terre »)', emoji: '🔴',
    cultures: ['radis'],
    signes: 'Feuilles criblées de petits trous ronds, minuscules insectes noirs qui sautent quand on approche. Fréquent par temps chaud et sec.',
    prevenir: 'Garde la terre humide : les altises détestent l’humidité. Un voile anti-insectes protège les semis.',
    agir: 'Arrose légèrement les feuilles le matin par temps sec. Les radis restent mangeables malgré les trous.'
  },
  {
    id: 'cul-noir', nom: 'Cul noir des tomates', emoji: '⚫',
    cultures: ['tomate', 'tomate-cerise', 'poivron'],
    signes: 'Tache noire et sèche sous le fruit, à l’opposé de la queue. Ce n’est pas une maladie : la plante manque de calcium à cause d’un arrosage irrégulier.',
    prevenir: 'Arrose régulièrement, sans laisser la terre sécher complètement puis la noyer. Paille le pied.',
    agir: 'Retire les fruits atteints ; les suivants seront normaux si l’arrosage devient régulier.'
  },
  {
    id: 'pourriture-grise', nom: 'Pourriture grise (botrytis)', emoji: '🩶',
    cultures: ['fraise', 'laitue', 'tomate'],
    signes: 'Moisissure grise et duveteuse sur les fruits ou à la base des salades, par temps humide et doux.',
    prevenir: 'Paille sous les fraises pour que les fruits ne touchent pas la terre. Arrose le matin, au pied. Évite les plantations trop serrées.',
    agir: 'Retire et jette tout de suite les fruits et feuilles atteints.',
    risque: { joursPluvieux: 3, tmaxMin: 12, tmaxMax: 25 }
  },
  {
    id: 'montee-graines', nom: 'Montée en graines', emoji: '🌾',
    cultures: ['laitue', 'epinard', 'radis', 'mache'],
    signes: 'Le cœur s’allonge en tige, les feuilles deviennent amères, une hampe florale apparaît.',
    prevenir: 'Sème aux bonnes dates (évite les semis d’épinard et de radis en plein été), arrose régulièrement, ombre par fortes chaleurs.',
    agir: 'Récolte tout de suite ce qui est encore mangeable, puis ressème à une meilleure période ou à l’ombre.'
  },
  {
    id: 'fonte-semis', nom: 'Fonte des semis', emoji: '🥀',
    cultures: ['tomate', 'tomate-cerise', 'poivron', 'laitue', 'concombre', 'courgette', 'betterave'],
    signes: 'Les jeunes plantules s’effondrent d’un coup, la tige pourrit au ras de la terre.',
    prevenir: 'Utilise un terreau neuf pour les semis, n’arrose pas trop, aère la pièce, ne sème pas trop serré.',
    agir: 'Retire les plantules couchées et laisse sécher la surface entre deux arrosages. Ressème si besoin dans un terreau neuf.'
  },
  {
    id: 'rouille-ail', nom: 'Rouille de l’ail et de l’oignon', emoji: '🟠',
    cultures: ['ail', 'oignon'],
    signes: 'Petites pustules orange sur les feuilles au printemps.',
    prevenir: 'Ne replante pas ail ou oignon au même endroit avant 3-4 ans. Espace les rangs, n’arrose pas le feuillage.',
    agir: 'Retire les feuilles très atteintes. La récolte reste en général mangeable.'
  },
  {
    id: 'ver-gris', nom: 'Vers gris et larves du sol', emoji: '🐛',
    cultures: ['laitue', 'betterave', 'carotte', 'courgette', 'haricot-nain'],
    signes: 'Jeunes plants coupés net au collet pendant la nuit ; en grattant, on trouve une chenille grise enroulée.',
    prevenir: 'Griffe la terre avant de planter pour exposer les larves aux oiseaux.',
    agir: 'Gratte la terre au pied du plant coupé, le matin : la larve est souvent juste là. Retire-la.'
  }
];
if (typeof module !== 'undefined') module.exports = PROBLEMES;

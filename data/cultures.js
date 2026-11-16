/*
 * FICHES CULTURES — V1 (15 cultures)
 * ----------------------------------
 * Données horticoles séparées du code d'interface. Sources et limites :
 * voir data/REFERENCES.md. Toutes les valeurs sont des fourchettes indicatives
 * pour un jardin amateur et restent À VALIDER sur le terrain.
 *
 * Conventions :
 *  - Dates « MM-JJ » exprimées pour la zone climatique de référence « tempéré »
 *    (Bassin parisien / Centre). Elles sont décalées automatiquement selon la zone
 *    (data/climats.js).
 *  - demarrage.<geste>.fenetres : périodes favorables ; `top` = sous-périodes
 *    particulièrement favorables. Gestes : semis_abri, semis_place, plantation.
 *  - parcours.<mode> : suite d'étapes après le démarrage. Modes : semis_place
 *    (semé dehors), semis_abri (semé à l'abri puis mis en terre), plant (plant
 *    acheté ou bulbe/caïeu mis en terre). `j:[min,max]` = délai en jours depuis
 *    l'étape précédente. `calendaire` = l'étape ne peut pas survenir avant cette
 *    période (ex. récolte de l'ail en été quelle que soit la date de plantation).
 *  - espacement en cm : `plant` = entre deux plants sur le rang, `rang` = entre rangs.
 *  - froid.gelTolere : température minimale (°C) supportée par les jeunes plants.
 *    froid.nuitMin : en dessous, un geste dehors est déconseillé (attendre).
 *    froid.nuitIdeale : au-dessus, conditions favorables.
 *  - chaleur.semisMax : au-delà (max diurne), la levée devient difficile.
 *  - varietes[].facteur : précocité relative (0,85 = environ 15 % plus rapide).
 */
var CULTURES = [
  {
    id: 'tomate',
    nom: 'Tomate',
    emoji: '🍅',
    famille: 'Solanacées',
    soleil: ['plein'],
    bac: { possible: true, profondeurMin: 40 },
    espacement: { plant: 50, rang: 70 },
    unite: 'pieds',
    froid: { sensible: true, gelTolere: 2, nuitMin: 8, nuitIdeale: 12 },
    demarrage: {
      semis_abri: {
        fenetres: [{ du: '02-20', au: '04-15', top: [['03-10', '04-01']] }],
        comment: 'Semer sous abri : en godets, à l’intérieur au chaud (20-25 °C) et très près d’une fenêtre.'
      },
      plantation: {
        fenetres: [{ du: '05-10', au: '06-20', top: [['05-15', '06-05']] }],
        comment: 'Mettre un plant en terre : enterrer la tige jusqu’aux premières feuilles, installer un tuteur.'
      }
    },
    parcours: {
      semis_abri: [
        { etape: 'levee', j: [6, 12] },
        { etape: 'plantation', j: [40, 60], calendaire: { du: '05-10', au: '06-05' } },
        { etape: 'reprise', j: [5, 10] },
        { etape: 'floraison', j: [10, 25] },
        { etape: 'fruits', j: [7, 14] },
        { etape: 'recolte', j: [30, 45] }
      ],
      plant: [
        { etape: 'reprise', j: [5, 10] },
        { etape: 'floraison', j: [10, 25] },
        { etape: 'fruits', j: [7, 14] },
        { etape: 'recolte', j: [30, 45] }
      ]
    },
    etapes: {
      levee: { controle: 'Sous 15 °C la tomate lève très mal. Mets les godets dans la pièce la plus chaude ; au-delà de 3 semaines sans rien, ressème.' },
      recolte: { normal: 'Les fruits grossissent, restent verts plusieurs semaines puis changent de couleur à partir de la base.' }
    },
    gestes: [
      { apres: 'plantation', j: [0, 5], titre: 'Tuteurer', consigne: 'Plante un tuteur solide (1,5 m) et attache la tige sans serrer, en huit.' },
      { apres: 'reprise', j: [0, 21], titre: 'Pailler', consigne: 'Pose 5 cm de paille ou tonte sèche au pied : la terre reste fraîche et tu arroses moins.' },
      { apres: 'reprise', j: [7, 90], titre: 'Supprimer les gourmands', consigne: 'Pince à la main les pousses qui naissent entre la tige et une feuille, quand elles font 2-3 cm.' },
      { apres: 'fruits', j: [0, 60], titre: 'Arroser au pied', consigne: 'Arrose régulièrement au pied, jamais sur le feuillage (risque de mildiou).' }
    ],
    arrosage: { besoin: 'eleve', consigne: 'Arrosage régulier au pied, sans mouiller les feuilles. L’irrégularité provoque fruits fendus et « cul noir ».' },
    recolte: {
      multiple: true,
      signe: 'Fruit bien coloré sur toute sa surface, qui cède légèrement sous le doigt et se détache facilement.',
      duree: 'jusqu’aux premières fraîcheurs d’automne'
    },
    varietes: [
      { id: 'marmande', nom: 'Marmande', facteur: 0.9, note: 'assez précoce, fiable' },
      { id: 'saint-pierre', nom: 'Saint-Pierre', facteur: 1.0, note: 'mi-saison' },
      { id: 'coeur-de-boeuf', nom: 'Cœur de bœuf', facteur: 1.15, note: 'tardive, gros fruits' }
    ],
    ensuite: ['mache', 'epinard', 'ail', 'fraise']
  },

  {
    id: 'tomate-cerise',
    nom: 'Tomate cerise',
    emoji: '🍒',
    famille: 'Solanacées',
    soleil: ['plein'],
    bac: { possible: true, profondeurMin: 30 },
    espacement: { plant: 50, rang: 60 },
    unite: 'pieds',
    froid: { sensible: true, gelTolere: 2, nuitMin: 8, nuitIdeale: 12 },
    demarrage: {
      semis_abri: {
        fenetres: [{ du: '02-20', au: '04-15', top: [['03-10', '04-01']] }],
        comment: 'Semer sous abri : en godets, au chaud (20-25 °C) près d’une fenêtre.'
      },
      plantation: {
        fenetres: [{ du: '05-10', au: '06-20', top: [['05-15', '06-05']] }],
        comment: 'Mettre un plant en terre : enterrer la tige jusqu’aux premières feuilles, avec un tuteur.'
      }
    },
    parcours: {
      semis_abri: [
        { etape: 'levee', j: [6, 12] },
        { etape: 'plantation', j: [40, 60], calendaire: { du: '05-10', au: '06-05' } },
        { etape: 'reprise', j: [5, 10] },
        { etape: 'floraison', j: [8, 20] },
        { etape: 'fruits', j: [7, 12] },
        { etape: 'recolte', j: [25, 35] }
      ],
      plant: [
        { etape: 'reprise', j: [5, 10] },
        { etape: 'floraison', j: [8, 20] },
        { etape: 'fruits', j: [7, 12] },
        { etape: 'recolte', j: [25, 35] }
      ]
    },
    etapes: {},
    gestes: [
      { apres: 'plantation', j: [0, 5], titre: 'Tuteurer', consigne: 'Installe un tuteur ou une ficelle : la tomate cerise monte vite.' },
      { apres: 'reprise', j: [0, 21], titre: 'Pailler', consigne: 'Paille le pied pour garder la fraîcheur.' },
      { apres: 'reprise', j: [7, 90], titre: 'Supprimer les gourmands', consigne: 'Pince les gourmands sous la première grappe de fleurs ; au-dessus, tu peux en laisser quelques-uns.' }
    ],
    arrosage: { besoin: 'eleve', consigne: 'Arrosage régulier au pied ; en bac, vérifier tous les jours en été.' },
    recolte: {
      multiple: true,
      signe: 'Grappes bien colorées, fruits brillants qui se détachent tout seuls entre les doigts.',
      duree: 'jusqu’à l’automne'
    },
    varietes: [
      { id: 'cerise-rouge', nom: 'Cerise rouge', facteur: 1.0 },
      { id: 'sweet-100', nom: 'Sweet 100 (type)', facteur: 0.9, note: 'très productive' },
      { id: 'black-cherry', nom: 'Black Cherry', facteur: 1.05 }
    ],
    ensuite: ['mache', 'epinard', 'ail']
  },

  {
    id: 'courgette',
    nom: 'Courgette',
    emoji: '🥒',
    famille: 'Cucurbitacées',
    soleil: ['plein'],
    bac: { possible: true, profondeurMin: 40 },
    espacement: { plant: 80, rang: 100 },
    unite: 'pieds',
    froid: { sensible: true, gelTolere: 2, nuitMin: 8, nuitIdeale: 12 },
    chaleur: {},
    demarrage: {
      semis_abri: {
        fenetres: [{ du: '04-01', au: '05-10', top: [['04-15', '05-01']] }],
        comment: 'Semer sous abri : 2 graines par godet de 8-10 cm, au chaud ; garder la plus belle.'
      },
      semis_place: {
        fenetres: [{ du: '05-15', au: '06-30', top: [['05-20', '06-10']] }],
        comment: 'Semer en place : 2-3 graines par trou, à 2 cm de profondeur, dans une terre réchauffée.'
      },
      plantation: {
        fenetres: [{ du: '05-10', au: '06-30', top: [['05-15', '06-10']] }],
        comment: 'Mettre un plant en terre : dans un trou enrichi de compost, sans abîmer la motte.'
      }
    },
    parcours: {
      semis_place: [
        { etape: 'levee', j: [5, 10] },
        { etape: 'feuilles', j: [7, 12] },
        { etape: 'floraison', j: [25, 35] },
        { etape: 'fruits', j: [4, 8] },
        { etape: 'recolte', j: [4, 8] }
      ],
      semis_abri: [
        { etape: 'levee', j: [5, 10] },
        { etape: 'plantation', j: [18, 30], calendaire: { du: '05-10', au: '06-10' } },
        { etape: 'reprise', j: [4, 8] },
        { etape: 'floraison', j: [20, 30] },
        { etape: 'fruits', j: [4, 8] },
        { etape: 'recolte', j: [4, 8] }
      ],
      plant: [
        { etape: 'reprise', j: [4, 8] },
        { etape: 'floraison', j: [20, 30] },
        { etape: 'fruits', j: [4, 8] },
        { etape: 'recolte', j: [4, 8] }
      ]
    },
    etapes: {
      fruits: { normal: 'Les premières fleurs sont souvent toutes mâles (sans petite courgette à la base) : elles tombent, c’est normal.' }
    },
    gestes: [
      { apres: 'reprise', j: [0, 21], titre: 'Pailler', consigne: 'Paille généreusement le pied : la courgette aime une terre fraîche.' },
      { apres: 'fruits', j: [0, 60], titre: 'Cueillir jeune', consigne: 'Cueille tous les 2-3 jours à 15-20 cm : la plante produit davantage.' }
    ],
    arrosage: { besoin: 'eleve', consigne: 'Gros besoin d’eau : arrose copieusement au pied, sans mouiller les feuilles (oïdium).' },
    recolte: {
      multiple: true,
      signe: 'Courgette de 15 à 20 cm, peau brillante, fleur encore attachée ou à peine fanée.',
      duree: 'pendant 2 à 3 mois'
    },
    varietes: [
      { id: 'verte-maraicher', nom: 'Verte des maraîchers', facteur: 1.0 },
      { id: 'ronde-nice', nom: 'Ronde de Nice', facteur: 0.95 },
      { id: 'gold-rush', nom: 'Gold Rush (jaune)', facteur: 1.0 }
    ],
    ensuite: ['mache', 'epinard', 'ail', 'laitue']
  },

  {
    id: 'concombre',
    nom: 'Concombre',
    emoji: '🥒',
    famille: 'Cucurbitacées',
    soleil: ['plein'],
    bac: { possible: true, profondeurMin: 30 },
    espacement: { plant: 50, rang: 100 },
    unite: 'pieds',
    froid: { sensible: true, gelTolere: 3, nuitMin: 10, nuitIdeale: 14 },
    demarrage: {
      semis_abri: {
        fenetres: [{ du: '04-01', au: '05-10', top: [['04-15', '05-05']] }],
        comment: 'Semer sous abri : 2 graines par godet, au chaud (> 20 °C).'
      },
      semis_place: {
        fenetres: [{ du: '05-20', au: '06-30', top: [['05-25', '06-15']] }],
        comment: 'Semer en place : 3 graines par poquet, dans une terre bien réchauffée.'
      },
      plantation: {
        fenetres: [{ du: '05-15', au: '06-30', top: [['05-20', '06-15']] }],
        comment: 'Mettre un plant en terre : au pied d’un treillage ou d’un filet pour qu’il grimpe.'
      }
    },
    parcours: {
      semis_place: [
        { etape: 'levee', j: [5, 10] },
        { etape: 'feuilles', j: [7, 12] },
        { etape: 'floraison', j: [25, 35] },
        { etape: 'fruits', j: [5, 10] },
        { etape: 'recolte', j: [8, 14] }
      ],
      semis_abri: [
        { etape: 'levee', j: [5, 10] },
        { etape: 'plantation', j: [18, 30], calendaire: { du: '05-15', au: '06-15' } },
        { etape: 'reprise', j: [5, 10] },
        { etape: 'floraison', j: [20, 30] },
        { etape: 'fruits', j: [5, 10] },
        { etape: 'recolte', j: [8, 14] }
      ],
      plant: [
        { etape: 'reprise', j: [5, 10] },
        { etape: 'floraison', j: [20, 30] },
        { etape: 'fruits', j: [5, 10] },
        { etape: 'recolte', j: [8, 14] }
      ]
    },
    etapes: {},
    gestes: [
      { apres: 'reprise', j: [0, 30], titre: 'Palisser', consigne: 'Guide les tiges sur un filet ou un treillage : les fruits restent propres et droits.' },
      { apres: 'reprise', j: [0, 21], titre: 'Pailler', consigne: 'Paille le pied pour garder la terre fraîche.' }
    ],
    arrosage: { besoin: 'eleve', consigne: 'Arrosage régulier à l’eau non glacée, au pied. Le manque d’eau rend les fruits amers.' },
    recolte: {
      multiple: true,
      signe: 'Fruit ferme, vert uniforme, de 15 à 25 cm selon la variété, avant qu’il ne jaunisse.',
      duree: 'pendant 6 à 8 semaines'
    },
    varietes: [
      { id: 'marketmore', nom: 'Marketmore', facteur: 1.0 },
      { id: 'vert-long-maraicher', nom: 'Vert long maraîcher', facteur: 1.0 },
      { id: 'cornichon-fin-meaux', nom: 'Cornichon fin de Meaux', facteur: 0.9 }
    ],
    ensuite: ['mache', 'epinard', 'ail']
  },

  {
    id: 'poivron',
    nom: 'Poivron',
    emoji: '🫑',
    famille: 'Solanacées',
    soleil: ['plein'],
    bac: { possible: true, profondeurMin: 30 },
    espacement: { plant: 40, rang: 50 },
    unite: 'pieds',
    froid: { sensible: true, gelTolere: 4, nuitMin: 10, nuitIdeale: 14 },
    demarrage: {
      semis_abri: {
        fenetres: [{ du: '02-15', au: '03-31', top: [['02-25', '03-20']] }],
        comment: 'Semer sous abri : tôt, en godets, au chaud (22-25 °C), levée lente.'
      },
      plantation: {
        fenetres: [{ du: '05-15', au: '06-15', top: [['05-20', '06-05']] }],
        comment: 'Mettre un plant en terre : au soleil le plus chaud du jardin, à l’abri du vent.'
      }
    },
    parcours: {
      semis_abri: [
        { etape: 'levee', j: [8, 20] },
        { etape: 'plantation', j: [55, 75], calendaire: { du: '05-15', au: '06-05' } },
        { etape: 'reprise', j: [7, 14] },
        { etape: 'floraison', j: [20, 35] },
        { etape: 'fruits', j: [7, 14] },
        { etape: 'recolte', j: [30, 50] }
      ],
      plant: [
        { etape: 'reprise', j: [7, 14] },
        { etape: 'floraison', j: [20, 35] },
        { etape: 'fruits', j: [7, 14] },
        { etape: 'recolte', j: [30, 50] }
      ]
    },
    etapes: {
      levee: { controle: 'Le poivron peut mettre 3 semaines à lever, surtout sous 20 °C. Au-delà de 4 semaines sans rien, ressème au chaud.' }
    },
    gestes: [
      { apres: 'plantation', j: [0, 7], titre: 'Tuteurer', consigne: 'Un petit tuteur évite que la plante chargée de fruits ne casse.' },
      { apres: 'reprise', j: [0, 21], titre: 'Pailler', consigne: 'Paille une fois la terre bien réchauffée.' }
    ],
    arrosage: { besoin: 'moyen', consigne: 'Arrosage régulier, modéré : le poivron n’aime ni la sécheresse ni l’excès d’eau.' },
    recolte: {
      multiple: true,
      signe: 'Fruit ferme et brillant à sa taille finale. Vert, il est mangeable ; laissé sur pied, il rougit et devient plus sucré.',
      duree: 'jusqu’à l’automne'
    },
    varietes: [
      { id: 'doux-espagne', nom: 'Doux d’Espagne', facteur: 1.0 },
      { id: 'corno-di-toro', nom: 'Corno di Toro', facteur: 1.05 },
      { id: 'petit-marseillais', nom: 'Petit Marseillais', facteur: 0.9, note: 'précoce, adapté aux bacs' }
    ],
    ensuite: ['mache', 'ail', 'epinard']
  },

  {
    id: 'laitue',
    nom: 'Laitue',
    emoji: '🥬',
    famille: 'Astéracées',
    soleil: ['plein', 'mi-ombre'],
    bac: { possible: true, profondeurMin: 15 },
    espacement: { plant: 25, rang: 30 },
    unite: 'salades',
    froid: { sensible: false, gelTolere: -3, nuitMin: 0, nuitIdeale: 5 },
    chaleur: { semisMax: 25 },
    demarrage: {
      semis_abri: {
        fenetres: [{ du: '02-01', au: '04-15', top: [['03-01', '03-31']] }],
        comment: 'Semer sous abri : en caissette ou mini-mottes, au frais lumineux (15-18 °C).'
      },
      semis_place: {
        fenetres: [
          { du: '03-15', au: '08-31', top: [['04-01', '05-15']] },
          { du: '09-01', au: '09-30' }
        ],
        comment: 'Semer en place : en ligne, graines à peine recouvertes, puis éclaircir.'
      },
      plantation: {
        fenetres: [
          { du: '03-20', au: '06-30', top: [['04-01', '05-31']] },
          { du: '08-15', au: '10-15', top: [['09-01', '09-30']] }
        ],
        comment: 'Mettre un plant en terre : sans enterrer le collet (la base des feuilles).'
      }
    },
    parcours: {
      semis_place: [
        { etape: 'levee', j: [4, 10] },
        { etape: 'feuilles', j: [10, 18] },
        { etape: 'recolte', j: [30, 45] }
      ],
      semis_abri: [
        { etape: 'levee', j: [4, 10] },
        { etape: 'plantation', j: [20, 35] },
        { etape: 'reprise', j: [4, 8] },
        { etape: 'recolte', j: [30, 45] }
      ],
      plant: [
        { etape: 'reprise', j: [4, 8] },
        { etape: 'recolte', j: [30, 45] }
      ]
    },
    etapes: {
      levee: { controle: 'Au-delà de 25 °C, la laitue lève mal. Ressème le soir, à l’ombre, sur une terre bien humidifiée.' }
    },
    gestes: [
      { apres: 'feuilles', j: [0, 10], titre: 'Éclaircir', consigne: 'Ne garde qu’une salade tous les 25 cm ; repique les autres ailleurs si tu veux.' },
      { apres: 'reprise', j: [0, 30], titre: 'Surveiller les limaces', consigne: 'Inspecte le soir après la pluie ; quelques planches posées au sol servent de pièges.' }
    ],
    arrosage: { besoin: 'moyen', consigne: 'Arrosage léger et fréquent, le matin, en évitant de mouiller le cœur le soir.' },
    recolte: {
      multiple: false,
      signe: 'Pomme bien formée et ferme au toucher. Récolte avant que le cœur s’allonge (montée en graines).'
    },
    varietes: [
      { id: 'batavia', nom: 'Batavia', facteur: 1.0 },
      { id: 'feuille-chene', nom: 'Feuille de chêne', facteur: 0.9 },
      { id: 'merveille-4-saisons', nom: 'Merveille des 4 saisons', facteur: 1.05 }
    ],
    ensuite: ['radis', 'haricot-nain', 'mache', 'carotte']
  },

  {
    id: 'mache',
    nom: 'Mâche',
    emoji: '🌿',
    famille: 'Valérianacées',
    soleil: ['plein', 'mi-ombre'],
    bac: { possible: true, profondeurMin: 10 },
    espacement: { plant: 8, rang: 10 },
    unite: 'rosettes',
    froid: { sensible: false, gelTolere: -10, nuitMin: -5, nuitIdeale: 0 },
    chaleur: { semisMax: 25 },
    demarrage: {
      semis_place: {
        fenetres: [{ du: '07-25', au: '10-15', top: [['08-15', '09-20']] }],
        comment: 'Semer en place : à la volée ou en ligne sur une terre tassée, graines juste recouvertes.'
      }
    },
    parcours: {
      semis_place: [
        { etape: 'levee', j: [7, 15] },
        { etape: 'feuilles', j: [15, 25] },
        { etape: 'recolte', j: [30, 50] }
      ]
    },
    etapes: {
      levee: { controle: 'La mâche lève lentement et mal par temps chaud. Garde la surface humide (planche ou toile de jute posée dessus jusqu’à la levée).' }
    },
    gestes: [
      { apres: 'levee', j: [0, 15], titre: 'Garder humide', consigne: 'Arrose finement en pluie : les jeunes plantules sèchent vite en surface.' }
    ],
    arrosage: { besoin: 'faible', consigne: 'Peu d’eau une fois installée ; l’automne suffit souvent.' },
    recolte: {
      multiple: false,
      signe: 'Rosettes de 4 à 6 feuilles bien vertes. Coupe la rosette entière au ras du sol, avant la floraison.'
    },
    varietes: [
      { id: 'verte-cambrai', nom: 'Verte de Cambrai', facteur: 1.05, note: 'très rustique' },
      { id: 'coquille-louviers', nom: 'Coquille de Louviers', facteur: 1.0 }
    ],
    ensuite: ['tomate', 'courgette', 'haricot-nain', 'radis']
  },

  {
    id: 'epinard',
    nom: 'Épinard',
    emoji: '🥬',
    famille: 'Amaranthacées',
    soleil: ['plein', 'mi-ombre'],
    bac: { possible: true, profondeurMin: 20 },
    espacement: { plant: 10, rang: 25 },
    unite: 'pieds',
    froid: { sensible: false, gelTolere: -8, nuitMin: -3, nuitIdeale: 2 },
    chaleur: { semisMax: 24 },
    demarrage: {
      semis_place: {
        fenetres: [
          { du: '02-15', au: '04-15', top: [['03-01', '03-31']] },
          { du: '08-15', au: '10-15', top: [['09-01', '09-30']] }
        ],
        comment: 'Semer en place : en ligne à 2 cm de profondeur ; graines trempées 12 h la veille.'
      }
    },
    parcours: {
      semis_place: [
        { etape: 'levee', j: [6, 14] },
        { etape: 'feuilles', j: [12, 20] },
        { etape: 'recolte', j: [25, 35] }
      ]
    },
    etapes: {},
    gestes: [
      { apres: 'feuilles', j: [0, 10], titre: 'Éclaircir', consigne: 'Laisse 10 cm entre les pieds.' }
    ],
    arrosage: { besoin: 'moyen', consigne: 'Terre fraîche en permanence ; le manque d’eau le fait monter en graines.' },
    recolte: {
      multiple: true,
      signe: 'Feuilles de 8-10 cm. Cueille les plus grandes à l’extérieur et laisse le cœur repousser.',
      duree: 'pendant 4 à 8 semaines'
    },
    varietes: [
      { id: 'geant-hiver', nom: 'Géant d’hiver', facteur: 1.1, note: 'semis d’automne' },
      { id: 'monstrueux-viroflay', nom: 'Monstrueux de Viroflay', facteur: 1.0 }
    ],
    ensuite: ['tomate', 'courgette', 'haricot-nain', 'radis']
  },

  {
    id: 'radis',
    nom: 'Radis',
    emoji: '🔴',
    famille: 'Brassicacées',
    soleil: ['plein', 'mi-ombre'],
    bac: { possible: true, profondeurMin: 15 },
    espacement: { plant: 3, rang: 15 },
    unite: 'radis',
    froid: { sensible: false, gelTolere: -4, nuitMin: -2, nuitIdeale: 4 },
    chaleur: { semisMax: 26 },
    demarrage: {
      semis_place: {
        fenetres: [
          { du: '03-01', au: '05-31', top: [['03-20', '05-10']] },
          { du: '08-20', au: '10-05', top: [['09-01', '09-20']] }
        ],
        comment: 'Semer en place : en ligne, à 1 cm de profondeur, une graine tous les 2-3 cm.'
      }
    },
    parcours: {
      semis_place: [
        { etape: 'levee', j: [3, 7] },
        { etape: 'feuilles', j: [4, 8] },
        { etape: 'recolte', j: [12, 20] }
      ]
    },
    etapes: {
      levee: { normal: 'Le radis lève vite : de petites feuilles en forme de cœur sortent en 3 à 7 jours.' },
      recolte: { normal: 'Les feuilles grandissent et la racine commence à rosir au niveau du collet.' }
    },
    gestes: [
      { apres: 'levee', j: [4, 12], titre: 'Éclaircir', consigne: 'Laisse 3 cm entre deux radis en arrachant les plus petits : sinon ils ne forment pas de boule.' }
    ],
    arrosage: { besoin: 'moyen', consigne: 'Terre toujours fraîche : un radis qui manque d’eau devient creux et piquant.' },
    recolte: {
      multiple: false,
      signe: 'Racine de 2 à 3 cm qui affleure au ras du sol. Récolte sans tarder : trop attendu, le radis devient creux.'
    },
    varietes: [
      { id: '18-jours', nom: 'Radis de 18 jours', facteur: 0.85, note: 'très rapide' },
      { id: 'flamboyant', nom: 'Flamboyant', facteur: 1.0 },
      { id: 'rond-ecarlate', nom: 'Rond écarlate', facteur: 1.0 }
    ],
    ensuite: ['laitue', 'carotte', 'haricot-nain', 'radis']
  },

  {
    id: 'carotte',
    nom: 'Carotte',
    emoji: '🥕',
    famille: 'Apiacées',
    soleil: ['plein', 'mi-ombre'],
    bac: { possible: true, profondeurMin: 30 },
    espacement: { plant: 4, rang: 20 },
    unite: 'carottes',
    froid: { sensible: false, gelTolere: -4, nuitMin: 0, nuitIdeale: 6 },
    chaleur: { semisMax: 30 },
    demarrage: {
      semis_place: {
        fenetres: [{ du: '03-10', au: '07-15', top: [['04-01', '05-15']] }],
        comment: 'Semer en place : en ligne peu profonde (1 cm) dans une terre fine, sans cailloux.'
      }
    },
    parcours: {
      semis_place: [
        { etape: 'levee', j: [10, 21] },
        { etape: 'feuilles', j: [12, 20] },
        { etape: 'recolte', j: [50, 75] }
      ]
    },
    etapes: {
      levee: {
        normal: 'La carotte est lente : 2 à 3 semaines sans rien voir, c’est normal. Garde la ligne humide en surface.',
        controle: 'Au-delà de 4 semaines, gratte la ligne : si les graines n’ont pas germé (croûte, sécheresse), ressème en couvrant d’un peu de terreau.'
      }
    },
    gestes: [
      { apres: 'feuilles', j: [5, 20], titre: 'Éclaircir', consigne: 'Laisse 4 cm entre deux carottes, de préférence le soir et en arrosant après (la mouche de la carotte est attirée par l’odeur).' }
    ],
    arrosage: { besoin: 'moyen', consigne: 'Régulier jusqu’à la levée et pendant la croissance ; à-coups d’arrosage = carottes fendues.' },
    recolte: {
      multiple: false,
      signe: 'Collet orangé de 2 cm de diamètre visible au ras du sol. Tire une carotte « test » avant de récolter le rang.'
    },
    varietes: [
      { id: 'nantaise', nom: 'Nantaise améliorée', facteur: 1.0 },
      { id: 'marche-paris', nom: 'Grelot / Marché de Paris (ronde)', facteur: 0.8, note: 'idéale en bac peu profond' },
      { id: 'chantenay', nom: 'Chantenay', facteur: 1.1 }
    ],
    ensuite: ['mache', 'epinard', 'ail', 'laitue']
  },

  {
    id: 'betterave',
    nom: 'Betterave',
    emoji: '🟣',
    famille: 'Amaranthacées',
    soleil: ['plein', 'mi-ombre'],
    bac: { possible: true, profondeurMin: 25 },
    espacement: { plant: 10, rang: 30 },
    unite: 'betteraves',
    froid: { sensible: false, gelTolere: -2, nuitMin: 3, nuitIdeale: 8 },
    demarrage: {
      semis_abri: {
        fenetres: [{ du: '03-01', au: '04-15', top: [['03-15', '04-05']] }],
        comment: 'Semer sous abri : une « graine » (glomérule) par mini-motte, elle donne plusieurs plantules.'
      },
      semis_place: {
        fenetres: [{ du: '04-15', au: '07-10', top: [['05-01', '06-15']] }],
        comment: 'Semer en place : graines trempées une nuit, à 2 cm de profondeur, tous les 10 cm.'
      },
      plantation: {
        fenetres: [{ du: '04-20', au: '06-15', top: [['05-01', '05-31']] }],
        comment: 'Mettre un plant en terre : garder 1 ou 2 plantules par motte.'
      }
    },
    parcours: {
      semis_place: [
        { etape: 'levee', j: [7, 15] },
        { etape: 'feuilles', j: [10, 20] },
        { etape: 'recolte', j: [50, 70] }
      ],
      semis_abri: [
        { etape: 'levee', j: [7, 15] },
        { etape: 'plantation', j: [20, 35], calendaire: { du: '04-20', au: '05-31' } },
        { etape: 'reprise', j: [5, 10] },
        { etape: 'recolte', j: [50, 70] }
      ],
      plant: [
        { etape: 'reprise', j: [5, 10] },
        { etape: 'recolte', j: [50, 70] }
      ]
    },
    etapes: {
      feuilles: { normal: 'Chaque graine donne souvent 2 à 4 plantules collées : c’est normal, on éclaircit ensuite.' }
    },
    gestes: [
      { apres: 'feuilles', j: [0, 15], titre: 'Éclaircir', consigne: 'Ne garde qu’une plantule tous les 10 cm (les jeunes feuilles se mangent en salade).' }
    ],
    arrosage: { besoin: 'moyen', consigne: 'Arrosage régulier ; une sécheresse rend la racine fibreuse.' },
    recolte: {
      multiple: false,
      signe: 'Racine de 5 à 8 cm de diamètre (une balle de tennis). Plus grosse, elle devient fibreuse.'
    },
    varietes: [
      { id: 'detroit', nom: 'Detroit (ronde rouge)', facteur: 0.9 },
      { id: 'chioggia', nom: 'Chioggia', facteur: 0.95 },
      { id: 'crapaudine', nom: 'Crapaudine', facteur: 1.3, note: 'longue, tardive' }
    ],
    ensuite: ['mache', 'epinard', 'ail', 'radis']
  },

  {
    id: 'ail',
    nom: 'Ail',
    emoji: '🧄',
    famille: 'Amaryllidacées',
    soleil: ['plein'],
    bac: { possible: true, profondeurMin: 20 },
    espacement: { plant: 10, rang: 25 },
    unite: 'gousses',
    froid: { sensible: false, gelTolere: -15, nuitMin: -10, nuitIdeale: -2 },
    demarrage: {
      plantation: {
        fenetres: [
          { du: '10-15', au: '12-15', top: [['10-25', '11-25']] },
          { du: '02-01', au: '03-31', top: [['02-15', '03-15']] }
        ],
        comment: 'Planter des caïeux : gousses pointe en haut, à 3 cm de profondeur. Ail blanc/violet à l’automne, ail rose au printemps.',
        libelle: 'Planter des caïeux'
      }
    },
    parcours: {
      plant: [
        { etape: 'levee', j: [15, 35] },
        { etape: 'recolte', j: [120, 160], calendaire: { du: '06-20', au: '07-31' } }
      ]
    },
    etapes: {
      levee: {
        normal: 'Rien ne se voit pendant 2 à 5 semaines : le caïeu fait d’abord ses racines. Puis une pointe verte sort.',
        controle: 'Gratte autour d’une gousse : si elle est ferme avec des racines, patiente ; si elle est molle ou a disparu (pourriture, oiseaux), replante.'
      },
      recolte: { normal: 'Les feuilles poussent tout l’hiver et le printemps. Le bulbe se forme à partir de mai-juin.' }
    },
    gestes: [
      { apres: 'levee', j: [30, 120], titre: 'Désherber', consigne: 'L’ail supporte mal la concurrence : retire les herbes à la main, sans abîmer les bulbes.' },
      { apres: 'recolte', j: [-21, 0], titre: 'Arrêter l’arrosage', consigne: 'Plus d’arrosage les 3 dernières semaines : le bulbe se conserve mieux.' }
    ],
    arrosage: { besoin: 'faible', consigne: 'Peu d’eau : seulement en cas de printemps très sec. Jamais d’arrosage avant la récolte.', stopAvantRecolte: 21 },
    recolte: {
      multiple: false,
      signe: 'Les deux tiers des feuilles ont jauni et se couchent. Arrache par temps sec et laisse sécher 2-3 jours au soleil.'
    },
    varietes: [
      { id: 'blanc-automne', nom: 'Ail blanc (automne)', facteur: 1.0 },
      { id: 'violet', nom: 'Ail violet (automne)', facteur: 1.0 },
      { id: 'rose-printemps', nom: 'Ail rose (printemps)', facteur: 0.9 }
    ],
    ensuite: ['radis', 'laitue', 'mache', 'epinard']
  },

  {
    id: 'oignon',
    nom: 'Oignon',
    emoji: '🧅',
    famille: 'Amaryllidacées',
    soleil: ['plein'],
    bac: { possible: true, profondeurMin: 15 },
    espacement: { plant: 10, rang: 25 },
    unite: 'oignons',
    froid: { sensible: false, gelTolere: -6, nuitMin: -3, nuitIdeale: 3 },
    demarrage: {
      semis_place: {
        fenetres: [
          { du: '02-20', au: '04-10', top: [['03-01', '03-31']] },
          { du: '08-15', au: '09-15' }
        ],
        comment: 'Semer en place : en ligne, à 1 cm, puis éclaircir à 10 cm. (Août-septembre : oignon blanc.)'
      },
      plantation: {
        fenetres: [{ du: '02-20', au: '04-20', top: [['03-01', '04-05']] }],
        comment: 'Planter des bulbilles : enfoncées aux 2/3, pointe au ras de la terre.',
        libelle: 'Planter des bulbilles'
      }
    },
    parcours: {
      semis_place: [
        { etape: 'levee', j: [10, 20] },
        { etape: 'feuilles', j: [15, 25] },
        { etape: 'recolte', j: [100, 130], calendaire: { du: '07-01', au: '08-31' } }
      ],
      plant: [
        { etape: 'levee', j: [7, 15] },
        { etape: 'recolte', j: [100, 130], calendaire: { du: '07-01', au: '08-15' } }
      ]
    },
    etapes: {
      levee: { normal: 'Une fine tige verte, courbée comme un crochet au début, sort de terre.' }
    },
    gestes: [
      { apres: 'levee', j: [0, 30], titre: 'Remettre en place', consigne: 'Les oiseaux arrachent parfois les bulbilles : renfonce celles qui sont sorties.' },
      { apres: 'recolte', j: [-21, 0], titre: 'Arrêter l’arrosage', consigne: 'Plus d’arrosage à l’approche de la récolte pour une bonne conservation.' }
    ],
    arrosage: { besoin: 'faible', consigne: 'Arrosage modéré au printemps, puis plus du tout à l’approche de la récolte.', stopAvantRecolte: 21 },
    recolte: {
      multiple: false,
      signe: 'Les feuilles jaunissent et se couchent d’elles-mêmes. Arrache et laisse sécher au soleil 2-3 jours.'
    },
    varietes: [
      { id: 'jaune-paille', nom: 'Jaune paille des Vertus', facteur: 1.0 },
      { id: 'rouge-florence', nom: 'Rouge de Florence', facteur: 1.0 },
      { id: 'stuttgart', nom: 'Stuttgart (bulbilles)', facteur: 0.95 }
    ],
    ensuite: ['mache', 'epinard', 'radis', 'laitue']
  },

  {
    id: 'haricot-nain',
    nom: 'Haricot nain',
    emoji: '🫛',
    famille: 'Fabacées',
    soleil: ['plein'],
    bac: { possible: true, profondeurMin: 20 },
    espacement: { plant: 8, rang: 40 },
    unite: 'pieds',
    froid: { sensible: true, gelTolere: 2, nuitMin: 8, nuitIdeale: 12 },
    demarrage: {
      semis_place: {
        fenetres: [{ du: '05-10', au: '07-15', top: [['05-20', '06-30']] }],
        comment: 'Semer en place : uniquement dehors, en poquets de 4-5 graines ou en ligne, à 3 cm, dans une terre réchauffée (> 12 °C).'
      }
    },
    parcours: {
      semis_place: [
        { etape: 'levee', j: [6, 12] },
        { etape: 'floraison', j: [25, 35] },
        { etape: 'fruits', j: [7, 12] },
        { etape: 'recolte', j: [7, 12] }
      ]
    },
    etapes: {
      levee: {
        normal: 'La graine sort de terre en crosse, comme un petit crochet, puis déploie deux feuilles épaisses.',
        controle: 'Les graines pourrissent dans une terre froide et détrempée. Gratte : si elles sont molles, ressème quand les nuits dépassent 10 °C.'
      }
    },
    gestes: [
      { apres: 'levee', j: [10, 25], titre: 'Butter', consigne: 'Ramène un peu de terre au pied des tiges quand elles font 10-15 cm : elles tiennent mieux.' },
      { apres: 'fruits', j: [0, 30], titre: 'Cueillir souvent', consigne: 'Cueille tous les 2-3 jours : plus tu cueilles, plus il en produit.' }
    ],
    arrosage: { besoin: 'moyen', consigne: 'Peu avant la floraison, puis régulièrement au pied pendant la production.' },
    recolte: {
      multiple: true,
      signe: 'Gousses de la grosseur d’un crayon, qui cassent net, avant que les grains ne gonflent.',
      duree: 'pendant 3 à 4 semaines'
    },
    varietes: [
      { id: 'contender', nom: 'Contender', facteur: 0.95 },
      { id: 'delinel', nom: 'Delinel', facteur: 1.0 },
      { id: 'beurre-mont-dor', nom: 'Beurre Mont d’Or', facteur: 1.0 }
    ],
    ensuite: ['mache', 'epinard', 'laitue', 'radis']
  },

  {
    id: 'fraise',
    nom: 'Fraise',
    emoji: '🍓',
    famille: 'Rosacées',
    soleil: ['plein', 'mi-ombre'],
    bac: { possible: true, profondeurMin: 20 },
    espacement: { plant: 30, rang: 50 },
    unite: 'plants',
    froid: { sensible: false, gelTolere: -10, nuitMin: -5, nuitIdeale: 2 },
    demarrage: {
      plantation: {
        fenetres: [
          { du: '08-15', au: '10-31', top: [['08-25', '09-30']] },
          { du: '03-01', au: '04-30' }
        ],
        comment: 'Mettre un plant en terre : le cœur du fraisier juste au ras du sol, ni enterré ni déchaussé.'
      }
    },
    parcours: {
      plant: [
        { etape: 'reprise', j: [10, 20] },
        { etape: 'floraison', j: [20, 40], calendaire: { du: '04-10', au: '05-10' } },
        { etape: 'fruits', j: [7, 14] },
        { etape: 'recolte', j: [21, 30] }
      ]
    },
    etapes: {
      floraison: { normal: 'Après une plantation d’automne, le fraisier reste discret tout l’hiver : c’est normal, il fleurit au printemps.' }
    },
    gestes: [
      { apres: 'reprise', j: [7, 60], titre: 'Couper les stolons', consigne: 'Coupe les longues tiges rampantes (stolons) pour que le plant garde sa force pour les fruits.' },
      { apres: 'floraison', j: [0, 14], titre: 'Pailler', consigne: 'Glisse de la paille sous les feuilles : les fraises restent propres et pourrissent moins.' }
    ],
    arrosage: { besoin: 'moyen', consigne: 'Régulier pendant la floraison et la fructification, au pied, le matin.' },
    recolte: {
      multiple: true,
      signe: 'Fraise rouge jusqu’au pédoncule et parfumée. Cueille-la avec sa queue, le matin.',
      duree: 'pendant 3 à 6 semaines (plus longtemps pour les remontantes)'
    },
    varietes: [
      { id: 'gariguette', nom: 'Gariguette', facteur: 0.95, note: 'précoce' },
      { id: 'mara-des-bois', nom: 'Mara des bois', facteur: 1.0, note: 'remontante' },
      { id: 'charlotte', nom: 'Charlotte', facteur: 1.0, note: 'remontante' }
    ],
    ensuite: ['ail', 'laitue', 'radis', 'epinard']
  }
];

if (typeof module !== 'undefined') module.exports = CULTURES;

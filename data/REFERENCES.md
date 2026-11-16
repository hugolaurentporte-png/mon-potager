# Références horticoles et règles à valider

Les fiches de `data/cultures.js` sont des **fourchettes de consensus pour un potager
amateur en France métropolitaine**, compilées à partir des sources ci-dessous. Elles
n'ont pas été vérifiées ligne par ligne contre chaque source : chaque valeur reste
**à valider** (voir la liste en fin de document).

## Sources utilisées comme repères

| Domaine | Sources de référence |
|---|---|
| Calendriers de semis et plantation (zone tempérée) | *Le guide Terre vivante du potager bio* (Terre vivante) ; calendriers des semenciers grand public (Vilmorin, Graines Baumaux, Ferme de Sainte Marthe, Germinance) ; fiches de la SNHF (Société nationale d'horticulture de France) |
| Températures de germination et sensibilité au froid | Fiches culture des semenciers ; RHS (Royal Horticultural Society) « Grow your own » ; tables de températures minimales de germination couramment citées (ex. tomate > 15 °C, haricot > 12 °C, laitue < 25 °C) |
| Espacements, profondeurs en bac | Indications des sachets de graines et fiches semenciers ; guides de culture en bac (Terre vivante, Rustica) |
| Délais (levée, floraison, récolte) et précocité des variétés | « Jours jusqu'à la récolte » des catalogues semenciers (Vilmorin, Baumaux, Kokopelli, Johnny's Selected Seeds pour les délais) |
| Signes de maturité | Guides de jardinage grand public (Terre vivante, Rustica, Gerbeaud), RHS |
| Dates moyennes des dernières gelées | Normales climatiques Météo-France (ordre de grandeur par grande région) ; repère populaire des saints de glace (11-13 mai) |
| Météo en direct | Open-Meteo (prévisions, pluie horaire, altitude) — https://open-meteo.com |
| Communes et codes postaux | API officielle Découpage administratif — https://geo.api.gouv.fr |

## Règles propres à l'application (dans `js/moteur.js`, objet `REGLES`)

Ces règles ne viennent pas d'une source unique : ce sont des **choix de conception
simples**, à ajuster avec l'usage.

1. **Zones climatiques** (`data/climats.js`) : 5 zones (méditerranéen, océanique,
   tempéré, semi-continental, montagne > 700 m). Décalage des fenêtres de
   −21 à +25 jours au printemps. Détection automatique approximative par
   coordonnées et altitude ; l'utilisateur peut corriger.
2. **Quatre niveaux** : gris = hors saison ou attendre ; jaune = à moins de
   14 jours d'une fenêtre, ou nuits fraîches / chaleur ; vert clair = dans la
   fenêtre ; vert foncé = sous-période la plus favorable **et** météo
   confirmée. Sans météo, le vert foncé n'est jamais affiché (plafonné au vert clair).
3. **Affinage météo** (gestes dehors) : on regarde les 5 prochaines nuits.
   Tmin ≤ seuil de gel de la culture → « attendre, gel annoncé » ;
   Tmin < nuit minimale → « attendre, nuits trop fraîches » ; Tmin < nuit idéale
   → « possible sous conditions (voile) » ; chaleur > seuil de semis (laitue,
   mâche, épinard, radis, carotte) → « possible sous conditions ».
4. **Arrosage** : intervalle de base 2 jours (bac) / 4 jours (pleine terre),
   multiplié par : semis non levé ×0,5 ; reprise ×0,6 ; légume-fruit en
   production ×0,75 ; besoin faible ×1,4 ; chaleur (≥ 32 °C ×0,5, ≥ 28 ×0,7,
   ≥ 24 ×0,85 ; < 16 ×1,4 ; < 10 ×2). Pluie **tombée** ≥ 6 mm (bac) ou
   ≥ 10 mm (pleine terre) = équivalent d'un arrosage, uniquement pour un espace à
   ciel ouvert. La pluie **annoncée** modifie le texte du conseil mais n'est
   jamais enregistrée. « Terre encore humide » reporte d'une demi-période.
   Ail et oignon : plus d'arrosage dans les 21 jours avant la récolte.
5. **Estimations des étapes** : chaque étape a un délai [min, max] depuis la
   précédente ; la fenêtre affichée = centre ± écart combiné (racine de la somme
   des carrés), ce qui évite des fenêtres trop larges. Une observation réelle
   remet le compteur à zéro (recalage). Une variété connue applique un facteur
   de précocité à tous les délais. Certaines étapes sont « calendaires » (ail
   et oignon récoltés en été, fraisier en fleur au printemps, mise en terre des
   légumes-fruits pas avant mi-mai).
6. **Nombre de plants** : grille longueur/espacement × largeur/espacement entre
   rangs (meilleure orientation), moins la surface déjà occupée par les cultures
   en cours de l'espace.

## À valider en priorité

- Fenêtres de semis/plantation pour chaque zone climatique (le décalage uniforme
  par zone est une simplification ; ex. Sud-Ouest intérieur vs Bretagne).
- Délais de levée et de récolte par variété (facteurs de précocité estimés).
- Seuils d'arrosage (intervalles de base, effet de la pluie en bac sous
  feuillage, effet du paillage non pris en compte).
- Profondeurs minimales en bac et espacements « confort débutant ».
- Détection automatique de la zone (frontières tracées grossièrement).
- Ail d'automne en climat de montagne, fraisiers plantés au printemps
  (récolte faible la première année, non modélisé).

## Climat de la commune (ajout)

Quand la commune est localisée, l'app télécharge 10 ans de températures minimales
(archive Open-Meteo) pour la commune **et** pour Orléans, lieu de référence des
fiches. Elle calcule la date médiane des dernières gelées (≤ 0 °C, janvier-juin)
et des premières gelées (juillet-décembre), puis décale le calendrier de l'écart
entre les deux (borné à ± 45 jours). La même méthode étant appliquée des deux
côtés, l'écart reste cohérent même si la donnée (maillage de modèle, température
sous abri à 2 m) diffère d'une station météo. À valider : un jardin en cuvette
ou très abrité peut s'écarter de plusieurs semaines de la moyenne de la commune.

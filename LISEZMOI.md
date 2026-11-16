# Mon potager — V1

Application web en français, pensée pour le téléphone, qui répond à cinq questions :
quoi planter cette semaine, quand planter ce que j'ai choisi, quand vérifier
l'arrosage, quand verrai-je les premières pousses, et quand pourrai-je récolter.

## Lancer l'application

**Le plus simple :** double-cliquer sur `index.html`. L'app s'ouvre dans le
navigateur. Aucune installation n'est nécessaire.

**Sur le téléphone** (même Wi-Fi que l'ordinateur), avec Node.js installé :

```
npm start
```

puis ouvrir `http://<adresse-de-l-ordinateur>:8080` sur le téléphone.

Les données (profil, bacs, cultures, arrosages) sont enregistrées **dans le
navigateur de l'appareil** (pas de compte, pas de serveur). Changer de navigateur
ou d'appareil = repartir de zéro.

Une connexion Internet sert uniquement à la météo (Open-Meteo) et à la recherche
de commune (geo.api.gouv.fr), deux services gratuits sans inscription. Sans
connexion, le calendrier climatique fonctionne et l'app signale que le conseil du
jour n'a pas pu être affiné.

## Organisation

| Dossier | Contenu |
|---|---|
| `data/cultures.js` | Les 15 fiches cultures : modes de démarrage, fenêtres, froid, espacement, étapes, délais, arrosage, signes de maturité, variétés |
| `data/climats.js` | Zones climatiques et décalages |
| `data/etapes.js` | Textes génériques des étapes (ce qui est normal, contrôle si retard) |
| `data/REFERENCES.md` | Sources horticoles, règles de calcul et points à valider |
| `js/moteur.js` | Calculs : calendrier, météo, arrosage, étapes, récolte (sans interface) |
| `js/meteo.js` | Prévisions et recherche de commune |
| `js/store.js` | Enregistrement local |
| `js/app.js`, `css/style.css`, `index.html` | Interface |
| `tests/` | Tests du moteur et parcours de bout en bout |

Pour modifier une valeur horticole (une date, un délai, un espacement), il suffit
d'éditer `data/cultures.js` : l'interface n'a pas à être touchée.

## Tests

```
npm test        # moteur : 8 groupes de tests, sans navigateur
npm run e2e     # 8 parcours complets dans Chromium (nécessite Playwright)
```

Les parcours de bout en bout simulent la météo et l'heure pour être reproductibles.

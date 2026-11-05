# Ghazaouet Calamar Live 🎣 (الغزوات)

**🔴 En ligne : https://mohlinkinpark1-prog.github.io/ghazaouet-calamar-live/**

Application web professionnelle de **prévision de pêche au calamar (encornet, *Loligo vulgaris*)** en direct pour le **port de Ghazaouet** (Tlemcen, Algérie — 35.096° N · 1.860° W · UTC+1, ouverture NW sur la Méditerranée).

> « Le calamar, minute après minute. »

## Ce que fait l'app

- **Indice Calamar™ /100** recalculé toutes les 10 min : lune (35) + périodes solunaires (25) + saison (20) + mer & vent (12) + pression (8).
- **Jauge animée**, décomposition par facteur, note (Faible → Exceptionnel) et **fenêtre optimale** (meilleure période majeure/mineure de nuit).
- **Lune en direct** : phase réelle calculée localement (élongation, fraction éclairée, âge), lever/coucher/culmination, coefficient de marée estimé, rendu canvas + **calendrier lunaire mensuel** complet (phases dessinées jour par jour, top 5 du mois, syzygies).
- **Périodes solunaires** (théorie de John Alden Knight, 1926) : culmination haute/basse (majeures) et mi-course (mineures), avec mesure de recouvrement nocturne en minutes.
- **Météo & mer en direct** (Open-Meteo, gratuit, sans clé) : vent/rafales/direction, pression + tendance 3 h, nuages, précipitations, **vagues/houle/période**, **température de l'eau**, alerte orage automatique.
- **Courbe d'activité 24 h** (canvas) avec zones de nuit, lever/coucher du soleil, marqueur « maintenant ».
- **Prévisions 14 jours** : carte par jour (lune, indice, vagues, vent, fenêtre de nuit) + **fiche détaillée** par jour avec bouton « Copier la fiche texte ».
- **Guide expert** : calendrier saisonnier (barres sur 12 mois, migration côtière jan–fév, pontes été/automne), 4 techniques (turlutte, lamparo, dérive, bord), spots locaux (digue du phare « Les Deux Frères », pente 30–80 m, Honaïne), table de matériel, FAQ.
- **Méthode & sources** en toute transparence + avertissements sécurité/réglementation.

## Lancer l'application

Aucune installation, aucun build. Deux options :

```bash
# Option 1 — double-cliquer index.html (les données live exigent internet)
# Option 2 — serveur local (recommandé)
python -m http.server 8901
# puis ouvrir http://localhost:8901
```

## Structure

```
├── index.html                  # Structure + sprite d'icônes SVG interne
├── assets/
│   ├── css/style.css           # Design system « abyssal » (variables, responsive, print)
│   ├── js/astro.js             # Moteur astronomique : phases, lever/coucher, culminations, solunaire
│   └── js/app.js               # État, fetch Open-Meteo + cache localStorage, rendus canvas/DOM, navigation
│   └── icon.svg                # Logo (hameçon + croissant + vagues)
└── manifest.webmanifest        # PWA (installable, thème sombre)
```

## Sources des données

| Donnée | Source |
|---|---|
| Météo, vent, pression, nuages, pluie | [Open-Meteo Forecast API](https://open-meteo.com/) (ECMWF/ICON, CC BY 4.0) |
| Vagues, houle, température de surface | [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api) |
| Phases lunaires, levers/couchers | Calcul local (algorithmes type Meeus, *Astronomical Algorithms*), précision ≈ ± 5 min |
| Solunaire | J.A. Knight (1926) — majeures = lune au zénith/nadir, mineures = mi-course |
| Biologie de *Loligo vulgaris* | FAO / AdriaMed, SeaLifeBase |

## Limites (honnêteté avant tout)

- L'indice **hiérarchise les probabilités**, ne les garantit pas.
- Méditerranée : marée < 0,4 m — la lune agit via les courants/solunaire, pas la hauteur d'eau (coefficient affiché = estimation).
- Au-delà de 16 jours, la météo n'est plus prévisible : l'indice du calendrier devient « lune + saison » (marqué `*`).
- Sécurité : jamais de sortie en alerte orage ; bulletin ONM / Météo Algérie ; VHF canal 16 ; réglementation de la pêche récréative (tailles, repos biologique) auprès de la **Direction de la Pêche et de l'Aquaculture de Tlemcen**.

**Données © Open-Meteo (CC BY 4.0). Outil d'aide à la décision — la mer reste imprévisible.**

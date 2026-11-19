# Plan d'implémentation — Indice Calamar v3

- Date : 2026-11-19
- Spec approuvée : `docs/superpowers/specs/2026-11-19-indice-calamar-v3-design.md`
- Branche : `refonte-calamar-v3` (déjà créée)
- Note : skill `writing-plans` indisponible dans cet environnement ; plan rédigé manuellement
  selon le même principe (étapes courtes, each with check).

## Étape 0 — État initial

- [x] Branche `refonte-calamar-v3` créée depuis `b1f95c6`.
- [x] Spec commitée (`81425bb`).
- Checkpoint : `git status --short` = vide.

## Étape 1 — Tests du moteur d'abord (rouge)

Fichier : `tests/engine.test.mjs` (réécriture intégrale).

Cas à couvrir (≥ 20) :
1. `moonScore(0) = 40`, `moonScore(π/2) = 12`, `moonScore(π) = 40`, valeurs intermédiaires bornées.
2. `wavePoints` : null→7 ; 0.29→10 ; 0.3→8 ; 0.59→8 ; 0.6→6 ; 0.99→6 ; 1→3 ; 1.49→3 ; 1.5→0 ; 2→0.
3. `waterPoints` : null→6 ; 11→4 ; 12→10 ; 16→10 ; 17→8 ; 19→8 ; 20→6 ; 21→6 ; 22→2.
4. `seaPoints` : houle+eau ; vent 30 → pas de pénalité ; vent 31 → −4 ; bornes 0 et 25 ;
   données manquantes → 7+6 = 13.
5. `pressurePoints` : dp −0.8→10 ; dp +0.8→5 ; p null→6 ; 1012→9 ; 1015→6 ; 1020→5.
6. `solunarPoints` : major seul, minor seul, bonus prime 20h–02h, plafond 25.
7. `ratingOf` / `bandOf` / `scoreColor` : 39/40/57/58/69/70/84/85.
8. `totalScore` : arrondi, bornes 0–100, **aucun champ `season`** accepté ni requis.
9. Invariance mois : deux objets d'entrée identiques sauf la date → même total.

Checkpoint : `node --test tests/engine.test.mjs` échoue (moteur actuel incompatible).
Ne pas modifier le moteur avant ce point.

## Étape 2 — Réécriture du moteur (vert)

Fichier : `assets/js/engine.js`, produit à partir de zéro.

- Exports : `clamp, ratingOf, bandOf, scoreColor, wavePoints, waterPoints, seaPoints,
  pressurePoints, moonScore, solunarPoints, totalScore`.
- **Aucun export** `seasonScore` / `SEASON_20` ; aucune référence à la saison.
- Formules exactes de la spec §4.3 ; commentaires citant les études.
- Compatibilité navigateur + Node conservée (`window.GCLEngine` / `module.exports`).

Checkpoint : `node --test tests/engine.test.mjs` → 100 % vert. `node --check` OK.

## Étape 3 — Astronomie : tests de référence puis réécriture

Fichiers : `tests/astro.test.mjs` (nouveau), `assets/js/astro.js` (réécrit).

- Tests : phase de nouvelle lune / pleine lune à des dates connues, élongation 0→180°,
  illumination, minutes de nuit, génération des périodes solunaires.
- Réécriture de `astro.js` en préservant exactement les algorithmes (Meeus, solveur
  Newton–Raphson pour l'âge lunaire) ; l'API utilisée par `app.js` reste documentée.

Checkpoint : `node --test tests/engine.test.mjs tests/astro.test.mjs` → tout vert (`node --test tests/` n'est pas supporté par cette version de Node).

## Étape 4 — Structure HTML réécrite

Fichier : `index.html` réécrit intégralement.

- `<head>` : titre/description 100 % calamar, meta theme-color, fonts, `?v=20261119`.
- Corps : splash (1er élément), sprite SVG (icônes utilisées seulement), 5 sections
  (`dashboard`, `previsions`, `calendrier`, `guide`, `methode`), dock, bottom-sheet, pied.
- IDs requis par app.js : jauge (`gaugeCanvas`, `gaugeValue`, `gaugeKicker`, `ratingPill`),
  facteurs (`#factorList`), SST/sstVerdict, reco, météo/marine, carousel, calendrier, lune,
  guide (`#seasonBars`, `#hourSlots`, `#techGrid`, `#spotList`, `#gearRows`), FAQ (`#faqList`),
  méthode (`#methodList`), réglages (`#themePicker`, `#tpName`, unités, refresh), `#splash`.
- Aucun `data-sp`, `#spName`, `#speciesIcon`, "loup|dorade|sar|Indices scientifiques".

Checkpoint : script de mapping DOM (tous les sélecteurs de `app.js` présents) + grep d'absence.

## Étape 5 — CSS réécrit

Fichier : `assets/css/style.css` réécrit intégralement.

- Tokens (6 thèmes dont clair), typographie Bricolage/Instrument/JetBrains, layout story,
  jauge, cartes, dock, bottom-sheet, accordéons, splash (3 s), responsive 390/1440,
  `prefers-reduced-motion`, print.
- Skills mobilisés ici : `mobile-native`, `web-design-guidelines`, `ui-ux-pro-max`.

Checkpoint : ouverture locale CDP 390×844 — pas de débordement, splash visible puis retiré.

## Étape 6 — App réécrite

Fichier : `assets/js/app.js` réécrit intégralement.

- État local : météo/marine, unités, thème, cache 10 min, curseur calendrier, timer.
- Données : Open-Meteo Forecast + Marine (coordonnées 35.096/-1.860), cache localStorage,
  gestion hors-ligne et erreurs.
- Score : `GCLEngine.moonScore` + `solunarForDay` + `seaPoints` + `pressurePoints` →
  `totalScore` (4 facteurs, **jamais season**).
- Rendu : jauge animée, facteurs avec poids/sources, reco, fenêtre optimale, 14 jours,
  calendrier, lune, guide calamar, méthode, bandeau « saison connue, non notée ».
- Navigation scroll-spy, thèmes, unités, splash 3 s, raccourcis clavier/accessibilité.

Checkpoint : `node --check assets/js/app.js` + CDP : 0 erreur console, tous les blocs rendus.

## Étape 7 — Build mono-fichier et contrôles

- Adapter si besoin `tools/build-single.mjs` (inline CSS + engine + astro + app + icône).
- `node tools/build-single.mjs` → fichier ~200 Ko, icône en data URI, aucune référence externe.
- Contrôle UTF-8 des 5 fichiers livrés (`Conçu`, `™`, `é`, `الغزوات`, aucun U+FFFD).
- Grep final : absence de `seasonScore|SEASON_20|data-sp|GUIDES|SPECIES|loup|dorade|sar`.

Checkpoint : commandes ci-dessus vertes.

## Étape 8 — Vérification navigateur (CDP)

- Mobile 390×844 dpr2+touch : splash 3 s (présent à 3 s avec `is-done`, retiré après),
  jauge, 4 facteurs, thèmes (dont clair), accordéons, bottom-sheet, 0 erreur console,
  `scrollWidth ≤ clientWidth`.
- Desktop 1440×900 : dock flottant, cartes.
- Comparaison avec l'ancien index : capture avant/après dans `$TEMP/opencode/`.

Checkpoint : captures relues, aucune régression visuelle bloquante.

## Étape 9 — Livraison

- `git add` des fichiers modifiés, commit `Refonte Indice Calamar v3 — calcul 40/25/25/10 sans saison`.
- Push de `refonte-calamar-v3` **puis** fusion dans `main` (ou push direct main si demandé).
- `gh api repos/.../pages/builds/latest --jq '{status, commit}'` → `built`.
- Navigation production + hard reload (ignoreCache) + capture mobile, 0 erreur console.

Rollback : `git revert <commit>` ou repointage Pages sur `b1f95c6`.

## Règles de travail (issues du pré-mortem)

- Jamais de PowerShell `Set-Content`/`Get-Content` pour modifier un fichier : uniquement `write`/`edit`.
- Tests écrits avant le code (TDD) pour engine et astro.
- Aucun déploiement avant `node --test tests/` vert + contrôle CDP.
- Solunaire : mention visible « hypothèse non validée, conservée par choix ».
- Poids : mention visible « les effets sont mesurés, la répartition des poids est un choix ».

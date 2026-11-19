# Spécification — Refonte intégrale « Indice Calamar » v3

- Date : 2026-11-19
- Dépôt : `github.com/mohlinkinpark1-prog/ghazaouet-calamar-live` (Pages existante, URL inchangée)
- État : design approuvé par l'utilisateur le 2026-11-19 (périmètre, calcul, UI, tests, risques)

## 1. Contexte et objectifs

L'application actuelle (commit `b1f95c6`) gère 4 espèces avec un indice composite à 5 facteurs
(lune 35 · solunaire 25 · saison 20 · mer 12 · pression 8). L'utilisateur demande une
**réécriture intégrale** avec trois changements de fond :

1. **100 % calamar** : supprimer le loup bar, la dorade et le sar (sélecteur, barèmes, guides,
   cartes de bibliographie plurispécifiques). L'app ne parle plus que de *Loligo vulgaris*.
2. **Saison hors score** : la saison de pêche est connue (migration, pontes, recrutement) ;
   elle devient une information contextuelle, elle ne rapporte plus de points.
3. **Calcul fondé sur les études calamar** : redistribution des 20 points de saison vers des
   facteurs mesurés, avec l'honnêteté méthodologique explicite sur ce que les études prouvent
   et sur ce qui reste un choix de conception.

Objectif fonctionnel : un indice /100 lisible, déterministe, testé, sans dépendance à la saison,
dont chaque facteur est rattaché à une source vérifiée.

## 2. Décisions validées

| Sujet | Décision |
|---|---|
| Périmètre | Toute l'application réécrite de zéro ; dépôt et URL conservés |
| Espèces | Calamar uniquement ; suppression totale des 3 autres espèces |
| Solunaire | Conservé dans le score (25 pts), avec mention « hypothèse non validée (Knight 1926) » |
| Échelle | /100 conservée ; les 20 pts de saison sont redistribués |
| Poids | Lune 40 · Solunaire 25 · Mer 25 · Pression 10 |
| Forme du score | Addition de points, pas de modèle logistique (coefficients non publiés) |
| Saison | Affichée comme information, jamais convertie en points |
| Skills | Pertinents uniquement : brainstorming, scientific-method, first-principles, pre-mortem, tdd, mobile-native, web-design-guidelines, ui-ux-pro-max, writing-plans |
| Rollback | Commit `b1f95c6` conservé ; branche dédiée ; déploiement après tests verts |

## 3. Architecture

Approche retenue : **trois fichiers réécrits de zéro**, même contrat de chargement que l'actuel,
aucun bundler (le build mono-fichier existant reste l'outil de distribution).

```
index.html                      structure story verticale (5 vues), splash, sprite SVG
assets/css/style.css            tokens, thèmes (6), layout, composants, splash, responsive
assets/js/engine.js             module PUR : scoring uniquement, window.GCLEngine + module.exports
assets/js/astro.js              module PUR : élongation, phases, levers/couchers, solunaire
assets/js/app.js                UI : données Open-Meteo, rendu, navigation, thèmes, persistance
tests/engine.test.mjs           tests node:test du moteur et des paliers
tests/astro.test.mjs            tests de valeurs astronomiques de référence
tools/build-single.mjs          génère ghazaouet-calamar-live.html (CSS/JS/icône inline)
docs/superpowers/specs/...      cette spécification
```

Règles de frontière :
- `engine.js` ne touche jamais `document`, `localStorage`, `fetch` ni l'heure courante.
- `astro.js` reçoit une date et des coordonnées ; aucune lecture réseau.
- `app.js` est le seul à orchestrer données météo/marine et rendu DOM.
- Tous les identifiants DOM utilisés par `app.js` existent dans `index.html` (contrôle par
  script de mapping avant livraison).

## 4. Spécification du calcul

### 4.1 Poids et total

| Facteur | Poids | Source |
|---|---:|---|
| Lune | 40 | Cabanellas-Reboredo 2012 (Baléares), Ulas & Aydin 2011 (Égée), Palawe 2021 (Indonésie) |
| Solunaire | 25 | Knight 1926 — **hypothèse folklorique conservée par choix, non validée** |
| Mer | 25 | Cabanellas-Reboredo 2012 (houle, eau, vent) |
| Pression | 10 | Cabanellas-Reboredo 2012 (basse pression / baisse nette) |
| Saison | 0 | Retirée : période connue, informative seulement |

`total = clamp(round(moon + sol + meteo + pres), 0, 100)`. Aucun terme de saison.

### 4.2 Paliers (identiques à l'actuel)

`< 40 Faible` · `< 58 Correct` · `< 70 Bon` · `< 85 Excellent` · `≥ 85 Exceptionnel`.
Couleurs et `level` associés inchangés (`low/mid/good/great/epic`).

### 4.3 Formules exactes

**Lune (40)** — syzygie = plein score :
```
moonScore(elongRad) = 40 * (0.30 + 0.70 * |cos(elongRad)|^1.8)
```
Nouvelle et pleine lune traitées à égalité (choix déjà documenté : la lamparo favorise la
nouvelle lune, la turlutte la pleine lune — application des deux études).

**Solunaire (25)** — inchangé dans son principe :
```
pour chaque période : major → min(8, nightMin / 15) ; minor → min(2, nightMin / 30)
bonus +5 si une majeure (nightMin > 15) a son centre dans ]20h, 02h[
sol = min(25, somme)
```

**Mer (25)** — houle 10 + eau 10, pénalité vent :
```
wavePoints(w) = null → 7 ; w<0.3 → 10 ; w<0.6 → 8 ; w<1.0 → 6 ; w<1.5 → 3 ; sinon 0
waterPoints(t) = null → 6 ; t<12 → 4 ; t<=16 → 10 ; t<=19 → 8 ; t<=21 → 6 ; sinon 2
seaPoints(w, t, windMax) = clamp(wavePoints(w) + waterPoints(t) - (windMax > 30 ? 4 : 0), 0, 25)
```
Seuil vent > 30 km/h (valeur du moteur actuel, cohérente avec l'étude).

**Pression (10)** — transposition du barème actuel (× 1,25) :
```
dp < -0.7   → 10   (baisse nette, favorable)
dp > +0.7   → 5    (hausse nette)
p == null   → 6
p <= 1012   → 9    (basse stable)
p <= 1018   → 6
sinon       → 5    (haute)
```
`dp` = tendance sur 3 h calculée par `app.js` à partir des données Open-Meteo.

### 4.4Comportement attendu

- Le 6 novembre 2026 avec les mêmes données météo/marine que la version actuelle (moon ≈ 27/35,
  sol ≈ 14/25, mer ≈ 7/12, pres 8/8) donne environ **69–70/100** (« Bon ») au lieu de 76 :
  la disparition du 20/20 saison est le changement attendu, pas un bug.
- Deux dates de mois différents avec les mêmes entrées astronomiques/météo produisent le même
  score : le moteur n'a aucune dépendance au mois.
- Houle croissante → score mer décroissant ; eau fraîche (≤16 °C) → score mer maximal ; vent
  > 30 km/h → −4 ; pression en baisse nette → score pression maximal.

## 5. UI et contenu

- **Splash** : logo animé, nom, barre de progression, 3 s puis fondu (conservé, réécrit).
- **Vue Aujourd'hui** : jauge /100, fenêtre optimale, 4 facteurs avec poids et source,
  bandeau « Saison : période connue, non notée », verdict SST et recommandations calamar.
- **Vue 14 jours** : cartes de prévisions utilisant le nouveau score.
- **Vue Lune** : phase réelle, élongation, levers/couchers/culmination, périodes solunaires
  (informatiques, avec la note d'honnêteté).
- **Vue Guide** : fiche *Loligo vulgaris*, calendrier mensuel **informatif**, rythmes d'une nuit,
  4 techniques (turlutte, lamparo, dérive, bord), spots (jetée, large, Honaïne, Marsa Ben
  M'Hidi), matériel, FAQ — réécrits sans référence aux autres espèces.
- **Vue Méthode** : 4 facteurs détaillés, formules, sources, mention explicite
  « les études mesurent le sens et la significativité des effets ; la répartition des poids
  est un choix de conception documenté ».
- **Réglages** : 6 thèmes, unités vent/temp, rafraîchissement ; plus de sélecteur d'espèce.
- **Supprimés** : `SPECIES`, `GUIDES`, `.sp-picker`, `#spName`, `#speciesIcon`, cartes
  « Indices scientifiques », toute référence à loup/dorade/sar dans l'UI et les sources.
- **Conservés** : mobile-first story, dock scroll-spy, bottom-sheet, anti-cache `?v=`,
  Open-Meteo Forecast + Marine, build mono-fichier, manifests/icônes PWA.

## 6. Sources scientifiques (uniquement calamar)

1. Cabanellas-Reboredo M, Alós J, Palmer M, Morales-Nin B (2012), *Environmental effects on
   recreational squid jigging fishery catches*, ICES J. Mar. Sci. 69(10):1823–1830,
   DOI 10.1093/icesjms/fss159 — eau fraîche, vent faible, houle faible, basse pression,
   syzygie, créneau du coucher du soleil.
2. Ulas A, Aydin I (2011), *The effects of jig color and lunar bright on coastal squid jigging*,
   African Journal of Biotechnology 10(9):1721–1726, DOI 10.4314/ajb.v10i9 — turluttes rouges
   (p<0.01), pleine lune positive (p<0.01).
3. Palawe HJ et al. (2021), *The Effect of Lunar Phase on Squid Catches Using Flashing LED Lights*,
   Jurnal IPTEKS PSP 8(2):58–69, DOI 10.20956/jipsp.v8i2.18495 — LED bleue > blanche,
   3e quartier (p<0.05).
4. Rocha F, Guerra A (1996), *J. Exp. Mar. Biol. Ecol.* 207:177–189 ; FAO/AdriaMed/SeaLifeBase —
   biologie de *Loligo vulgaris* (pontes, recrutement) : **contexte informatif uniquement**,
   aucune pondération.

Note d'honnêteté obligatoire dans l'UI : le solunaire (Knight 1926) n'est pas validé
scientifiquement ; sa conservation dans le score est un choix explicite de l'utilisateur.

## 7. Tests et validation

### 7.1 TDD (rouge → vert)

Écrire d'abord les tests, puis le code :

- `tests/engine.test.mjs` (≥ 20 cas) : bornes 0–100 ; `moonScore(0)=40`,
  `moonScore(π/2)=12` ; monotonie houle/eau ; pénalité vent à 31 km/h et pas à 30 ;
  6 cas de pression ; `totalScore` sans paramètre `season` ; paliers 40/58/70/85 ;
  invariance mois (deux appels avec même `moon`/`sol`/`meteo`/`pres` mais mois différents).
- `tests/astro.test.mjs` : phases de référence, élongation, minutes de nuit, périodes
  solunaires — empêche toute régression astronomique lors de la réécriture de `astro.js`.

### 7.2 Navigateure (CDP)

- Mobile 390×844 dpr2 + touch : splash 3 s, jauge, 4 facteurs, thèmes, accordéons, zéro
  débordement horizontal, zéro erreur console.
- Desktop 1440 : dock flottant, mise en page.
- Contrôle DOM : tous les sélecteurs utilisés par `app.js` existent ; aucune occurrence de
  `SPECIES`/`GUIDES`/`data-sp` dans le code livré.

### 7.3 Livraison

`node tools/build-single.mjs` (icône inline, ~200 Ko), vérification UTF-8 (aucun mojibake),
commit sur branche dédiée, push, `gh api .../pages/builds/latest` = `built`, contrôle de la
production. Rollback : `git revert` du commit de livraison ou repointage Pages sur `b1f95c6`.

## 8. Pré-mortem — risques et parades

| Risque | Parade |
|---|---|
| Casser la production | branche dédiée, commit `b1f95c6` conservé, déploiement après tests verts |
| Perte de précision astronomique | tests de valeurs de référence avant remplacement de `astro.js` |
| Surestimation du « 100 % études » | chaque formule sourcée ; solunaire étiqueté « hypothèse conservée » |
| Recherche de l'indice de saison par l'utilisateur | bandeau explicite « saison connue, non notée » |
| Corruption UTF-8 (incident antérieur) | uniquement outils `write`/`edit`, jamais `Set-Content` PowerShell |
| Régression mobile (thème clair, dock, bottom-sheet) | capture CDP avant/après sur 390×844 et 1440 |
| Oubli d'une référence aux autres espèces | grep final `loup|dorade|sar` sur les fichiers livrés |

## 9. Critères d'acceptation

1. Aucun sélecteur d'espèce ni contenu loup/dorade/sar dans l'app livrée.
2. Le moteur n'a aucun paramètre ni champ `season` ; la saison n'apparaît que comme texte.
3. Les poids 40/25/25/10 sont affichés dans l'Aujourd'hui et détaillés dans Méthode.
4. `node --test tests/` : 100 % des tests passent (≥ 30 cas au total).
5. Splash 3 s animé, 6 thèmes, Open-Meteo, mono-fichier et Pages opérationnels.
6. Production vérifiée sur mobile et desktop, zéro erreur console.
7. L'honnêteté sur le solunaire et sur l'origine des poids est visible dans l'interface.

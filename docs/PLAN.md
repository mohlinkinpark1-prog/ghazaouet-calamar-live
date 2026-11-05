# Plan de refonte — Ghazaouet Calamar Live « v2 »

> Applique les skills : frontend-design, ui-ux-pro-max (ui-styling), canvas-design, test-driven development.
> Date : 5 nov. 2026. Objectif : refondre l'app avec une identité visuelle propre au sujet,
> un moteur de calcul testé, et un artefact d'identité dédié.

## Chantier 1 — TDD : moteur pur + tests

**Interface publique** (`assets/js/engine.js`, module universel Node ↔ navigateur) :

| Fonction | Comportement testé |
|---|---|
| `clamp(v,a,b)` | bornes incluses, valeur dans l'intervalle |
| `ratingOf(score)` | 5 paliers : Faible <40, Correct <58, Bon <75, Excellent <90, Exceptionnel ≥90 |
| `bandOf(score)` | bandes calendrier low/mid/good/great/epic (90+) |
| `scoreColor(score)` | couleur cohérente avec la bande |
| `wavePoints(h)` | 7 (<0,3) · 6 (<0,6) · 4 (<1) · 2 (<1,5) · 0 (≥1,5) |
| `waterPoints(t)` | 5 (≤16°) · 4 (≤19°) · 3 (≤21°) · 1 (>21°) ; <12° → 2 (trop froid) |
| `seaPoints(wave,sst,windMax)` | somme bornée 0–12, pénalité vent >30 km/h |
| `pressurePoints(p,dp)` | dp<−0,7 → 8 (favorable) ; dp>0,7 → 4 ; sinon paliers sur p |
| `solunarPoints(periods,isPrime)` | majeure ≤8/15 min de nuit · mineure ≤2/30 min · prime +5 · max 25 |
| `seasonScore(mois)` | tableau saisonnier, sommet 20 exactement (fix 21/20) |
| `totalScore(pieces)` | arrondi somme, borné 0–100 |

Boucle : un test pinoche le comportement existant (verifiable factuellement) → extraction minimale → vert → suivant. Baseline factuelle avant refactor : indice du jour 69–73 selon données fraîches, saison 20/20. Vérifs attendues : `node --test tests/` vert, app inchangée en production.

## Chantier 2 — frontend-design / ui-styling : identité « Lueur de Veille »

- **Sujet** : la pêche nocturne au calamar sous les lampes sodium du port de Ghazaouet, en Mediterranée occidentale.
- **Palette (tokens azur réorientés)** : Encre #060E13 · Fumée #0B1922 · Lanterne #FFB629 (sodium) · Phosphore #3FE0C5 · Chair #F4EBDB (textes forts) · Fosse #FF5E5B (alertes).
- **Typo** : display **Bricolage Grotesque** (600/750/800, optical sizing), corps **Instrument Sans**, données **JetBrains Mono** (conservée).
- **Signature** : la « fenêtre de tir » — bande horizontale de la nuit où le faisceau de la lampe s'allume sur la fenêtre optimale, ombre portée façon pont la nuit. `prefers-reduced-motion` respecté.
- **Corrections système** : variables circulaires `--btn-fg` / `--subtle2` / `--track` en `:root` réparées ; spécificités CSS nettoyées ; focus visible et contrastes AA maintenus.

## Chantier 3 — canvas-design

- `docs/DESIGN-PHILOSOPHY.md` : mouvement « **Lueur de Veille** » (4–6 §, texte minimal, expression visuelle).
- Artefact : `assets/icon-512.png` (et refuge vectoriel `assets/icon.svg` retaillé) dessiné canvas — encre circulaire, faisceau, phosphore — vérifié pixel à pixel via capture CDP.

## Chantier 4 — livraison

Build mono-fichier → vérification CDP (390×844 + desktop) → Lighthouse mobile AA → commit → push → `gh api pages/builds/latest` → capture production.

## Hors périmètre (déjà acquis, non retouché)

astro.js (solveur Newton–Raphson), modes de collecte Open-Meteo, 6 thèmes, tabbar basse.

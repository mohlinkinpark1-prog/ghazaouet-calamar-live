/* ============================================================
   INDICE CALAMAR v3 — Moteur de notation pur (sans DOM, sans date)
   Chargeable par <script> (window.GCLEngine) et par Node (module.exports).
   Aucun facteur de saison : période connue, informative, non notée.
   Sources : Cabanellas-Reboredo 2012 (ICES JMS, Baléares) ·
             Ulas & Aydin 2011 (Afr. J. Biotechnol., Égée) ·
             Palawe et al. 2021 (Jurnal IPTEKS PSP, Indonésie).
   ============================================================ */
'use strict';

(function (global) {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* Lune — 40 pts : syzygie (nouvelle OU pleine) = plein score.
     |cos(élongation)|^1.8 : plateau large autour de 0 et π. */
  const moonScore = elongRad => 40 * (0.30 + 0.70 * Math.pow(Math.abs(Math.cos(elongRad)), 1.8));

  /* Mer — 25 pts : houle ≤ 10 + eau ≤ 10 ; vent > 30 km/h → −4 (Baléares 2012).
     Les données manquantes prennent une valeur neutre, jamais un bonus. */
  const wavePoints = w => w == null ? 7
    : w < 0.3 ? 10 : w < 0.6 ? 8 : w < 1.0 ? 6 : w < 1.5 ? 3 : 0;

  const waterPoints = t => t == null ? 6
    : t < 12 ? 4 : t <= 16 ? 10 : t <= 19 ? 8 : t <= 21 ? 6 : 2;

  const seaPoints = (wave, sst, windMax) =>
    clamp(wavePoints(wave) + waterPoints(sst) - (windMax != null && windMax > 30 ? 4 : 0), 0, 25);

  /* Pression — 10 pts : baisse nette (< −0,7 hPa/3 h) = 10 ; hausse nette = 5 ;
     basse stable ≤1012 = 9 ; neutre ≤1018 = 6 ; haute = 5. */
  const pressurePoints = (p, dp) => {
    if (dp < -0.7) return 10;
    if (dp > 0.7) return 5;
    if (p == null) return 6;
    if (p <= 1012) return 9;
    if (p <= 1018) return 6;
    return 5;
  };

  /* Solunaire — 25 pts max. Hypothèse de Knight (1926), non validée scientifiquement :
     conservée dans le score par choix explicite, signalée comme telle dans l'UI.
     Majeure = min(8, minutes de nuit / 15) ; mineure = min(2, /30) ;
     bonus +5 si une majeure (nuit > 15 min) culmine entre 20h et 02h. */
  const solunarPoints = (periods, isPrime) => {
    let sol = 0;
    for (const p of periods) {
      sol += p.type === 'major' ? Math.min(8, p.nightMin / 15) : Math.min(2, p.nightMin / 30);
    }
    if (periods.some(p => p.type === 'major' && p.nightMin > 15 && isPrime(p.center))) sol += 5;
    return Math.min(25, sol);
  };

  /* Paliers de lecture — seuils inchangés : 40 / 58 / 70 / 85. */
  const ratingOf = s => s < 40 ? { label: 'Faible', level: 'low' }
    : s < 58 ? { label: 'Correct', level: 'mid' }
      : s < 70 ? { label: 'Bon', level: 'good' }
        : s < 85 ? { label: 'Excellent', level: 'great' }
          : { label: 'Exceptionnel', level: 'epic' };

  const bandOf = s => s < 40 ? 'low' : s < 58 ? 'mid'
    : s < 70 ? 'good' : s < 85 ? 'great' : 'epic';

  const scoreColor = s => s < 40 ? 'var(--band-low)' : s < 58 ? 'var(--band-mid)'
    : s < 70 ? 'var(--band-good)' : s < 85 ? 'var(--band-great)' : 'var(--band-epic)';

  /* Total — somme arrondie et bornée des 4 facteurs. Aucun terme de saison. */
  const totalScore = pieces => clamp(Math.round(
    (pieces?.moon ?? 0) + (pieces?.sol ?? 0) + (pieces?.meteo ?? 0) + (pieces?.pres ?? 0)
  ), 0, 100);

  const GCLEngine = {
    clamp, ratingOf, bandOf, scoreColor, moonScore,
    wavePoints, waterPoints, seaPoints, pressurePoints, solunarPoints, totalScore,
  };

  if (global) global.GCLEngine = GCLEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = GCLEngine;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : null));

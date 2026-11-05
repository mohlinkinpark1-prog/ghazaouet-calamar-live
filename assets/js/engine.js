/* ============================================================
   GHAZAOUET CALAMAR LIVE — Moteur de notation (pur, sans DOM)
   Module universel : chargeable par <script> (window.GCLEngine)
   et par Node (module.exports). Les entrées/sorties ne contiennent
   que des valeurs — aucun accès à document, localStorage ou réseau.
   ============================================================ */
'use strict';

(function (global) {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* Paliers de l'Indice Calamar™ : 40 / 58 / 70 / 85 */
  const ratingOf = s => s < 40 ? { label: 'Faible', level: 'low' }
    : s < 58 ? { label: 'Correct', level: 'mid' }
    : s < 70 ? { label: 'Bon', level: 'good' }
    : s < 85 ? { label: 'Excellent', level: 'great' }
    : { label: 'Exceptionnel', level: 'epic' };

  const bandOf = s => s < 40 ? 'low' : s < 58 ? 'mid' : s < 70 ? 'good' : s < 85 ? 'great' : 'epic';

  /* Couleurs par palier → variables CSS du thème actif */
  const scoreColor = s => s < 40 ? 'var(--band-low)' : s < 58 ? 'var(--band-mid)'
    : s < 70 ? 'var(--band-good)' : s < 85 ? 'var(--band-great)' : 'var(--band-epic)';

  /* ── Mer — 12 pts : houle ≤ 7 · eau ≤ 5 · vent > 30 km/h −2 (Baléares 2012) ── */
  const wavePoints = w => w == null ? 4
    : w < 0.3 ? 7 : w < 0.6 ? 6 : w < 1.0 ? 4 : w < 1.5 ? 2 : 0;

  const waterPoints = t => t == null ? 3
    : t < 12 ? 2 /* trop froid : activité ralentie */
    : t <= 16 ? 5 : t <= 19 ? 4 : t <= 21 ? 3 : 1;

  const seaPoints = (wave, sst, windMax) => {
    let sea = wavePoints(wave) + waterPoints(sst);
    if (windMax != null && windMax > 30) sea -= 2;
    return clamp(sea, 0, 12);
  };

  /* ── Pression — 8 pts : basse pression (ou en baisse) = touches meilleures ── */
  const pressurePoints = (p, dp) => {
    if (dp < -0.7) return 8;
    if (dp > 0.7) return 4;
    if (p == null) return 5;
    if (p <= 1012) return 7;
    if (p <= 1018) return 5;
    return 4;
  };

  /* ── Lune — 35 pts : syzygie (nouvelle ou pleine) = plein score ── */
  const moonScore = elongRad => 35 * (0.30 + 0.70 * Math.pow(Math.abs(Math.cos(elongRad)), 1.8));

  /* ── Solunaire — 25 pts : recouvrement nocturne + fenêtre prime 20h→02h ── */
  const solunarPoints = (periods, isPrime) => {
    let sol = 0;
    for (const p of periods) {
      if (p.type === 'major') sol += Math.min(8, p.nightMin / 15);
      else sol += Math.min(2, p.nightMin / 30);
    }
    if (periods.some(p => p.type === 'major' && p.nightMin > 15 && isPrime(p.center))) sol += 5;
    return Math.min(25, sol);
  };

  /* ── Saison — 20 pts max (Méditerranée ouest : migration, pontes, recrutement) ── */
  const SEASON_20 = [17, 18.5, 16, 12.5, 9.5, 8, 11, 13, 18, 20, 20, 18.5]; // jan→déc
  const seasonScore = m => SEASON_20[((m % 12) + 12) % 12];

  /* ── Total — somme arrondie bornée 0–100 ── */
  const totalScore = pieces => clamp(Math.round(
    (pieces.moon ?? 0) + (pieces.sol ?? 0) + (pieces.season ?? 0) +
    (pieces.meteo ?? 0) + (pieces.pres ?? 0)), 0, 100);

  const GCLEngine = {
    clamp, ratingOf, bandOf, scoreColor,
    wavePoints, waterPoints, seaPoints, pressurePoints,
    moonScore, solunarPoints, seasonScore, SEASON_20, totalScore
  };

  if (global) global.GCLEngine = GCLEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = GCLEngine;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : null));

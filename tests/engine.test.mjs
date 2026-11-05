/* Tests du moteur de notation — GCLEngine
   Chaque test décrit un COMPORTEMENT attendu par les pêcheurs. */
'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';

let Engine = null;
try { Engine = await import('../assets/js/engine.js'); Engine = Engine.default ?? Engine; } catch { /* RED */ }

/* ── Slice A : notation d'un indice ── */

test('le moteur est importable sous Node et dans le navigateur', () => {
  assert.ok(Engine, 'assets/js/engine.js doit être chargeable');
});

test('clamp() ramène toute valeur dans l’intervalle demandé', () => {
  assert.equal(Engine.clamp(120, 0, 100), 100);
  assert.equal(Engine.clamp(-5, 0, 100), 0);
  assert.equal(Engine.clamp(72, 0, 100), 72);
});

test('39/100 reste « Faible » et la couleur la annonce', () => {
  assert.deepEqual(Engine.ratingOf(39), { label: 'Faible', level: 'low' });
  assert.equal(Engine.bandOf(39), 'low');
});

test('40/100 passe « Correct » — le seuil de reprise est net', () => {
  assert.equal(Engine.ratingOf(40).label, 'Correct');
  assert.equal(Engine.ratingOf(40).level, 'mid');
});

test('58/100 passe « Bon »', () => {
  assert.equal(Engine.ratingOf(58).label, 'Bon');
});

test('70/100 passe « Excellent »', () => {
  assert.equal(Engine.ratingOf(70).label, 'Excellent');
});

test('85/100 passe « Exceptionnel » — la nuit rare', () => {
  assert.equal(Engine.ratingOf(85).label, 'Exceptionnel');
  assert.equal(Engine.bandOf(92), 'epic');
});

/* ── Slice B : mer (vagues + eau + vent) et pression ── */

test('houle calme < 0,3 m vaut 7 pts, ≥ 1,5 m vaut 0 — sortie inutile', () => {
  assert.equal(Engine.wavePoints(0.15), 7);
  assert.equal(Engine.wavePoints(0.29), 7);
  assert.equal(Engine.wavePoints(0.5), 6);
  assert.equal(Engine.wavePoints(0.9), 4);
  assert.equal(Engine.wavePoints(1.4), 2);
  assert.equal(Engine.wavePoints(2.2), 0);
});

test('sans donnée de houle, on reste prudent : 4 pts', () => {
  assert.equal(Engine.wavePoints(null), 4);
});

test('eau fraîche payante : 5 pts à 16 °C, 1 pt au-delà de 21 °C', () => {
  assert.equal(Engine.waterPoints(15), 5);
  assert.equal(Engine.waterPoints(17.5), 4);
  assert.equal(Engine.waterPoints(20.5), 3);
  assert.equal(Engine.waterPoints(24), 1);
});

test('eau trop froide (<12 °C) ralentit l’activité : 2 pts', () => {
  assert.equal(Engine.waterPoints(10.5), 2);
  assert.equal(Engine.waterPoints(null), 3);
});

test('mer totale bornée 0–12 et vent > 30 km/h retire 2 pts', () => {
  assert.equal(Engine.seaPoints(0.2, 15, 12), 12);   // cap atteint 7+5=12
  assert.equal(Engine.seaPoints(2.0, 24, 12), 1);    // 0+1, pas de vent
  assert.equal(Engine.seaPoints(0.5, 17, 35), 8);    // 6+4-2
  assert.equal(Engine.seaPoints(2.5, 1, 40), 0);     // 0+2-2 → clamp 0
});

test('pression en baisse nette = favorable (8 pts) — étude Baléares 2012', () => {
  assert.equal(Engine.pressurePoints(1013, -1.0), 8);
  assert.equal(Engine.pressurePoints(1013, 1.0), 4);   // en hausse nette
  assert.equal(Engine.pressurePoints(1010, 0.2), 7);   // basse stable
  assert.equal(Engine.pressurePoints(1015, 0), 5);     // neutre
  assert.equal(Engine.pressurePoints(1022, 0), 4);     // haute stable
  assert.equal(Engine.pressurePoints(null, 0), 5);     // sans donnée
});

/* ── Slice C : lune, périodes solunaires, saison, total ── */

test('lune pleine ou nouvelle = 35 pts ; quartier = 10,5 pts', () => {
  assert.equal(Engine.moonScore(0), 35);                       // conjonction
  assert.equal(Engine.moonScore(Math.PI), 35);                 // opposition
  assert.ok(Math.abs(Engine.moonScore(Math.PI / 2) - 10.5) < 1e-9); // quadrant
  assert.ok(Engine.moonScore(Math.PI / 4) > 10.5);             // gibbeuse >
});

test('période majeure avec 110 min de nuit ≈ 7,33 pts — cap 8 à 2 h de nuit', () => {
  const t = new Date('2026-11-05T22:00:00');
  assert.equal(Engine.solunarPoints([{ type: 'major', nightMin: 110, center: t }], () => false), Math.min(8, 110 / 15));
  assert.equal(Engine.solunarPoints([{ type: 'major', nightMin: 150, center: t }], () => false), 8);
  assert.equal(Engine.solunarPoints([{ type: 'minor', nightMin: 60, center: t }], () => false), 2);
  assert.equal(Engine.solunarPoints([{ type: 'minor', nightMin: 15, center: t }], () => false), 0.5);
});

test('majeure de nuit > 15 min dans la fenêtre prime 20h–2h : +5 pts, plafond 25', () => {
  const t = new Date('2026-11-05T22:00:00');
  const periods = [
    { type: 'major', nightMin: 120, center: t },
    { type: 'major', nightMin: 120, center: t }
  ];
  assert.equal(Engine.solunarPoints(periods, () => true), 21);    // 8 + 8 + 5
  assert.equal(Engine.solunarPoints(periods, () => false), 16);   // sans la prime
  const many = periods.concat([{ type: 'major', nightMin: 150, center: t }]);
  assert.equal(Engine.solunarPoints(many, () => true), 25);       // plafond
});

test('saison : janvier 17, juillet 11, sommet octobre–novembre 20 exactement', () => {
  assert.equal(Engine.seasonScore(0), 17);
  assert.equal(Engine.seasonScore(6), 11);
  assert.equal(Engine.seasonScore(9), 20);
  assert.equal(Engine.seasonScore(10), 20);
  for (let m = 0; m < 12; m++) assert.ok(Engine.seasonScore(m) <= 20, 'jamais au-delà du maximum');
});

test('total : somme arrondie, bornée 0–100', () => {
  assert.equal(Engine.totalScore({ moon: 25, sol: 14, season: 20, meteo: 5, pres: 8 }), 72);
  assert.equal(Engine.totalScore({ moon: 35, sol: 25, season: 20, meteo: 12, pres: 8 }), 100);
  assert.equal(Engine.totalScore({ moon: 0, sol: 0, season: 0, meteo: 0, pres: 0 }), 0);
  assert.equal(Engine.totalScore({ moon: 50, sol: 40, season: 20, meteo: 12, pres: 8 }), 100); // clamp
});

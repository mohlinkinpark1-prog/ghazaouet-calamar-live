/* Tests du moteur Indice Calamar v3 — écrits avant l'implémentation (TDD). */
import test from 'node:test';
import assert from 'node:assert/strict';
import GCLEngine from '../assets/js/engine.js';

test('lune : syzygie = 40 pts, quadrature = 12 pts, nouvelle = pleine', () => {
  const { moonScore } = GCLEngine;
  assert.equal(typeof moonScore, 'function');
  assert.equal(moonScore(0), 40);
  assert.equal(moonScore(Math.PI), 40);
  assert.equal(moonScore(Math.PI / 2), 12);
  for (let a = 0; a <= Math.PI; a += 0.05) {
    const v = moonScore(a);
    assert.ok(v >= 12 && v <= 40, `hors bornes pour ${a}: ${v}`);
  }
});

test('mer : paliers de houle (10 pts, Baléares 2012)', () => {
  const { wavePoints } = GCLEngine;
  assert.equal(typeof wavePoints, 'function');
  assert.equal(wavePoints(null), 7, 'donnée manquante = valeur neutre');
  assert.equal(wavePoints(0.29), 10);
  assert.equal(wavePoints(0.3), 8);
  assert.equal(wavePoints(0.59), 8);
  assert.equal(wavePoints(0.6), 6);
  assert.equal(wavePoints(0.99), 6);
  assert.equal(wavePoints(1), 3);
  assert.equal(wavePoints(1.49), 3);
  assert.equal(wavePoints(1.5), 0);
  assert.equal(wavePoints(2), 0);
});

test('mer : paliers de température (10 pts, eau fraîche favorable)', () => {
  const { waterPoints } = GCLEngine;
  assert.equal(typeof waterPoints, 'function');
  assert.equal(waterPoints(null), 6, 'donnée manquante = valeur neutre');
  assert.equal(waterPoints(11), 4);
  assert.equal(waterPoints(12), 10);
  assert.equal(waterPoints(16), 10);
  assert.equal(waterPoints(17), 8);
  assert.equal(waterPoints(19), 8);
  assert.equal(waterPoints(20), 6);
  assert.equal(waterPoints(21), 6);
  assert.equal(waterPoints(22), 2);
});

test('mer : vent > 30 km/h retire 4 pts, hiérarchie et bornes', () => {
  const { seaPoints } = GCLEngine;
  assert.equal(typeof seaPoints, 'function');
  assert.equal(seaPoints(0.1, 15, 10), 20, '10 houle + 10 eau');
  assert.equal(seaPoints(0.1, 15, 30), 20, 'vent 30 = pas de pénalité');
  assert.equal(seaPoints(0.1, 15, 31), 16, 'vent 31 = -4');
  assert.equal(seaPoints(null, null, null), 13);
  assert.ok(seaPoints(-1, -1, 99) >= 0);
  assert.ok(seaPoints(0, 15, 0) <= 25);
});

test('pression : baisse nette 10, hausse 5, basse stable 9 (Baléares 2012)', () => {
  const { pressurePoints } = GCLEngine;
  assert.equal(typeof pressurePoints, 'function');
  assert.equal(pressurePoints(1015, -0.8), 10, 'baisse nette');
  assert.equal(pressurePoints(1015, 0.8), 5, 'hausse nette');
  assert.equal(pressurePoints(null, 0), 6, 'donnée manquante = neutre');
  assert.equal(pressurePoints(1012, 0), 9, 'basse stable');
  assert.equal(pressurePoints(1015, 0), 6, 'neutre');
  assert.equal(pressurePoints(1020, 0), 5, 'haute');
  assert.equal(pressurePoints(1015, -0.8), 10, 'la tendance prime sur le niveau');
});

test('solunaire : 25 pts max, majeure 8, mineure 2, bonus fenêtre 20h–02h', () => {
  const { solunarPoints } = GCLEngine;
  assert.equal(typeof solunarPoints, 'function');
  const d = new Date('2026-11-06T22:00:00+01:00');
  const prime = c => c.getHours() >= 20 || c.getHours() < 2;
  const never = () => false;
  assert.equal(solunarPoints([], prime), 0);
  assert.equal(solunarPoints([{ type: 'major', nightMin: 120, center: d }], never), 8);
  assert.equal(solunarPoints([{ type: 'minor', nightMin: 120, center: d }], never), 2);
  assert.equal(solunarPoints([{ type: 'major', nightMin: 30, center: d }], never), 2);
  assert.equal(solunarPoints([{ type: 'major', nightMin: 120, center: d }], prime), 13, '8 + 5');
  assert.equal(solunarPoints([
    { type: 'major', nightMin: 120, center: d },
    { type: 'major', nightMin: 120, center: d },
    { type: 'minor', nightMin: 120, center: d },
  ], prime), 23);
  assert.equal(solunarPoints(new Array(10).fill({ type: 'major', nightMin: 120, center: d }), prime), 25, 'plafond');
  assert.equal(solunarPoints([{ type: 'major', nightMin: 10, center: d }], prime), 0.6666666666666666);
});

test('paliers : 40 / 58 / 70 / 85 et niveaux associés', () => {
  const { ratingOf, bandOf, scoreColor } = GCLEngine;
  assert.equal(typeof ratingOf, 'function');
  assert.deepEqual(ratingOf(39), { label: 'Faible', level: 'low' });
  assert.equal(ratingOf(40).label, 'Correct');
  assert.equal(ratingOf(57).label, 'Correct');
  assert.equal(ratingOf(58).label, 'Bon');
  assert.equal(ratingOf(69).label, 'Bon');
  assert.equal(ratingOf(70).label, 'Excellent');
  assert.equal(ratingOf(84).label, 'Excellent');
  assert.equal(ratingOf(85).label, 'Exceptionnel');
  assert.equal(bandOf(0), 'low');
  assert.equal(bandOf(100), 'epic');
  assert.equal(scoreColor(70), 'var(--band-great)');
});

test('total : 4 facteurs, 0–100, aucun champ saison, invariant au mois', () => {
  const { totalScore } = GCLEngine;
  assert.equal(typeof totalScore, 'function');
  const parts = { moon: 31.4, sol: 14.2, meteo: 14, pres: 10 };
  assert.equal(totalScore(parts), 70, '31.4 + 14.2 + 14 + 10 = 69.6 → 70');
  assert.equal(totalScore(), 0);
  assert.equal(totalScore({ moon: 999, sol: 999, meteo: 999, pres: 999 }), 100);
  assert.equal(totalScore({ moon: -5, sol: -5, meteo: -5, pres: -5 }), 0);
  const janvier = totalScore({ ...parts, season: 0 });
  const novembre = totalScore({ ...parts, season: 20 });
  assert.equal(janvier, novembre, 'un champ season même fourni est ignoré');
  const jump = totalScore({ moon: 40, sol: 25, meteo: 25, pres: 10 });
  assert.equal(jump, 100);
});

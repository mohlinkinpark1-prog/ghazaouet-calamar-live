/* Valeurs de référence astronomiques — garantissent que la réécriture
   de astro.js ne perd aucune précision (TDD : ces tests échouent d'abord). */
import test from 'node:test';
import assert from 'node:assert/strict';
import Astro from '../assets/js/astro.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (±${tol})`);

const REFERENCE = [
  {
    iso: '2024-04-08T20:00:00+01:00',
    name: 'Nouvelle lune', illum: 0.00002, elong: 0.50, signed: 0.46394, age: 0.033, rating: 97, periods: 4,
  },
  {
    iso: '2026-01-01T12:00:00+01:00',
    name: 'Gibbeuse croissante', illum: 0.94185, elong: 152.093, signed: 152.53031, age: 12.391, rating: 87, periods: 4,
  },
  {
    iso: '2026-06-21T22:00:00+02:00',
    name: 'Premier quartier', illum: 0.49218, elong: 89.104, signed: 89.10388, age: 6.711, rating: 42, periods: 4,
  },
  {
    iso: '2026-11-06T22:00:00+01:00',
    name: 'Dernier croissant', illum: 0.05999, elong: 28.355, signed: -28.13965, age: 27.112, rating: 87, periods: 4,
  },
];

test('astro : API publique disponible aussi sous Node', () => {
  for (const k of ['phaseInfo', 'signedElong', 'moonAgePrecise', 'nextSyzygy',
    'solunarPeriods', 'solunarRating', 'sunDay', 'moonDay', 'altAz']) {
    assert.equal(typeof Astro[k], 'function', `Astro.${k} manquant`);
  }
  assert.equal(typeof Astro.SYNODIC, 'number');
});

for (const ref of REFERENCE) {
  test(`astro : valeurs de référence au ${ref.iso.slice(0, 10)}`, () => {
    const d = new Date(ref.iso);
    const p = Astro.phaseInfo(d);
    assert.equal(p.name, ref.name);
    near(p.illum, ref.illum, 0.001, 'illumination');
    near(p.elong, ref.elong, 0.02, 'élongation');
    near(p.age, ref.age, 0.05, 'âge lunaire');
    near(Astro.signedElong(d), ref.signed, 0.02, 'élongation signée');
    near(Astro.solunarRating(d), ref.rating, 1, 'indice solunaire');
    const periods = Astro.solunarPeriods(d, 35.096, -1.860);
    assert.equal(periods.length, ref.periods);
    for (const p of periods) {
      assert.ok(p.center instanceof Date && p.start instanceof Date && p.end instanceof Date);
      assert.ok(p.start <= p.center && p.center <= p.end);
      assert.ok(['major', 'minor'].includes(p.type));
    }
  });
}

test('astro : le solveur Newton–Raphson donne un âge dans [0, 29.53[', () => {
  for (let i = 0; i < 24; i++) {
    const d = new Date(2026, 10, 1 + i, 12);
    const age = Astro.moonAgePrecise(d);
    assert.ok(age >= 0 && age < Astro.SYNODIC, `âge hors bornes : ${age}`);
  }
});

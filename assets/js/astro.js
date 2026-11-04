/* ============================================================
   GHAZAOUET CALAMAR LIVE — Moteur astronomique & solunaire
   Phases lunaires, levées/couchers, passages (culminations),
   périodes solunaires et Indice Calamar.
   Précision : ~0,3° sur la longitude lunaire → erreur < 5 min
   sur les heures de lever/coucher. Approximatif, sans garantie.
   ============================================================ */
'use strict';

const Astro = (() => {
  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;
  const norm360 = d => ((d % 360) + 360) % 360;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const SYNODIC = 29.530588853;
  const NEW_MOON_EPOCH_JD = 2451550.26; // 6 janvier 2000, 18:14 UTC

  const jdFromDate = date => date.getTime() / 86400000 + 2440587.5;

  /* ---------- Soleil ---------- */
  function sunCoords(date) {
    const T = (jdFromDate(date) - 2451545.0) / 36525;
    const L0 = norm360(280.46646 + 36000.76983 * T);
    const M = norm360(357.52911 + 35999.05029 * T) * RAD;
    const C = 1.914602 * Math.sin(M) + 0.019993 * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
    const omega = 125.04 - 1934.136 * T;
    const lambda = norm360(L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD));
    return { lambda };
  }

  /* ---------- Lune ---------- */
  function moonCoords(date) {
    const T = (jdFromDate(date) - 2451545.0) / 36525;
    const Lp = norm360(218.3164477 + 481267.88123421 * T);
    const D = norm360(297.8501921 + 445267.1114034 * T) * RAD;
    const M = norm360(357.5291092 + 35999.0502909 * T) * RAD;
    const Mp = norm360(134.9633964 + 477198.8675055 * T) * RAD;
    const F = norm360(93.2720950 + 483202.0175233 * T) * RAD;
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;

    const lon = norm360(
      Lp
      + 6.289 * Math.sin(Mp)
      + 1.274 * Math.sin(2 * D - Mp)
      + 0.658 * Math.sin(2 * D)
      + 0.214 * Math.sin(2 * Mp)
      - 0.186 * E * Math.sin(M)
      - 0.114 * Math.sin(2 * F)
      + 0.059 * Math.sin(2 * D - 2 * Mp)
      + 0.057 * Math.sin(2 * D - M - Mp)
      + 0.053 * Math.sin(2 * D + Mp)
      + 0.046 * Math.sin(2 * D - M)
      - 0.041 * Math.sin(Mp - M)
      - 0.035 * Math.sin(D)
      - 0.031 * E * Math.sin(Mp + M)
      + 0.015 * Math.sin(2 * F - 2 * D)
      + 0.011 * Math.sin(Mp - 4 * D)
    );
    // Latitude écliptique (terme principal — largement suffisant ici)
    return { lambda: lon, beta: 5.128 * Math.sin(F) };
  }

  /* ---------- Écliptique → équatoriale ---------- */
  const OBL = 23.4392911 * RAD;
  function eclToEqu(lambdaDeg, betaDeg) {
    const lam = lambdaDeg * RAD, bet = betaDeg * RAD;
    const ra = Math.atan2(Math.sin(lam) * Math.cos(OBL) - Math.tan(bet) * Math.sin(OBL), Math.cos(lam));
    const dec = Math.asin(Math.sin(bet) * Math.cos(OBL) + Math.cos(bet) * Math.sin(OBL) * Math.sin(lam));
    return { ra: norm360(ra * DEG), dec: dec * DEG };
  }

  /* ---------- Temps sidéral moyen de Greenwich (degrés) ---------- */
  function gmst(date) {
    const jd = jdFromDate(date);
    return norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0));
  }

  /* ---------- Hauteur & azimut d'un astre ---------- */
  function altAz(date, latDeg, lonDeg, lambdaDeg, betaDeg) {
    const { ra, dec } = eclToEqu(lambdaDeg, betaDeg);
    const H = (gmst(date) + lonDeg - ra) * RAD;
    const phi = latDeg * RAD, decR = dec * RAD;
    const alt = Math.asin(Math.sin(phi) * Math.sin(decR) + Math.cos(phi) * Math.cos(decR) * Math.cos(H));
    const az = norm360(Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(decR) * Math.cos(phi)) * DEG + 180);
    return { alt: alt * DEG, az, ra, dec };
  }

  const moonAlt = (date, lat, lon) => {
    const m = moonCoords(date);
    return altAz(date, lat, lon, m.lambda, m.beta).alt;
  };
  const sunAlt = (date, lat, lon) => {
    const s = sunCoords(date);
    return altAz(date, lat, lon, s.lambda, 0).alt;
  };

  /* ---------- Crossings (lever/coucher) pour un jour local ---------- */
  const H0_SUN = -0.833;   // réfraction + demi-diamètre
  const H0_MOON = -0.125;  // réfraction + parallaxe lunaire corrigée

  function dayCrossings(date, lat, lon, altFn, h0) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const tStart = start.getTime(), tEnd = end.getTime();
    const step = 5 * 60 * 1000;
    const pad = 10 * 3600 * 1000;
    const samples = [];
    for (let t = tStart - pad; t <= tEnd + pad; t += step) {
      samples.push({ t, alt: altFn(new Date(t), lat, lon) });
    }
    const events = [], extrema = [];
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i];
      if ((a.alt - h0) * (b.alt - h0) <= 0 && a.alt !== b.alt) {
        const frac = (h0 - a.alt) / (b.alt - a.alt);
        const crossT = a.t + frac * (b.t - a.t);
        if (crossT >= tStart && crossT < tEnd) {
          events.push({ time: new Date(crossT), dir: a.alt < b.alt ? 'rise' : 'set' });
        }
      }
    }
    for (let i = 1; i < samples.length - 1; i++) {
      const p = samples[i - 1].alt, c = samples[i].alt, n = samples[i + 1].alt;
      if (c >= p && c > n) extrema.push({ time: new Date(samples[i].t), kind: 'max', alt: c });
      else if (c <= p && c < n) extrema.push({ time: new Date(samples[i].t), kind: 'min', alt: c });
    }
    const inDay = extrema.filter(e => e.time.getTime() >= tStart && e.time.getTime() < tEnd);
    const hiE = inDay.filter(e => e.kind === 'max').sort((a, b) => b.alt - a.alt)[0];
    const loE = inDay.filter(e => e.kind === 'min').sort((a, b) => a.alt - b.alt)[0];
    return {
      events,
      maxAlt: hiE ? hiE.time : new Date(tStart + 12 * 3600e3),
      minAlt: loE ? loE.time : new Date(tStart),
      hi: hiE ? hiE.alt : -90,
      lo: loE ? loE.alt : 90
    };
  }

  const moonDay = (date, lat, lon) => dayCrossings(date, lat, lon, moonAlt, H0_MOON);
  const sunDay  = (date, lat, lon) => dayCrossings(date, lat, lon, sunAlt,  H0_SUN);

  /* ---------- Phase, illumination, âge ---------- */
  function phaseInfo(date) {
    const jd = jdFromDate(date);
    const s = sunCoords(date), m = moonCoords(date);
    const cosPsi = Math.cos(m.beta * RAD) * Math.cos((m.lambda - s.lambda) * RAD);
    const psi = Math.acos(clamp(cosPsi, -1, 1)); // élongation 0..π
    const illum = (1 - Math.cos(psi)) / 2;
    const elongDeg = psi * DEG; // 0 = nouvelle, 180 = pleine
    let age = (jd - NEW_MOON_EPOCH_JD) % SYNODIC;
    if (age < 0) age += SYNODIC;
    const idx = Math.floor(((age / SYNODIC) * 8) + 0.5) % 8;
    const names = ['Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Gibbeuse croissante',
                   'Pleine lune', 'Gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant'];
    return {
      age, illum, elong: elongDeg, idx,
      name: names[idx],
      waxing: age < SYNODIC / 2,
      phaseAngle: psi
    };
  }

  /* Jours restants avant le prochain événement clé (nouvelle ou pleine lune) */
  function daysToNextSyzygy(date) {
    const ph = phaseInfo(date);
    const pos = ph.age; // jours depuis la nouvelle lune
    const toNew = SYNODIC - pos;
    const full = pos <= SYNODIC / 2 ? (SYNODIC / 2 - pos) : (SYNODIC * 1.5 - pos);
    return [
      { label: 'Pleine lune', days: full },
      { label: 'Nouvelle lune', days: toNew }
    ].sort((a, b) => a.days - b.days)[0];
  }

  /* ---------- Périodes solunaires ---------- */
  function solunarPeriods(date, lat, lon) {
    const periods = [];
    const offsets = [-1, 0, 1];
    const transits = [];

    for (const off of offsets) {
      const d = new Date(date); d.setDate(d.getDate() + off);
      const m = moonDay(d, lat, lon);
      transits.push({ time: m.maxAlt, kind: 'major' });
      transits.push({ time: m.minAlt, kind: 'major' });
    }
    transits.sort((a, b) => a.time - b.time);

    // Mineures : à mi-chemin entre deux culminations successives
    for (let i = 0; i < transits.length - 1; i++) {
      const a = transits[i].time.getTime(), b = transits[i + 1].time.getTime();
      const mid = new Date((a + b) / 2);
      periods.push({ type: 'minor', center: mid, start: new Date(mid.getTime() - 45 * 60000), end: new Date(mid.getTime() + 45 * 60000) });
    }
    for (const t of transits) {
      const half = 55 * 60000;
      periods.push({ type: 'major', center: t.time, start: new Date(t.time.getTime() - half), end: new Date(t.time.getTime() + half) });
    }
    // Ne garder que celles qui chevauchent le jour local
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    return periods
      .filter(p => p.end > dayStart && p.start < dayEnd)
      .sort((a, b) => a.center - b.center);
  }

  /* Recouvrement (minutes) d'une période avec la nuit (coucher→lever) */
  function nightOverlap(period, sunsetT, sunriseNextT) {
    const ns = sunsetT instanceof Date ? sunsetT.getTime() : NaN;
    const nr = sunriseNextT instanceof Date ? sunriseNextT.getTime() : NaN;
    if (Number.isNaN(ns) || Number.isNaN(nr)) return 0;
    const s = period.start.getTime(), e = period.end.getTime();
    const a = Math.max(s, ns), b = Math.min(e, nr);
    return Math.max(0, Math.round((b - a) / 60000));
  }

  /* ---------- Indice solunaire du jour (qualité générale, %) ---------- */
  function solunarRating(date, lat, lon) {
    const jd = jdFromDate(date);
    const s = sunCoords(date), m = moonCoords(date);
    const cosPsi = Math.cos(m.beta * RAD) * Math.cos((m.lambda - s.lambda) * RAD);
    const psi = Math.acos(clamp(cosPsi, -1, 1));
    const coef = Math.pow(Math.abs(Math.cos(psi)), 1.6); // syzygie ≈ 1, quadrature ≈ 0
    return Math.round(42 + 55 * coef);
  }

  /* ---------- Activité horaire (courbe 0..1) ---------- */
  function activityAt(minutesOfDay, periods, nightFactor) {
    let a = 0.14;
    for (const p of periods) {
      const centerMin = p.center.getHours() * 60 + p.center.getMinutes();
      const sigma = p.type === 'major' ? 58 : 46;
      const amp = p.type === 'major' ? 1.0 : 0.55;
      const dd = minutesOfDay - centerMin;
      a += amp * Math.exp(-(dd * dd) / (2 * sigma * sigma));
    }
    return clamp(a * nightFactor, 0, 1.4);
  }

  return {
    jdFromDate, norm360, clamp,
    sunCoords, moonCoords, altAz, moonAlt, sunAlt,
    moonDay, sunDay, phaseInfo, daysToNextSyzygy,
    solunarPeriods, nightOverlap, solunarRating, activityAt,
    SYNODIC
  };
})();

/* ============================================================
   GHAZAOUET CALAMAR LIVE — Application
   Données live : Open-Meteo (météo + mer) · Astronomie : moteur
   interne (assets/js/astro.js) · Mise en cache 10 min.
   ============================================================ */
'use strict';

/* ─────────── Configuration port de Ghazaouet ─────────── */
const CONFIG = {
  lat: 35.096, lon: -1.860,
  tz: 'Africa/Algiers',
  place: 'Port de Ghazaouet',
  refreshMs: 10 * 60 * 1000
};
const METEO_URL = 'https://api.open-meteo.com/v1/forecast?latitude=35.096&longitude=-1.860'
  + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover'
  + '&hourly=pressure_msl,precipitation,weather_code'
  + '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,precipitation_sum,cloud_cover_mean'
  + '&forecast_days=16&timezone=Africa%2FAlgiers';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine?latitude=35.096&longitude=-1.860'
  + '&current=wave_height,wave_direction,wave_period,swell_wave_height,sea_surface_temperature'
  + '&hourly=sea_surface_temperature&daily=wave_height_max&forecast_days=8&timezone=Africa%2FAlgiers';

/* Saison : source unique dans le moteur (GCLEngine.SEASON_20) */
const MONTH_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const MONTH_SHORT = ['JAN','FÉV','MAR','AVR','MAI','JUN','JUL','AOÛ','SEP','OCT','NOV','DÉC'];
const WMO = {
  0:['Ciel dégagé','i-sun'],1:['Plutôt dégagé','i-sun'],2:['Partiellement nuageux','i-cloud'],3:['Couvert','i-cloud'],
  45:['Brouillard','i-cloud'],48:['Brouillard givrant','i-cloud'],
  51:['Bruine légère','i-rain'],53:['Bruine','i-rain'],55:['Bruine forte','i-rain'],56:['Bruine verglaçante','i-rain'],57:['Bruine verglaçante','i-rain'],
  61:['Pluie faible','i-rain'],63:['Pluie modérée','i-rain'],65:['Pluie forte','i-rain'],66:['Pluie verglaçante','i-rain'],67:['Pluie verglaçante','i-rain'],
  71:['Neige faible','i-cloud'],73:['Neige','i-cloud'],75:['Neige forte','i-cloud'],77:['Grésil','i-cloud'],
  80:['Averses faibles','i-rain'],81:['Averses','i-rain'],82:['Averses violentes','i-rain'],
  85:['Averses de neige','i-cloud'],86:['Averses de neige','i-cloud'],
  95:['Orage','i-rain'],96:['Orage + grêle','i-rain'],99:['Orage + grêle','i-rain']
};
const COMPASS_FR = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];

/* ─────────── État global ─────────── */
const state = {
  meteo: null, marine: null, online: true,
  units: { wind: 'kmh', temp: 'c' },
  species: 'calamar',
  lastUpdate: null,
  selectedDayISO: null,
  calCursor: new Date(),
  refreshTimer: null
};

/* ─────────── Splish d'accueil : 3 s de logo animé ─────────── */
function bootSplash() {
  const s = document.getElementById('splash');
  if (!s) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { s.remove(); return; }
  document.body.classList.add('splash-on');
  setTimeout(() => {
    s.classList.add('is-done');
    document.body.classList.remove('splash-on');
    setTimeout(() => s.remove(), 600);
  }, 3000);
}


/* ─────────── Utilitaires ─────────── */
const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad2 = n => String(n).padStart(2, '0');
const parseLocal = s => new Date(s.length === 10 ? s + 'T12:00:00+01:00' : (s.length === 16 ? s + ':00+01:00' : s));
const parseLocalISO = s => new Date(s + ':00+01:00');
const dayKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fmtTime = d => d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: CONFIG.tz }) : '—';
const fmtTimeFull = d => d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: CONFIG.tz }) : '—';
const fmtDateLong = d => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: CONFIG.tz });
const fmtDayShort = d => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: CONFIG.tz });
const degToCompass = deg => COMPASS_FR[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
const wmoDesc = code => (WMO[code] || ['Conditions variables', 'i-cloud'])[0];
const wmoIcon = (code, isDay) => (code === 0 || code === 1) && !isDay ? 'i-moon' : (WMO[code] || ['', 'i-cloud'])[1];
const toTemp = c => state.units.temp === 'f' ? Math.round(c * 9 / 5 + 32) : Math.round(c);
const tempUnit = () => state.units.temp === 'f' ? '°F' : '°C';
const windVal = kmh => state.units.wind === 'kn' ? (kmh / 1.852) : kmh;
const windUnit = () => state.units.wind === 'kn' ? 'kn' : 'km/h';
const fmtWind = kmh => `${windVal(kmh).toFixed(state.units.wind === 'kn' ? 1 : 0)} ${windUnit()}`;
const nearestMinutes = d => d.getHours() * 60 + d.getMinutes();

/* Couleur du thème actif (canvas ne connaît pas les variables CSS) */
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function themeColors() {
  return {
    gold: cssv('--gold') || '#f0b429',
    goldHi: cssv('--gold-hi') || '#ffe9a8',
    goldRgb: cssv('--gold-rgb') || '240,180,41',
    sea: cssv('--sea') || '#34c6dd',
    sea2: cssv('--sea-2') || '#8cebfa',
    seaRgb: cssv('--sea-rgb') || '52,198,221',
    red: cssv('--red') || '#ff7a52',
    amber: cssv('--amber') || '#ffc247',
    bg2: cssv('--bg2') || '#0a1f33',
    track: cssv('--track') || 'rgba(255,255,255,.07)',
    tick: cssv('--tick') || 'rgba(255,255,255,.25)',
    needle: cssv('--needle') || '#f4f8fc'
  };
}

/* Tendance de pression sur 3 h (hPa) — négative = pression en baisse */
function pressureTrendNow() {
  const hourly = state.meteo?.hourly?.pressure_msl, times = state.meteo?.hourly?.time;
  if (!hourly || !times || !times.length) return 0;
  const idx = times.findIndex(t => parseLocalISO(t) >= new Date());
  const nowIdx = idx > 0 ? idx - 1 : 0;
  const prevIdx = Math.max(0, nowIdx - 3);
  const cur = hourly[nowIdx], prev = hourly[prevIdx];
  if (cur == null || prev == null) return 0;
  return cur - prev;
}

function wmoStorm(code) { return code >= 95; }

function cacheRead() {
  try {
    const raw = localStorage.getItem('gcl-cache-v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CONFIG.refreshMs) return { stale: true, ...parsed };
    return parsed;
  } catch { return null; }
}
function cacheWrite(meteo, marine) {
  try { localStorage.setItem('gcl-cache-v1', JSON.stringify({ ts: Date.now(), meteo, marine })); } catch { /* quota */ }
}

/* ─────────── Données journalières agrégées (météo + mer) ─────────── */
function dailyMap() {
  const map = {};
  const d = state.meteo?.daily;
  if (d?.time) {
    d.time.forEach((t, i) => {
      map[t] = {
        tMax: d.temperature_2m_max?.[i], tMin: d.temperature_2m_min?.[i],
        code: d.weather_code?.[i], sunrise: parseLocalISO(d.sunrise[i]), sunset: parseLocalISO(d.sunset[i]),
        windMax: d.wind_speed_10m_max?.[i], gustMax: d.wind_gusts_10m_max?.[i],
        windDir: d.wind_direction_10m_dominant?.[i], precip: d.precipitation_sum?.[i],
        cloud: d.cloud_cover_mean?.[i],
        waveMax: state.marine?.daily?.wave_height_max?.[state.marine.daily.time.indexOf(t)] ?? null
      };
    });
  }
  return map;
}

/* Périodes solunaires d'un jour, avec minutes de nuit (00:00→lever, coucher→24:00) */
function solunarForDay(date, sunrise, sunset) {
  const periods = Astro.solunarPeriods(date, CONFIG.lat, CONFIG.lon);
  const srMin = sunrise ? nearestMinutes(sunrise) : 400;
  const ssMin = sunset ? nearestMinutes(sunset) : 1080;
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
  const relMin = t => Math.round((t - dayStart.getTime()) / 60000);
  const out = periods.map(p => {
    const a = clamp(relMin(Math.max(p.start.getTime(), dayStart.getTime())), 0, 1440);
    const b = clamp(relMin(Math.min(p.end.getTime(), dayEnd.getTime())), 0, 1440);
    const night = Math.max(0, Math.min(b, srMin) - a) + Math.max(0, b - Math.max(a, ssMin));
    return { ...p, nightMin: Math.round(night) };
  });
  return out.sort((a, b) => a.center - b.center);
}

/* ─────────── Espèces — barèmes adaptés (saison 20 · mer 12) ─────────── */
const SPECIES = {
  calamar: {
    name: 'Calamar', plural: 'les calamars', nom: 'le calamar', icon: 'i-squid',
    season: GCLEngine.SEASON_20, // jan→déc (migration, pontes, recrutement)
    water: [13, 21], // fenêtre « optimum » affichée
    wavePt: w => w < 0.3 ? 7 : w < 0.6 ? 6 : w < 1 ? 4 : w < 1.5 ? 2 : 0, // palier 0,6 m (Baléares 2012)
    waterPt: t => t < 12 ? 2 : t <= 16 ? 5 : t <= 19 ? 4 : t <= 21 ? 3 : 1,
    waterPtOff: 3, windMax: 30,
    darkTxt: 'nuit noire — le lamparo (projecteur) sera décisif ; poissonnez sous le halo.',
    summerTxt: 'turlutte fine (n° 1.5–2.5) et pêche surtout à l’aube/au crépuscule.',
    bestTxt: 'les gros sujets se rapprochent de la côte ; privilégiez 20–60 m.',
  },
  loup: {
    name: 'Loup bar', plural: 'les loups', nom: 'le loup', icon: 'i-fish',
    season: [15, 17, 14, 10, 12, 10, 9, 11, 15, 19, 20, 18], // pic oct–fév, creux estival
    water: [13, 21],
    wavePt: w => w < 0.6 ? 7 : w < 1.2 ? 6 : w < 2 ? 4 : w < 2.5 ? 2 : 0, // aime l'eau brassée
    waterPt: t => t < 10 ? 1 : t <= 13 ? 4 : t <= 18 ? 5 : t <= 22 ? 3 : 1,
    waterPtOff: 3, windMax: 35,
    darkTxt: 'nuit noire — leurres bruyants en surface et poisson nageur au bord des flots.',
    summerTxt: 'descendez la profondeur ; le loup reste actif à la fraîche (aube + nocturne).',
    bestTxt: 'eau fraîche = gros poissons le long des enrochements ; 5–25 m.',
  },
  dorade: {
    name: 'Dorade', plural: 'les dorades', nom: 'la dorade', icon: 'i-bream',
    season: [14, 15, 17, 16, 12, 9, 7, 8, 11, 15, 18, 20], // frai oct.–janv. (pic déc., Mellah) puis hivernal généreux ; creux août
    water: [16, 23],
    wavePt: w => w < 0.5 ? 7 : w < 0.8 ? 6 : w < 1.2 ? 4 : w < 1.8 ? 2 : 0,
    waterPt: t => t < 14 ? 1 : t <= 16 ? 4 : t <= 20 ? 5 : t <= 23 ? 4 : 1,
    waterPtOff: 3, windMax: 30,
    darkTxt: 'nuit noire — sorties plus productives au lever du jour sur appâts.',
    summerTxt: 'têtes de ligne légères autour des bouées ; petites dorades sur anchois.',
    bestTxt: 'fonds sableux et pétoles ; 10–40 m, appâts chinchard & crabe.',
  },
  sar: {
    name: 'Sar', plural: 'les sars', nom: 'le sar', icon: 'i-bream',
    season: [8, 9, 12, 14, 16, 18, 20, 20, 18, 15, 11, 9], // pleine saison mai–oct
    water: [16, 24],
    wavePt: w => w < 0.3 ? 7 : w < 0.6 ? 6 : w < 0.8 ? 4 : w < 1.2 ? 2 : 0, // rochers battus = mer calme
    waterPt: t => t < 15 ? 1 : t <= 17 ? 3 : t <= 21 ? 5 : t <= 24 ? 4 : 1,
    waterPtOff: 3, windMax: 30,
    darkTxt: 'nuit noire — le sar mange de nuit mais l’aube reste le meilleur créneau.',
    summerTxt: 'pleine saison : rochers battus et passes, coquillage à l’étale.',
    bestTxt: 'mer calme, claire et franche sur les rochers battus ; à pied 1–10 m.',
  },
};
const SP = () => SPECIES[state.species] || SPECIES.calamar;
/* Mer — 12 pts, par espèce (houle + eau, pénalité vent fort) */
function speciesSeaPoints(wave, sst, windMax) {
  const sp = SP();
  let v = (wave == null ? 4 : sp.wavePt(wave)) + (sst == null ? sp.waterPtOff : sp.waterPt(sst));
  if (windMax != null && windMax > sp.windMax) v -= 2;
  return clamp(v, 0, 12);
}

const isPrimeWindow = center => { const h = center.getHours(); return h >= 20 || h < 2; };

/* ─────────── Indice (Calamar™/Loup/Dorade/Sar™) ─────────── */
function scoreFor(date, dm) {
  const day = dm?.[dayKey(date)] || null;
  const ph = Astro.phaseInfo(date);
  const elong = ph.elong * Math.PI / 180;

  // 1) Lune — 35 pts (syzygie = plein score)
  const moon = GCLEngine.moonScore(elong);

  // 2) Solunaire — 25 pts (recouvrement nocturne + fenêtre prime 20h→02h)
  const periods = solunarForDay(date, day?.sunrise, day?.sunset);
  const sol = GCLEngine.solunarPoints(periods, isPrimeWindow);

  // 3) Saison — 20 pts (barème propre à l'espèce sélectionnée)
  const season = SP().season[date.getMonth()];

  // 4) Mer — 12 pts (barèmes houle/eau/vent de l'espèce)
  const wave = day?.waveMax ?? state.marine?.current?.wave_height ?? null;
  const sst = state.marine?.current?.sea_surface_temperature ?? null;
  const meteo = speciesSeaPoints(wave, sst, day?.windMax);

  // 5) Pression — 8 pts. Étude Baléares 2012 : basse pression (ou en baisse) = touches meilleures
  const p = state.meteo?.current?.pressure_msl ?? null;
  const dp = pressureTrendNow();
  const pres = GCLEngine.pressurePoints(p, dp);

  const parts = { moon: Math.round(moon), sol: Math.round(sol), season: Math.round(season), meteo: Math.round(meteo), pres: Math.round(pres) };
  const total = GCLEngine.totalScore(parts);
  return { total, parts, phase: ph, periods, day };
}

const ratingOf = GCLEngine.ratingOf;

const bestWindowFor = periods => {
  const nightMajors = periods.filter(p => p.type === 'major' && p.nightMin > 0).sort((a, b) => b.nightMin - a.nightMin);
  const nightMinors = periods.filter(p => p.type === 'minor' && p.nightMin > 0).sort((a, b) => b.nightMin - a.nightMin);
  const pick = nightMajors[0] || nightMinors[0] || null;
  if (!pick) return null;
  return { start: fmtTime(pick.start), end: fmtTime(pick.end), type: pick.type, center: pick.center, night: pick.nightMin };
};

/* ─────────── Rendu : horloge sidebar ─────────── */
function renderClock() {
  const now = new Date();
  $('#sideClock').textContent = fmtTimeFull(now);
  $('#sideDate').textContent = fmtDateLong(now);
}

/* ─────────── Rendu : jauge ─────────── */
let gaugeAnim = { from: 0, to: 0, start: 0 };
function drawGauge(score) {
  const canvas = $('#gaugeCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2;
  // Pivot calculé pour que l'arc complet 270° (extrémités rondes incluses) tienne dans le canvas.
  // Contraintes : cy − r ≥ 16 (haut) et cy + 0,707·r ≤ H − 10 (bas).
  const cy = (H - 4.7) / 1.707;
  const r = cy - 16;
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25; // 270°
  const tc = themeColors();
  // Piste
  ctx.lineWidth = 20; ctx.lineCap = 'round';
  ctx.strokeStyle = tc.track;
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
  // Arc valeur (dégradé)
  const frac = clamp(score, 0, 100) / 100;
  const grad = ctx.createLinearGradient(0, cy, W, cy);
  grad.addColorStop(0, tc.red); grad.addColorStop(0.35, tc.amber); grad.addColorStop(0.68, tc.sea); grad.addColorStop(1, tc.gold);
  ctx.strokeStyle = grad;
  ctx.shadowColor = `rgba(${tc.goldRgb},.45)`; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * frac); ctx.stroke();
  ctx.shadowBlur = 0;
  // Graduations
  ctx.strokeStyle = tc.tick; ctx.lineWidth = 2;
  for (let i = 0; i <= 10; i++) {
    const a = a0 + (a1 - a0) * (i / 10);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14));
    ctx.lineTo(cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22));
    ctx.stroke();
  }
  // Aiguille
  const na = a0 + (a1 - a0) * frac;
  ctx.strokeStyle = tc.needle; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(cx + Math.cos(na) * 18, cy + Math.sin(na) * 18); ctx.lineTo(cx + Math.cos(na) * (r - 30), cy + Math.sin(na) * (r - 30)); ctx.stroke();
  ctx.fillStyle = tc.gold;
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = tc.bg2; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
}
function animateGauge(target) {
  gaugeAnim = { from: gaugeAnim.to ?? 0, to: target, start: performance.now() };
  // Peinture synchrone de la valeur finale — garantie même si rAF est gelé (onglet caché / headless)
  drawGauge(target);
  $('#gaugeValue').textContent = Math.round(target);
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (document.hidden || reduced || !window.requestAnimationFrame) return;
  const dur = 900;
  const from = gaugeAnim.from;
  const t0 = performance.now();
  function frame(t) {
    const k = clamp((t - t0) / dur, 0, 1);
    const e = 1 - Math.pow(2, -10 * k);
    const val = from + (target - from) * (k === 1 ? 1 : e);
    drawGauge(val);
    $('#gaugeValue').textContent = Math.round(val);
    if (k < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
function renderFactors(parts) {
  const max = { moon: 35, sol: 25, season: 20, meteo: 12, pres: 8 };
  const labels = { moon: 'Lune', sol: 'Solunaire', season: 'Saison', meteo: 'Mer', pres: 'Pression' };
  $('#factorList').innerHTML = Object.keys(max).map(k => `
    <li class="factor"><small>${labels[k]}</small>
      <div class="factor-track"><div class="factor-fill" style="width:${(parts[k] / max[k]) * 100}%"></div></div>
      <span class="factor-val">${parts[k]}/${max[k]}</span></li>`).join('');
}

/* ─────────── Rendu : lune (canvas) ─────────── */
function drawMoonOn(cv, date, glow = true) {
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 4;
  const ph = Astro.phaseInfo(date);
  ctx.clearRect(0, 0, W, H);
  if (glow) {
    const g = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.6);
    g.addColorStop(0, 'rgba(240,235,215,.34)'); g.addColorStop(1, 'rgba(240,235,215,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // Disque sombre
  const darkGrad = ctx.createRadialGradient(cx - r * .3, cy - r * .3, r * .1, cx, cy, r);
  darkGrad.addColorStop(0, '#2a3648'); darkGrad.addColorStop(1, '#161f2c');
  ctx.fillStyle = darkGrad;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // Partie éclairée
  const k = ph.illum, cosI = 1 - 2 * k;
  const waxing = ph.waxing;
  const rx = Math.abs(cosI) * r;
  const lightGrad = ctx.createRadialGradient(cx + (waxing ? -r * .25 : r * .25), cy - r * .25, r * .1, cx, cy, r * 1.25);
  lightGrad.addColorStop(0, '#fbf7ea'); lightGrad.addColorStop(.55, '#ddd8c8'); lightGrad.addColorStop(1, '#b9b4a4');
  ctx.fillStyle = lightGrad;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  // Moitié de base du côté éclairé
  ctx.beginPath();
  if (waxing) ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2); else ctx.arc(cx, cy, r, Math.PI / 2, Math.PI * 1.5);
  ctx.fill();
  // Ellipse terminateur
  ctx.beginPath();
  if (k < 0.5) {
    // croissant : retirer une demi-ellipse du côté éclairé
    ctx.fillStyle = darkGrad;
    if (waxing) ctx.ellipse(cx, cy, rx, r, 0, -Math.PI / 2, Math.PI / 2);
    else ctx.ellipse(cx, cy, rx, r, 0, Math.PI / 2, Math.PI * 1.5);
    ctx.fill();
  } else {
    // gibbeuse : ajouter une demi-ellipse du côté opposé
    ctx.fillStyle = lightGrad;
    if (waxing) ctx.ellipse(cx, cy, rx, r, 0, Math.PI / 2, Math.PI * 1.5);
    else ctx.ellipse(cx, cy, rx, r, 0, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
  }
  // "Mers" lunaires (subtil)
  ctx.fillStyle = 'rgba(90,95,110,.35)';
  const maria = [[-0.32, -0.15, .16], [0.05, 0.1, .12], [-0.1, 0.38, .09], [0.28, -0.35, .07]];
  for (const [mx, my, mr] of maria) { ctx.beginPath(); ctx.ellipse(cx + mx * r, cy + my * r, mr * r * 1.4, mr * r, 0.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // Limb
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cx, cy, r - 0.6, 0, Math.PI * 2); ctx.stroke();
}

function renderMoonCard(date, dayData) {
  drawMoonOn($('#moonCanvas'), date, true);
  const ph = Astro.phaseInfo(date);
  $('#moonPhaseName').textContent = ph.name;
  $('#moonWaxChip').textContent = ph.waxing ? 'Croissante ↗' : 'Décroissante ↘';
  $('#moonIllum').textContent = Math.round(ph.illum * 100);
  $('#moonAge').textContent = `${ph.age.toFixed(1)} j`;
  $('#moonElong').textContent = `${Math.round(ph.elong)}°`;
  const md = Astro.moonDay(date, CONFIG.lat, CONFIG.lon);
  const rise = md.events.find(e => e.dir === 'rise');
  const set = [...md.events].reverse().find(e => e.dir === 'set');
  $('#moonRise').textContent = rise ? fmtTime(rise.time) : '—';
  $('#moonSet').textContent = set ? fmtTime(set.time) : '—';
  $('#moonTransit').textContent = fmtTime(md.maxAlt);
  const coef = Math.round(45 + 50 * Math.pow(Math.abs(Math.cos(ph.elong * Math.PI / 180)), 1.3));
  $('#tideCoef').textContent = `≈ ${coef}`;
  const next = Astro.nextSyzygy(date);
  $('#moonNext').innerHTML = `Prochain : <strong>${next.label}</strong> dans <strong>${Math.max(0, Math.round(next.days * 10) / 10)} j</strong>${next.time ? ` · ${next.time.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: CONFIG.tz })} à ${fmtTime(next.time)}` : ''}`;
}

/* ─────────── Rendu : météo ─────────── */
function renderMeteo(dm) {
  const m = state.meteo, cur = m?.current;
  const today = dm[dayKey(new Date())];
  const isDay = cur?.is_day !== 0;
  $('#wxDesc').textContent = cur ? wmoDesc(cur.weather_code) : 'Données indisponibles';
  $('#wxIcon').innerHTML = `<use href="#${cur ? wmoIcon(cur.weather_code, isDay) : 'i-cloud'}"/>`;
  $('#wxTemp').textContent = cur ? toTemp(cur.temperature_2m) : '–';
  $('#wxUnit').textContent = tempUnit();
  $('#wxFeel').textContent = cur ? `${toTemp(cur.apparent_temperature)}${tempUnit()}` : '–';
  $('#wxMinMax').textContent = today ? `${toTemp(today.tMin)}° / ${toTemp(today.tMax)}°` : '';
  $('#wxWind').textContent = cur ? fmtWind(cur.wind_speed_10m) : '–';
  $('#wxWindDir').textContent = cur ? degToCompass(cur.wind_direction_10m) : '';
  $('#windArrow').textContent = '↑';
  $('#windArrow').style.transform = cur ? `rotate(${(cur.wind_direction_10m + 180) % 360}deg)` : 'none';
  $('#wxGusts').textContent = cur ? fmtWind(cur.wind_gusts_10m) : '–';
  $('#wxHumidity').textContent = cur ? `${Math.round(cur.relative_humidity_2m)} %` : '–';
  $('#wxPressure').textContent = cur ? `${Math.round(cur.pressure_msl)} hPa` : '–';
  const dP = pressureTrendNow();
  const trend = dP > 0.8 ? '↗ hausse' : dP < -0.8 ? '↘ baisse' : '→ stable';
  $('#wxPressureTrend').textContent = trend;
  $('#wxClouds').textContent = cur ? `${Math.round(cur.cloud_cover)} %` : '–';
  $('#wxPrecip').textContent = today?.precip != null ? `${today.precip.toFixed(1)} mm` : '–';
}

/* ─────────── Rendu : mer ─────────── */
function renderMer() {
  const cur = state.marine?.current;
  if (!cur) {
    $('#waveHeight').textContent = '–';
    $('#seaNote').textContent = 'Données marines indisponibles (hors ligne ?) — Indice calculé sur lune + saison.';
    return;
  }
  $('#waveHeight').textContent = cur.wave_height.toFixed(2);
  $('#waveDir').textContent = `${degToCompass(cur.wave_direction)} ${Math.round(cur.wave_direction)}°`;
  $('#waveArrow').textContent = '↑';
  $('#waveArrow').style.transform = `rotate(${(cur.wave_direction + 180) % 360}deg)`;
  $('#wavePeriod').textContent = `${cur.wave_period.toFixed(1)} s`;
  $('#swellHeight').textContent = `${cur.swell_wave_height.toFixed(2)} m`;
  $('#waveBar').style.left = `${clamp(cur.wave_height / 1.5, 0, 1) * 100}%`;
  const sst = cur.sea_surface_temperature;
  $('#sstValue').textContent = sst.toFixed(1);
  const spW = SP().water, [w0, w1] = spW;
  const verdict = sst < w0 ? 'Eau froide' : sst <= w1 ? `Optimum ${SP().name}` : 'Un peu chaude';
  $('#sstVerdict').textContent = verdict;
  $('#sstVerdict').className = 'chip ' + (sst < w0 || sst > w1 + 0.5 ? 'chip-ghost' : 'chip-sea');
  const note = cur.wave_height < 0.3 ? 'Mer belle à légère — conditions idéales pour la turlutte comme pour le lamparo.'
    : cur.wave_height < 0.6 ? 'Petite agitation — agréable en dérive, lamparo déconseillé si le vent forcit.'
    : cur.wave_height < 1.0 ? 'Mer agitée — sorties en barque sportives ; privilégiez la jetée sous le vent.'
    : 'Mer formée — restez à quai. La sécurité prime sur la pêche.';
  $('#seaNote').textContent = note;
}

/* ─────────── Rendu : solunaire ─────────── */
function renderSolunaire(date, periods, rating) {
  $('#solRating').textContent = `Solunaire ${rating}/100`;
  const items = periods.map(p => {
    const major = p.type === 'major';
    const tag = p.nightMin > 0 ? `<span class="sol-tag sol-tag-night">Nuit · ${p.nightMin} min</span>` : `<span class="sol-tag sol-tag-day">Jour</span>`;
    return `<li class="sol-item ${major ? 'sol-item-major' : ''}">
      <span class="sol-badge ${major ? 'sol-badge-major' : 'sol-badge-minor'}">${major ? 'MAJEURE' : 'MINEURE'}</span>
      <span class="sol-time">${fmtTime(p.start)} – ${fmtTime(p.end)}</span>
      ${tag}</li>`;
  });
  $('#solList').innerHTML = items.join('') || '<li class="sol-item is-skeleton">Aucune période</li>';
}

/* ─────────── Rendu : recommandations ─────────── */
function renderReco(date, score, dm) {
  const sp = SP();
  const ph = Astro.phaseInfo(date);
  const today = dm[dayKey(date)];
  const cur = state.meteo?.current;
  const wave = state.marine?.current?.wave_height;
  const recos = [];
  const bw = bestWindowFor(score.periods);
  if (bw && bw.night > 0) {
    recos.push({ cls: 'reco-gold', icon: sp.icon, html: `<strong>Sortez ${bw.type === 'major' ? 'ce soir' : 'pour la mineure'} :</strong> fenêtre ${bw.start} → ${bw.end} (${bw.type === 'major' ? 'majeure' : 'mineure'}, ${bw.night} min de nuit).` });
  } else {
    recos.push({ cls: '', icon: 'i-clock', html: `<strong>Pas de période majeure dans la nuit</strong> — tentez l'aube ou reportez-vous sur les périodes du calendrier.` });
  }
  // Lune
  const cosAbs = Math.abs(Math.cos(ph.elong * Math.PI / 180));
  if (cosAbs > 0.85) recos.push({ cls: 'reco-gold', icon: 'i-moon', html: `<strong>${ph.name}</strong> — forte attraction solunaire (coefficient max). ${sp.plural.charAt(0).toUpperCase() + sp.plural.slice(1)} chassent activement.` });
  else if (cosAbs > 0.5) recos.push({ cls: '', icon: 'i-moon', html: `<strong>${ph.name}</strong> (${Math.round(ph.illum * 100)} % éclairée) — activité intermédiaire.` });
  else recos.push({ cls: '', icon: 'i-moon', html: `<strong>${ph.name}</strong> (quadrature) — activité réduite ; misez sur les heures de culmination.` });
  // Météo / mer
  if (cur && wmoStorm(cur.weather_code)) recos.push({ cls: 'reco-warn', icon: 'i-alert', html: `<strong>Orage en cours</strong> — n'allez pas en mer. La pêche attendra.` });
  else if (today && today.code >= 95) recos.push({ cls: 'reco-warn', icon: 'i-alert', html: `<strong>Orages annoncés aujourd'hui</strong> — surveillez le bulletin ONM avant de partir.` });
  else if (wave != null && wave >= 0.6) recos.push({ cls: 'reco-warn', icon: 'i-waves', html: `<strong>Houle ${wave.toFixed(2)} m</strong> — préférez la digue abritée ou reportez la sortie en barque.` });
  else if (cur && cur.wind_speed_10m > 25) recos.push({ cls: 'reco-warn', icon: 'i-wind', html: `<strong>Vent ${fmtWind(cur.wind_speed_10m)}</strong> — dérive difficile, lin­gue lourde conseillée.` });
  // Saison / eau — d'après le barème de saison de l'espèce
  const m = date.getMonth();
  if (sp.season[m] >= 16) recos.push({ cls: '', icon: 'i-check', html: `<strong>Bonne période pour ${sp.nom}</strong> — ${sp.bestTxt}` });
  else if (sp.season[m] <= 10) recos.push({ cls: '', icon: 'i-info', html: `<strong>Creux de saison</strong> — ${sp.summerTxt}` });
  // Lumière
  if (ph.illum < 0.35) recos.push({ cls: '', icon: 'i-sun', html: `<strong>Nuit noire</strong> — ${sp.darkTxt}` });
  $('#recoList').innerHTML = recos.slice(0, 5).map(r => `<li class="reco-item ${r.cls}"><svg class="ic"><use href="#${r.icon}"/></svg><span>${r.html}</span></li>`).join('');
}

/* ─────────── Rendu : alerte orage ─────────── */
function renderStormAlert(dm) {
  const codes = [];
  if (state.meteo?.current) codes.push(state.meteo.current.weather_code);
  for (const k of Object.keys(dm)) codes.push(dm[k].code);
  const storm = codes.find(c => c >= 95);
  const gust = state.meteo?.current?.wind_gusts_10m;
  const strip = $('#stormAlert');
  if (storm) {
    strip.classList.remove('is-hidden');
    $('#stormAlertText').textContent = 'Alerte orage — mer dangereuse. Sortie en mer déconseillée ; restez à l’abri et sécurisez le matériel.';
  } else if (gust != null && gust > 60) {
    strip.classList.remove('is-hidden');
    $('#stormAlertText').textContent = `Rafales ${fmtWind(gust)} — navigation délicate. Évitez la digue exposée nord-ouest.`;
  } else {
    strip.classList.add('is-hidden');
  }
}

/* ─────────── Rendu : courbe d'activité 24 h ─────────── */
function renderActivityChart(date, periods, today) {
  const canvas = $('#activityChart');
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const sr = today?.sunrise, ss = today?.sunset;
  const srMin = sr ? nearestMinutes(sr) : 460, ssMin = ss ? nearestMinutes(ss) : 1080;
  const xOf = min => (min / 1440) * (W - 44) + 34;
  const yOf = v => H - 30 - v * (H - 62);

  // Zones de nuit
  ctx.fillStyle = 'rgba(110,130,255,.09)';
  ctx.fillRect(xOf(0), 8, xOf(srMin) - xOf(0), H - 38);
  ctx.fillRect(xOf(ssMin), 8, xOf(1440) - xOf(ssMin), H - 38);

  // Grille horizontale
  ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = '9px JetBrains Mono, monospace';
  for (const g of [0.25, 0.5, 0.75]) {
    ctx.beginPath(); ctx.moveTo(xOf(0), yOf(g)); ctx.lineTo(xOf(1440), yOf(g)); ctx.stroke();
    ctx.fillText(String(Math.round(g * 100)), 4, yOf(g) + 3);
  }
  // Axe X
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  for (let h = 0; h <= 24; h += 4) ctx.fillText(`${pad2(h)}h`, xOf(h * 60) - 8, H - 12);

  // Lever / coucher (pointillés)
  ctx.setLineDash([4, 4]); ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(255,217,112,.55)';
  ctx.beginPath(); ctx.moveTo(xOf(srMin), 8); ctx.lineTo(xOf(srMin), H - 30); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(xOf(ssMin), 8); ctx.lineTo(xOf(ssMin), H - 30); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,217,112,.85)'; ctx.font = '8px JetBrains Mono, monospace';
  if (sr) ctx.fillText(`↑ ${fmtTime(sr)}`, xOf(srMin) + 4, 18);
  if (ss) ctx.fillText(`↓ ${fmtTime(ss)}`, xOf(ssMin) + 4, 18);

  // Courbe d'activité (facteur nuit plus fort)
  const nightFactor = min => (min < srMin || min >= ssMin) ? 1 : 0.42;
  const pts = [];
  for (let min = 0; min <= 1440; min += 6) {
    let a = 0.14;
    for (const p of periods) {
      const cMin = nearestMinutes(p.center);
      const sigma = p.type === 'major' ? 58 : 46;
      const amp = p.type === 'major' ? 1.0 : 0.55;
      a += amp * Math.exp(-((min - cMin) ** 2) / (2 * sigma * sigma));
    }
    pts.push({ min, v: clamp(a * nightFactor(min), 0, 1.15) / 1.15 });
  }
  // Remplissage
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  const seaRgb = themeColors().seaRgb;
  grad.addColorStop(0, `rgba(${seaRgb},.45)`); grad.addColorStop(1, `rgba(${seaRgb},.02)`);
  ctx.beginPath(); ctx.moveTo(xOf(0), yOf(0));
  for (const p of pts) ctx.lineTo(xOf(p.min), yOf(p.v));
  ctx.lineTo(xOf(1440), yOf(0)); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  // Ligne
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(xOf(p.min), yOf(p.v)) : ctx.moveTo(xOf(p.min), yOf(p.v)));
  ctx.strokeStyle = themeColors().sea2; ctx.lineWidth = 2.2;
  ctx.shadowColor = `rgba(${seaRgb},.6)`; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;

  // Marqueur "maintenant"
  const now = new Date();
  if (dayKey(now) === dayKey(date)) {
    const m = nearestMinutes(now);
    const nowCol = themeColors().gold;
    ctx.setLineDash([5, 4]); ctx.strokeStyle = nowCol; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(xOf(m), 8); ctx.lineTo(xOf(m), H - 30); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = nowCol; ctx.font = 'bold 8px JetBrains Mono, monospace';
    ctx.fillText('MAINTENANT', clamp(xOf(m) + 4, 4, W - 70), H - 34);
  }
  // Pied : meilleure fenêtre
  const bw = bestWindowFor(periods);
  $('#chartFoot').innerHTML = bw
    ? `<span>Fenêtre idéale : <b>${bw.start} → ${bw.end}</b></span><span>· type : <b>${bw.type === 'major' ? 'MAJEURE' : 'MINEURE'}</b></span><span>· obscurité : <b>${bw.night} min</b></span>`
    : '<span>Aucune fenêtre de nuit — voir le calendrier pour les prochains jours.</span>';
}

/* ─────────── Rendu : grille 14 jours ─────────── */
const bandOf = GCLEngine.bandOf;
const scoreColor = GCLEngine.scoreColor;

function renderForecast(dm) {
  const grid = $('#forecastGrid');
  const today = new Date();
  const cards = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    const sc = scoreFor(d, dm);
    const day = dm[dayKey(d)];
    const bw = bestWindowFor(sc.periods);
    cards.push({ d, sc, day, bw, wave: day?.waveMax ?? null });
  }
  grid.innerHTML = cards.map(({ d, sc, day, bw, wave }, i) => {
    const todayTag = i === 0 ? '<span class="f-tag">AUJ.</span>' : '';
    const tMax = day ? `${toTemp(day.tMax)}°` : '–';
    const tMin = day ? `${toTemp(day.tMin)}°` : '–';
    const waveTxt = wave != null ? `vagues ${wave.toFixed(2)} m` : 'vagues –';
    const windTxt = day?.windMax != null ? fmtWind(day.windMax) : '';
    const gustoTxt = day?.gustMax != null ? `raf. ${fmtWind(day.gustMax)}` : '';
    const win = bw ? `<span>${bw.start} → ${bw.end}</span>` : '<em>Pas de fenêtre de nuit</em>';
    return `<button class="f-card ${i === 0 ? 'is-today' : ''} ${state.selectedDayISO === dayKey(d) ? 'is-selected' : ''}" data-day="${dayKey(d)}">
      ${todayTag}
      <div class="f-day"><b>${d.toLocaleDateString('fr-FR', { weekday: 'short' })}</b><span>${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span></div>
      <div class="f-moon-row"><canvas width="88" height="88" data-moon="${d.toISOString()}"></canvas>
        <div class="f-moon-meta"><small>${sc.phase.name}</small><span>${Math.round(sc.phase.illum * 100)}% éclairée</span></div>
      </div>
      <div class="f-score"><b style="color:${scoreColor(sc.total)}">${sc.total}</b><small>/100 · ${ratingOf(sc.total).label}</small></div>
      <div class="f-bar"><i style="width:${sc.total}%"></i></div>
      <div class="f-rows"><div><svg class="ic"><use href="#i-thermo"/></svg>${tMin} / ${tMax}</div><div><svg class="ic"><use href="#i-waves"/></svg>${waveTxt}</div><div><svg class="ic"><use href="#i-wind"/></svg>${windTxt} ${gustoTxt}</div></div>
      <div class="f-window">${bw ? 'Fenêtre : ' : ''}${win}</div>
    </button>`;
  }).join('');
  $$('canvas[data-moon]', grid).forEach(cv => drawMoonOn(cv, new Date(cv.dataset.moon), false));
  $$('.f-card', grid).forEach(card => card.addEventListener('click', () => {
    state.selectedDayISO = card.dataset.day;
    renderForecast(dm);
    renderDayDetail(dm);
  }));
}

function renderDayDetail(dm) {
  const box = $('#dayDetail');
  const iso = state.selectedDayISO;
  if (!iso) { box.classList.add('is-hidden'); return; }
  const d = new Date(iso + 'T12:00:00+01:00');
  const sc = scoreFor(d, dm);
  const day = dm[iso];
  const rating = ratingOf(sc.total);
  const max = { moon: 35, sol: 25, season: 20, meteo: 12, pres: 8 };
  const labels = { moon: 'Lune', sol: 'Périodes solunaires', season: 'Saison', meteo: 'Mer & vent', pres: 'Pression' };
  const rows = Object.keys(max).map(k => `
    <div class="factor" style="grid-template-columns:130px 1fr 44px"><small>${labels[k]}</small>
      <div class="factor-track"><div class="factor-fill" style="width:${(sc.parts[k] / max[k]) * 100}%"></div></div>
      <span class="factor-val">${sc.parts[k]}/${max[k]}</span></div>`).join('');
  const periodsHtml = sc.periods.map(p => `
    <li class="sol-item ${p.type === 'major' ? 'sol-item-major' : ''}">
      <span class="sol-badge ${p.type === 'major' ? 'sol-badge-major' : 'sol-badge-minor'}">${p.type === 'major' ? 'MAJEURE' : 'MINEURE'}</span>
      <span class="sol-time">${fmtTime(p.start)} – ${fmtTime(p.end)}</span>
      ${p.nightMin > 0 ? `<span class="sol-tag sol-tag-night">Nuit · ${p.nightMin} min</span>` : '<span class="sol-tag sol-tag-day">Jour</span>'}
    </li>`).join('');
  const bw = bestWindowFor(sc.periods);
  box.classList.remove('is-hidden');
  box.innerHTML = `
    <div class="day-detail-head">
      <div>
        <span class="card-kicker">Fiche journée</span>
        <h3>${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: CONFIG.tz })}</h3>
        <p class="view-sub" style="margin-top:4px">${sc.phase.name} · ${Math.round(sc.phase.illum * 100)} % éclairée · âge ${sc.phase.age.toFixed(1)} j</p>
      </div>
      <div class="rating-pill" data-level="${rating.level}" style="font-size:20px;padding:12px 20px">${sc.total}<small style="font-size:12px;opacity:.7">/100</small> · ${rating.label}</div>
    </div>
    <div class="day-detail-grid">
      <div class="dd-block"><h4>Décomposition</h4><div class="factors">${rows}</div></div>
      <div class="dd-block"><h4>Périodes de la journée</h4><ol class="sol-list" style="margin-top:2px">${periodsHtml}</ol></div>
      <div class="dd-block"><h4>Conditions prévues</h4>
        <ul class="f-rows" style="font-size:11px;gap:7px;list-style:none;padding:0">
          <li><svg class="ic"><use href="#i-thermo"/></svg> Min / max : <strong style="color:#fff">${day ? `${toTemp(day.tMin)} / ${toTemp(day.tMax)} ${tempUnit()}` : '—'}</strong></li>
          <li><svg class="ic"><use href="#i-waves"/></svg> Vagues max : <strong style="color:#fff">${day?.waveMax != null ? day.waveMax.toFixed(2) + ' m' : '—'}</strong></li>
          <li><svg class="ic"><use href="#i-wind"/></svg> Vent max : <strong style="color:#fff">${day?.windMax != null ? fmtWind(day.windMax) : '—'}</strong> · raf. ${day?.gustMax != null ? fmtWind(day.gustMax) : '—'}</li>
          <li><svg class="ic"><use href="#i-rain"/></svg> Précipitations : <strong style="color:#fff">${day?.precip != null ? day.precip.toFixed(1) + ' mm' : '—'}</strong></li>
          <li><svg class="ic"><use href="#i-sunrise"/></svg> Lever ${day?.sunrise ? fmtTime(day.sunrise) : '—'} · Coucher ${day?.sunset ? fmtTime(day.sunset) : '—'}</li>
        </ul>
      </div>
    </div>
    <div class="dd-actions">
      <button class="btn btn-gold" id="btnCopyFiche"><svg class="ic"><use href="#i-copy"/></svg> Copier la fiche texte</button>
      <button class="btn btn-ghost" id="btnCloseDetail"><svg class="ic"><use href="#i-x"/></svg> Fermer</button>
    </div>`;
  $('#btnCloseDetail').addEventListener('click', () => { state.selectedDayISO = null; box.classList.add('is-hidden'); renderForecast(dm); });
  $('#btnCopyFiche').addEventListener('click', async () => {
    const txt = [
      `GHAZAOUET CALAMAR LIVE — ${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: CONFIG.tz })}`,
      `Indice Calamar : ${sc.total}/100 (${rating.label})`,
      `Lune : ${sc.phase.name}, ${Math.round(sc.phase.illum * 100)} % éclairée`,
      bw ? `Fenêtre de nuit : ${bw.start} → ${bw.end} (${bw.type === 'major' ? 'majeure' : 'mineure'})` : 'Pas de fenêtre de nuit',
      day ? `Météo : ${toTemp(day.tMin)}/${toTemp(day.tMax)} °C · pluie ${day.precip?.toFixed(1) ?? 0} mm · vent max ${day.windMax ?? '?'} km/h` : '',
      'Port de Ghazaouet · 35.096°N 1.860°W'
    ].join('\n');
    try {
      await navigator.clipboard.writeText(txt);
      const b = $('#btnCopyFiche');
      b.innerHTML = '<svg class="ic"><use href="#i-check"/></svg> Copié !';
      setTimeout(() => { b.innerHTML = '<svg class="ic"><use href="#i-copy"/></svg> Copier la fiche texte'; }, 1800);
    } catch { /* presse-papier indisponible */ }
  });
}

/* ─────────── Rendu : calendrier du mois ─────────── */
function syzygiesOfMonth(year, month) {
  const out = [];
  const days = new Date(year, month + 1, 0).getDate();
  let prevIllum = null, prevAge = null;
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d, 12, 0, 0);
    const ph = Astro.phaseInfo(date);
    if (ph.illum > 0.985 && prevIllum !== null && prevIllum <= ph.illum) out.push({ type: 'Pleine lune', date });
    if (ph.age < 1.1 && prevAge !== null && prevAge > ph.age) out.push({ type: 'Nouvelle lune', date });
    prevIllum = ph.illum; prevAge = ph.age;
  }
  return out;
}

function renderCalendar(dm) {
  const cursor = state.calCursor;
  const year = cursor.getFullYear(), month = cursor.getMonth();
  $('#calMonthTitle').textContent = MONTH_FR[month].charAt(0).toUpperCase() + MONTH_FR[month].slice(1) + ' ' + year;
  const grid = $('#calGrid');
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // lundi = 0
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells = [];
  const todayKey = dayKey(new Date());
  const scores = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - offset + 1;
    if (dayNum < 1 || dayNum > daysIn) { cells.push('<div class="cal-cell is-out" aria-hidden="true"></div>'); continue; }
    const d = new Date(year, month, dayNum, 12, 0, 0);
    const iso = dayKey(d);
    const inForecast = dm[iso] !== undefined;
    const sc = scoreFor(d, dm);
    scores.push({ d, sc, inForecast });
    const band = bandOf(sc.total);
    cells.push(`<div class="cal-cell ${iso === todayKey ? 'is-today' : ''}" data-band="${band}" role="button" tabindex="0" data-day="${iso}">
      <div class="cal-daynum"><span>${dayNum}</span>${inForecast ? '' : '<em>*</em>'}</div>
      <canvas width="68" height="68" data-moon="${d.toISOString()}"></canvas>
      <div class="cal-score" style="color:${scoreColor(sc.total)}">${sc.total}<small>${ratingOf(sc.total).label}</small></div>
    </div>`);
  }
  grid.innerHTML = cells.join('');
  $$('canvas[data-moon]', grid).forEach(cv => drawMoonOn(cv, new Date(cv.dataset.moon), false));
  $$('.cal-cell[data-day]', grid).forEach(cell => {
    const open = () => {
      state.selectedDayISO = cell.dataset.day;
      activateView('previsions');
      renderForecast(dm);
      renderDayDetail(dm);
      $('#dayDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    cell.addEventListener('click', open);
    cell.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
  const top = [...scores].sort((a, b) => b.sc.total - a.sc.total).slice(0, 5);
  $('#topDaysList').innerHTML = top.map(({ d, sc, inForecast }, i) => `<li><span class="rank">${i + 1}.</span><span>${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}${inForecast ? '' : ' *'}</span><b>${sc.total}</b></li>`).join('');
  const syz = syzygiesOfMonth(year, month);
  $('#syzygyList').innerHTML = syz.length
    ? syz.map(s => `<li><svg class="ic"><use href="#i-moon"/></svg><span><strong>${s.type}</strong><small>${s.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</small></span></li>`).join('')
    : '<li>Aucune syzygie détectée ce mois-ci.</li>';
}

/* ─────────── Rendu : barres saisonnières ─────────── */
function renderSeasonBars() {
  const max = Math.max(...GCLEngine.SEASON_20);
  const topMonths = [9, 10, 0, 1, 11]; // oct, nov, jan, fév, déc
  $('#seasonBars').innerHTML = GCLEngine.SEASON_20.map((v, i) => {
    const top = topMonths.includes(i);
    return `<div class="season-row ${top ? 'is-top' : ''}"><span>${MONTH_SHORT[i]}</span><div class="season-track"><div class="season-fill" style="width:0%" data-w="${(v / max) * 100}"></div></div><b>${Math.round(v / max * 100)}</b></div>`;
  }).join('');
  // Largeurs peintes immédiatement (transition CSS si visible) — rAF parfois gelé en onglet caché
  $$('.season-fill').forEach(el => { el.style.width = el.dataset.w + '%'; });
}

/* ─────────── Rendu : FAQ ─────────── */
const FAQ = [
  { q: 'Quelle est la meilleure lune pour le calamar ?', a: 'Ça dépend de la technique — la science est nette : (1) Turlutte sans lampe : la pleine lune renforce les captures (étude mer Égée, p<0.01), turluttes rouges devant. (2) Lamparo / LEDs : les nuits sombres gagnent — nouvelle lune idéale ; sous LEDs clignotantes, le 3e quartier est le plus productif (étude Indonésie 2021, p<0.05) ; LED bleue > blanche. (3) Sans technique définie, l’étude méditerranéenne de référence (Baléares, ICES 2012) montre des CPUE supérieures près de la nouvelle lune + mois froids. Dans tous les cas : lune en phase syzygie (± 2 jours) = pic d’activité.' },
  { q: 'Quelles heures exactement ?', a: 'La fenêtre reine court du crépuscule jusqu’à ~3 h après la tombée de la nuit (19 h – 23 h en novembre à Ghazaouet). Les passages solunaires majeurs (lune au zénith puis au nadir, ≈ 12 h 25 min d’écart) doublent les touches ; une mineure encadre chaque majeure. Deuxième créneau : 02 h – 04 h du matin. Le poisson diminue nettement entre 10 h et 17 h.' },
  { q: 'Quelle profondeur faut-il viser ?', a: 'Le calamar commun vit de la surface à 500 m, mais il chasse surtout entre 20 et 80 m la nuit, près du fond. À Ghazaouet : la pente du plateau (30 → 80 m) au large du port et les fonds sableux de Honaïne sont des valeurs sûres. En journée il redescend : moins de touches du bord.' },
  { q: 'Faut-il obligatoirement un bateau ?', a: 'Non. La digue et la jetée ouest fonctionnent très bien pour le lamparo et la turlutte lancée sous les lampes du port, mer calme. La barque ouvre en revanche les 30–80 m et les chasses. Dans tous les cas : gilet, téléphone chargé, quelqu’un prévenu — jamais seul de nuit.' },
  { q: 'Quel leurre et quelle animation ?', a: 'Turlutte (turlutte) 2.0–3.5, coloris rose/orange/blanc phosphorescent. Lancer–ramener saccadé (2–4 twitches), longue pause (3–6 s), répété. Le calamar attaque souvent à la descente ou pendant la pause. Silure interdit ? Non — mais pas d’ardillon : la turlutte crochète. Émerillon agrafe pour changer vite selon la couleur du moment.' },
  { q: 'Quelle réglementation à respecter ?', a: 'La pêche récréative en Algérie est encadrée : tailles minimales, repos biologique (généralement en été), zones classées, permis selon engin. Renseignez-vous auprès de la Direction de la Pêche et de l’Aquaculture de la wilaya de Tlemcen (ou la Chambre de Pêche) avant chaque sortie. Les professionnels du port de Ghazaouet restent la meilleure source locale.' },
  { q: 'Pourquoi certaines nuits « mortes » malgré une belle lune ?', a: 'La lune n’est qu’un facteur : une houle d’ouest > 0,6 m, un vent > 25 km/h, un orage ou une eau trop chaude (> 21 °C) égalisent l’effet lunaire — les études montrent des CPUE faibles dès que la mer se forme ou que la pression monte. C’est exactement ce que synthétise l’Indice Calamar™ (lune 35 + solunaire 25 + saison 20 + mer 12 + pression 8). Et si la pression baisse nette (−0,7 hPa/3 h), c’est souvent bon signe : l’étude des Baléares l’associe à de meilleures touches.' }
];
function renderFAQ() {
  $('#faqList').innerHTML = FAQ.map((f, i) => `
    <div class="faq-item ${i === 0 ? 'is-open' : ''}">
      <button class="faq-q" aria-expanded="${i === 0}"><span>${f.q}</span><svg class="ic"><use href="#i-squid"/></svg></button>
      <div class="faq-a"><div class="faq-a-inner">${f.a}</div></div>
    </div>`).join('');
  $$('.faq-q').forEach(btn => btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    item.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', item.classList.contains('is-open'));
  }));
}

/* ─────────── Rendu : méthode ─────────── */
const METHOD = [
  { h: 'Lune — 35 points', p: 'Proximité de la syzygie (nouvelle OU pleine lune) : |cos(élongation)|^1.8, planchée à 30 %. Effet lunaire statistiquement établi chez le calamar (Égée 2011 p<0.01, Indonésie 2021 p<0.05, Baléares 2012). Sens optimal : nouvelle lune (lamparo/approche globale) vs pleine lune (turlutte sans lampe) — l’indice les traite à égalité et le guide détaille.', w: '35 pts' },
  { h: 'Périodes solunaires — 25 points', p: 'Chaque majeure recouvrant la nuit rapporte jusqu’à 8 pts, chaque mineure jusqu’à 2 ; bonus +5 si une majeure tombe entre 20 h et 02 h. Honnêteté : Knight (1926) est une hypothèse folklorique non validée en général (revues : effet modeste, ~5 % sur trophées) ; elle reste le meilleur descripteur horaire disponible, croisé ici avec la preuve lunaire directe.', w: '25 pts' },
  { h: 'Saison — 20 points', p: 'Barème /20 (oct–déc–jan ≈ 20, nov max) : migration côtière des gros sujets jan–fév ; ponte échelonnée printemps et automne (Rocha & Guerra 1996) ; recrutement fév–mars et juil–sept ; CPUE supérieures en mois froids (Baléares 2012).', w: '20 pts' },
  { h: 'Mer — 12 points', p: 'Vagues 7 pts (<0,3 m = 7 ; 0,6–1 m = 4 ; ≥1,5 m = 0) + eau 5 pts (≤16 °C = 5 ; 17–19 °C = 4 ; 19–21 °C = 3 ; >21 °C = 1). Étude Baléares : CPUE plus forte par mer fraîche et houle faible ; l’été (eau chaude) fait chuter l’activité.', w: '12 pts' },
  { h: 'Pression — 8 points', p: 'En baisse nette (3 h, Δ<−0,7 hPa) = 8 pts (favorable, étude Baléares 2012) ; basse stable ≤1012 hPa = 7 ; neutre 1012–1018 = 5 ; haute ou en hausse = 4. Les régimes dépressionnaires stimulent la chasse de surface.', w: '8 pts' }
];
function renderMethod() {
  $('#methodList').innerHTML = METHOD.map(m => `
    <li class="method-item"><div><h4>${m.h}</h4><p>${m.p}</p></div><div class="method-weight">${m.w}<small>poids</small></div></li>`).join('');
}

/* ─────────── Navigation — story verticale : scroll + scroll-spy ─────────── */
const VIEW_IDS = ['dashboard', 'previsions', 'calendrier', 'guide', 'methode'];
let spyPiloting = false; // vrai pendant un défilement déclenché par le dock
let spyArmed = false;
function setDockActive(name) {
  $$('.dock-btn[data-nav]').forEach(b => b.classList.toggle('is-active', b.dataset.nav === name));
  try { history.replaceState(null, '', '#' + name); } catch { /* file:// */ }
}
function activateView(name) {
  if (!VIEW_IDS.includes(name)) name = 'dashboard';
  const target = document.getElementById('s-' + name);
  setDockActive(name);
  spyPiloting = true; // on pilote le scroll : le spy reprend la main une fois arrivé
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const disarm = () => { spyPiloting = false; };
  if ('onscrollend' in window) document.addEventListener('scrollend', disarm, { once: true, capture: true });
  setTimeout(disarm, 1300);
  $('#sidebar').classList.remove('is-open');
  $('#sidebarOverlay').classList.remove('is-on');
}
let spyTickPending = false;
function spyTick() {
  spyTickPending = false;
  if (spyPiloting) return;
  /* ligne de focus : ~35 % de la hauteur visible, sous la topbar */
  const focus = window.innerHeight * 0.35;
  let current = null;
  for (const s of $$('section[data-sec]')) {
    const top = s.getBoundingClientRect().top;
    if (top <= focus) current = s.dataset.sec;
    else break;
  }
  if (!current) current = 'dashboard';
  if (current !== (document.querySelector('.dock-btn.is-active') || {}).dataset?.nav) setDockActive(current);
}
function bindNav() {
  $$('[data-nav]').forEach(el => el.addEventListener('click', () => activateView(el.dataset.nav)));
  $('#btnMenu').addEventListener('click', () => { $('#sidebar').classList.add('is-open'); $('#sidebarOverlay').classList.add('is-on'); });
  $('#sidebarOverlay').addEventListener('click', () => { $('#sidebar').classList.remove('is-open'); $('#sidebarOverlay').classList.remove('is-on'); });
  window.addEventListener('hashchange', () => activateView(location.hash.replace('#', '')));
  /* Scroll-spy : la section qui couvre la ligne de focus allume son icône du dock */
  spyArmed = true;
  document.addEventListener('scroll', () => {
    if (!spyArmed || spyTickPending) return;
    spyTickPending = true;
    requestAnimationFrame(spyTick);
  }, { passive: true, capture: true });
  spyTick();
}

/* ─────────── Thèmes (Mer Azur par défaut, tous sombres) ─────────── */
const THEME_NAMES = { azur: 'Mer Azur', abyssal: 'Abyssal', clair: 'Jour Mer (clair)', nuit: 'Nuit Noire', phare: 'Phare Bleu', terre: 'Terre & Sel' };
const THEME_META = { azur: '#050E13', abyssal: '#050e1a', clair: '#dbe7ed', nuit: '#000000', phare: '#0a1220', terre: '#160f07' };
function bindTheme() {
  let t = 'azur';
  try { t = localStorage.getItem('gcl-theme') || 'azur'; } catch { /* privé */ }
  applyTheme(THEME_META[t] ? t : 'azur');
  $$('#themePicker .tp-btn').forEach(b => {
    b.addEventListener('click', () => applyTheme(b.dataset.themeSet));
  });
}
function applyTheme(t) {
  if (!THEME_META[t]) t = 'azur';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('gcl-theme', t); } catch { /* privé */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_META[t]);
  const nameEl = $('#tpName');
  if (nameEl) nameEl.textContent = THEME_NAMES[t];
  $$('#themePicker .tp-btn').forEach(b => b.classList.toggle('is-on', b.dataset.themeSet === t));
  // Les canvas (jauge, 24 h) lisent les couleurs au dessin → on redessine si les données sont là
  if (state.meteo) {
    try {
      const dm0 = dailyMap(), now0 = new Date();
      const sc0 = scoreFor(now0, dm0);
      if (sc0) { drawGauge(sc0.total); renderActivityChart(now0, sc0.periods, dm0[dayKey(now0)]); }
    } catch { /* vue pas encore prête */ }
  }
}
function bindUnits() {
  try {
    const w = localStorage.getItem('gcl-unit-wind'); if (w) state.units.wind = w;
    const t = localStorage.getItem('gcl-unit-temp'); if (t) state.units.temp = t;
  } catch { /* privé */ }
  const syncSeg = () => {
    $$('.seg-btn[data-unit-wind]').forEach(b => b.classList.toggle('is-active', b.dataset.unitWind === state.units.wind));
    $$('.seg-btn[data-unit-temp]').forEach(b => b.classList.toggle('is-active', b.dataset.unitTemp === state.units.temp));
  };
  syncSeg();
  $$('.seg-btn[data-unit-wind]').forEach(b => b.addEventListener('click', () => { state.units.wind = b.dataset.unitWind; try { localStorage.setItem('gcl-unit-wind', state.units.wind); } catch {} syncSeg(); refreshAll(false); }));
  $$('.seg-btn[data-unit-temp]').forEach(b => b.addEventListener('click', () => { state.units.temp = b.dataset.unitTemp; try { localStorage.setItem('gcl-unit-temp', state.units.temp); } catch {} syncSeg(); refreshAll(false); }));
}

/* ─────────── Espèce ciblée (Calamar · Loup · Dorade · Sar) ─────────── */
function bindSpecies() {
  try {
    const s = localStorage.getItem('gcl-species');
    if (s && SPECIES[s]) state.species = s;
  } catch { /* privé */ }
  syncSpecies();
  $$('.sp-btn[data-sp]').forEach(b => b.addEventListener('click', () => {
    state.species = SPECIES[b.dataset.sp] ? b.dataset.sp : 'calamar';
    try { localStorage.setItem('gcl-species', state.species); } catch { /* privé */ }
    syncSpecies();
    refreshAll(false);
  }));
}
function syncSpecies() {
  const sp = SP();
  $$('.sp-btn[data-sp]').forEach(b => b.classList.toggle('is-active', b.dataset.sp === state.species));
  const n = $('#spName'); if (n) n.textContent = sp.name;
  const k = $('#gaugeKicker'); if (k) k.textContent = `Indice ${sp.name}™`;
  const ic = $('#speciesIcon'); if (ic) ic.innerHTML = `<use href="#${sp.icon}"/>`;
}

/* ─────────── Orchestration des données ─────────── */
async function fetchJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function loadData(force = false) {
  if (!force) {
    const cached = cacheRead();
    if (cached && !cached.stale && cached.meteo && cached.marine) {
      state.meteo = cached.meteo; state.marine = cached.marine; state.online = true; state.lastUpdate = new Date(cached.ts);
      return;
    }
  }
  try {
    const [meteo, marine] = await Promise.all([fetchJSON(METEO_URL), fetchJSON(MARINE_URL)]);
    state.meteo = meteo; state.marine = marine; state.online = true; state.lastUpdate = new Date();
    cacheWrite(meteo, marine);
  } catch (err) {
    console.warn('[GCL] Hors ligne ou API injoignable :', err);
    const cached = cacheRead();
    if (cached && cached.meteo) {
      state.meteo = cached.meteo; state.marine = cached.marine ?? null; state.online = false; state.lastUpdate = new Date(cached.ts);
    } else {
      state.meteo = null; state.marine = null; state.online = false; state.lastUpdate = null;
    }
  }
}

function renderAll() {
  const dm = dailyMap();
  const now = new Date();
  // Horloge & entête
  renderClock();
  $('#topbarSub').textContent = `Tlemcen · Algérie · ${state.online ? 'données en direct' : 'données en cache (hors ligne)'}`;
  $('#lastUpdate').textContent = state.lastUpdate ? fmtTime(state.lastUpdate) : '—';
  $('#gaugeDateChip').textContent = now.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: CONFIG.tz });

  // Score du jour
  const todayISO = dayKey(now);
  const today = dm[todayISO];
  const score = scoreFor(now, dm);
  animateGauge(score.total);
  const rating = ratingOf(score.total);
  const pill = $('#ratingPill');
  pill.textContent = rating.label;
  pill.dataset.level = rating.level;
  renderFactors(score.parts);
  const bw = bestWindowFor(score.periods);
  $('#bestWindow').textContent = bw ? `${bw.start} → ${bw.end}` : '—';
  $('#bestWindowSub').textContent = bw ? `${bw.type === 'major' ? 'Majeure' : 'Mineure'} · ${bw.night} min de nuit · culmination ${fmtTime(bw.center)}` : 'Aucune période de nuit aujourd’hui';

  // Cartes
  renderMoonCard(now, today);
  renderMeteo(dm);
  renderMer();
  const solRating = Astro.solunarRating(now);
  renderSolunaire(now, score.periods, solRating);
  renderReco(now, score, dm);
  renderStormAlert(dm);
  renderActivityChart(now, score.periods, today);

  // Vues secondaires
  renderForecast(dm);
  renderDayDetail(dm);
  renderCalendar(dm);
}

async function refreshAll(force = true) {
  const btn = $('#btnRefresh');
  btn.classList.add('is-spinning');
  try {
    await loadData(force);
    renderAll();
  } finally {
    btn.classList.remove('is-spinning');
  }
}

/* ─────────── Démarrage ─────────── */
function init() {
  bindNav(); bindTheme(); bindUnits(); bindSpecies();
  bootSplash();
  renderSeasonBars(); renderFAQ(); renderMethod();
  $('#btnRefresh').addEventListener('click', () => refreshAll(true));
  $('#btnRefresh2').addEventListener('click', () => refreshAll(true));
  $('#btnPrint').addEventListener('click', () => window.print());
  $('#calPrev').addEventListener('click', () => { state.calCursor = new Date(state.calCursor.getFullYear(), state.calCursor.getMonth() - 1, 1); renderAll(); });
  $('#calNext').addEventListener('click', () => { state.calCursor = new Date(state.calCursor.getFullYear(), state.calCursor.getMonth() + 1, 1); renderAll(); });
  $('#calToday').addEventListener('click', () => { state.calCursor = new Date(); renderAll(); });
  window.addEventListener('resize', () => { /* redessiner le graphique */ const dm = dailyMap(); const now = new Date(); const today = dm[dayKey(now)]; const score = scoreFor(now, dm); renderActivityChart(now, score.periods, today); });
  setInterval(renderClock, 1000);
  activateView(location.hash.replace('#', '') || 'dashboard');
  refreshAll(false).then(() => { state.refreshTimer = setInterval(() => refreshAll(false), CONFIG.refreshMs); });
}
init();

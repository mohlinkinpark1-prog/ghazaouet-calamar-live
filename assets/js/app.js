/* ============================================================
   INDICE CALAMAR v3 — Application
   Données : Open-Meteo Forecast + Marine · Astronomie : Astro
   Calcul : GCLEngine (lune 40 · solunaire 25 · mer 25 · pression 10)
   Aucun facteur de saison dans le score.
   ============================================================ */
'use strict';

/* ─────────── Configuration ─────────── */
const CONFIG = {
  lat: 35.096, lon: -1.860,
  tz: 'Africa/Algiers',
  place: 'Port de Ghazaouet',
  refreshMs: 10 * 60 * 1000,
};
const METEO_URL = 'https://api.open-meteo.com/v1/forecast?latitude=35.096&longitude=-1.860'
  + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover'
  + '&hourly=pressure_msl,precipitation,weather_code'
  + '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,precipitation_sum,cloud_cover_mean'
  + '&forecast_days=16&timezone=Africa%2FAlgiers';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine?latitude=35.096&longitude=-1.860'
  + '&current=wave_height,wave_direction,wave_period,swell_wave_height,sea_surface_temperature'
  + '&hourly=sea_surface_temperature&daily=wave_height_max&forecast_days=8&timezone=Africa%2FAlgiers';

const MONTH_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTH_SHORT = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
/* Informations de saison — affichées, JAMAIS notées (Rocha & Guerra 1996 ; FAO). */
const SEASON_INFO = [
  'Janvier : gros sujets qui remontent vers la côte — période connue, non notée.',
  'Février : migration côtière et recrutement — période connue, non notée.',
  'Mars : fin de migration — période connue, non notée.',
  'Avril : pontes échelonnées — période connue, non notée.',
  'Mai : reproduction — période connue, non notée.',
  'Juin : pontes d’été — période connue, non notée.',
  'Juillet : petites tailles, recrutement — période connue, non notée.',
  'Août : creux estival — période connue, non notée.',
  'Septembre : début de retour automnal — période connue, non notée.',
  'Octobre : retour des grands sujets — période connue, non notée.',
  'Novembre : automne productif — période connue, non notée.',
  'Décembre : fin d’année recherchée — période connue, non notée.',
];
const WMO = {
  0: ['Ciel dégagé', 'i-sun'], 1: ['Plutôt dégagé', 'i-sun'], 2: ['Partiellement nuageux', 'i-cloud'], 3: ['Couvert', 'i-cloud'],
  45: ['Brouillard', 'i-cloud'], 48: ['Brouillard givrant', 'i-cloud'],
  51: ['Bruine légère', 'i-rain'], 53: ['Bruine', 'i-rain'], 55: ['Bruine forte', 'i-rain'],
  61: ['Pluie faible', 'i-rain'], 63: ['Pluie', 'i-rain'], 65: ['Forte pluie', 'i-rain'],
  80: ['Averses', 'i-rain'], 81: ['Averses', 'i-rain'], 82: ['Averses violentes', 'i-rain'],
  95: ['Orage', 'i-alert'], 96: ['Orage + grêle', 'i-alert'], 99: ['Orage violent', 'i-alert'],
};
const THEME_NAMES = { azur: 'Mer Azur', abyssal: 'Abyssal', clair: 'Jour Mer (clair)', nuit: 'Nuit Noire', phare: 'Phare Bleu', terre: 'Terre & Sel' };
const THEME_META = { azur: '#050E13', abyssal: '#050e1a', clair: '#dbe7ed', nuit: '#000000', phare: '#0a1220', terre: '#160f07' };

const state = {
  meteo: null, marine: null,
  units: { wind: 'kmh', temp: 'c' },
  lastUpdate: null,
  selectedDayISO: null,
  calCursor: new Date(),
  refreshTimer: null,
};

/* ─────────── Utilitaires ─────────── */
const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad2 = n => String(n).padStart(2, '0');
const parseLocalISO = s => new Date(s + ':00+01:00');
const dayKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtTime = d => d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: CONFIG.tz }) : '—';
const fmtDateLong = d => d ? d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: CONFIG.tz }) : '—';
const nearestMinutes = d => d.getHours() * 60 + d.getMinutes();
const isPrimeWindow = center => { const h = center.getHours(); return h >= 20 || h < 2; };
const wmoInfo = code => WMO[code] || ['Conditions diverses', 'i-cloud'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function markIcons() {
  $$('svg.ic:not([aria-hidden])').forEach(el => el.setAttribute('aria-hidden', 'true'));
}
function fmtWind(kmh) {
  if (kmh == null) return '—';
  return state.units.wind === 'kts' ? `${Math.round(kmh / 1.852)} nds` : `${Math.round(kmh)} km/h`;
}
function fmtTemp(c) {
  if (c == null) return '—';
  return state.units.temp === 'f' ? `${Math.round(c * 9 / 5 + 32)} °F` : `${Math.round(c)} °C`;
}

/* ─────────── Splash 3 s ─────────── */
function bootSplash() {
  const s = $('#splash');
  if (!s) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { s.remove(); return; }
  document.body.classList.add('splash-on');
  setTimeout(() => {
    s.classList.add('is-done');
    document.body.classList.remove('splash-on');
    setTimeout(() => s.remove(), 600);
  }, 3000);
}

/* ─────────── Thèmes, unités, feuille ─────────── */
function applyTheme(t) {
  if (!THEME_META[t]) t = 'azur';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('gcl-theme', t); } catch { /* privé */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_META[t]);
  const n = $('#tpName'); if (n) n.textContent = THEME_NAMES[t];
  $$('#themePicker .tp-btn').forEach(b => b.classList.toggle('is-on', b.dataset.themeSet === t));
  if (state.meteo) { try { renderAll(); } catch { /* pas prêt */ } }
}
function bindSettings() {
  let t = 'azur';
  try { t = localStorage.getItem('gcl-theme') || 'azur'; } catch { /* privé */ }
  applyTheme(t);
  $$('#themePicker .tp-btn').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.themeSet)));
  try {
    const w = localStorage.getItem('gcl-unit-wind'); if (w) state.units.wind = w;
    const c = localStorage.getItem('gcl-unit-temp'); if (c) state.units.temp = c;
  } catch { /* privé */ }
  syncUnits();
  $$('.seg-btn[data-unit-wind]').forEach(b => b.addEventListener('click', () => {
    state.units.wind = b.dataset.unitWind;
    try { localStorage.setItem('gcl-unit-wind', state.units.wind); } catch { /* privé */ }
    syncUnits(); renderAll();
  }));
  $$('.seg-btn[data-unit-temp]').forEach(b => b.addEventListener('click', () => {
    state.units.temp = b.dataset.unitTemp;
    try { localStorage.setItem('gcl-unit-temp', state.units.temp); } catch { /* privé */ }
    syncUnits(); renderAll();
  }));
  const sheet = $('#sidebar'), overlay = $('#sidebarOverlay');
  const open = () => { sheet.classList.add('is-open'); overlay.classList.add('is-on'); };
  const close = () => { sheet.classList.remove('is-open'); overlay.classList.remove('is-on'); };
  $('#btnMenu').addEventListener('click', open);
  $('#btnClose').addEventListener('click', close);
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  $('#btnRefresh').addEventListener('click', () => refreshAll(true));
  $('#btnRefresh2').addEventListener('click', () => { close(); refreshAll(true); });
  $('#btnPrint').addEventListener('click', () => window.print());
}
function syncUnits() {
  $$('.seg-btn[data-unit-wind]').forEach(b => b.classList.toggle('is-active', b.dataset.unitWind === state.units.wind));
  $$('.seg-btn[data-unit-temp]').forEach(b => b.classList.toggle('is-active', b.dataset.unitTemp === state.units.temp));
}

/* ─────────── Navigation story ─────────── */
const VIEW_IDS = ['dashboard', 'previsions', 'calendrier', 'guide', 'methode'];
let spyPiloting = false;
function setDockActive(name) {
  $$('.dock-btn[data-nav]').forEach(b => b.classList.toggle('is-active', b.dataset.nav === name));
  try { history.replaceState(null, '', '#' + name); } catch { /* file:// */ }
}
function activateView(name) {
  if (!VIEW_IDS.includes(name)) name = 'dashboard';
  setDockActive(name);
  spyPiloting = true;
  const target = document.getElementById('s-' + name);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const disarm = () => { spyPiloting = false; };
  if ('onscrollend' in window) document.addEventListener('scrollend', disarm, { once: true, capture: true });
  setTimeout(disarm, 1300);
}
function spyTick() {
  if (spyPiloting) return;
  const line = window.scrollY + window.innerHeight * 0.38;
  let active = VIEW_IDS[0];
  for (const id of VIEW_IDS) {
    const el = document.getElementById('s-' + id);
    if (el && el.offsetTop <= line) active = id;
  }
  setDockActive(active);
}
function bindNav() {
  $$('.dock-btn[data-nav]').forEach(b => b.addEventListener('click', () => activateView(b.dataset.nav)));
  window.addEventListener('scroll', () => requestAnimationFrame(spyTick), { passive: true });
  const hash = location.hash.replace('#', '');
  if (VIEW_IDS.includes(hash)) setTimeout(() => activateView(hash), 1200);
}

/* ─────────── Données Open-Meteo ─────────── */
async function fetchJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function loadData(force = false) {
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem('gcl-cache-v3') || 'null');
      if (cached && Date.now() - cached.ts < CONFIG.refreshMs && cached.meteo && cached.marine) {
        state.meteo = cached.meteo; state.marine = cached.marine;
        state.lastUpdate = cached.ts; return;
      }
    } catch { /* cache illisible */ }
  }
  const [meteo, marine] = await Promise.all([fetchJSON(METEO_URL), fetchJSON(MARINE_URL)]);
  if (!meteo?.current || !marine?.current) throw new Error('Données incomplètes');
  state.meteo = meteo; state.marine = marine; state.lastUpdate = Date.now();
  try { localStorage.setItem('gcl-cache-v3', JSON.stringify({ ts: state.lastUpdate, meteo, marine })); } catch { /* quota */ }
}
async function refreshAll(force = true) {
  const btn = $('#btnRefresh');
  btn.classList.add('is-spinning');
  try { await loadData(force); renderAll(); }
  catch (e) { console.warn('Données indisponibles', e); }
  finally { btn.classList.remove('is-spinning'); }
}
function dailyMap() {
  const map = {};
  const d = state.meteo?.daily;
  if (d?.time) d.time.forEach((t, i) => {
    map[t] = {
      tMax: d.temperature_2m_max?.[i], tMin: d.temperature_2m_min?.[i],
      code: d.weather_code?.[i], sunrise: parseLocalISO(d.sunrise[i]), sunset: parseLocalISO(d.sunset[i]),
      windMax: d.wind_speed_10m_max?.[i], gustMax: d.wind_gusts_10m_max?.[i],
      windDir: d.wind_direction_10m_dominant?.[i], precip: d.precipitation_sum?.[i],
      cloud: d.cloud_cover_mean?.[i],
      waveMax: state.marine?.daily?.wave_height_max?.[state.marine.daily.time.indexOf(t)] ?? null,
    };
  });
  return map;
}
function pressureTrendNow() {
  const h = state.meteo?.hourly;
  if (!h?.time?.length) return 0;
  const now = Date.now();
  let idx = 0, best = Infinity;
  h.time.forEach((t, i) => {
    const diff = Math.abs(parseLocalISO(t).getTime() - now);
    if (diff < best) { best = diff; idx = i; }
  });
  const nowP = h.pressure_msl?.[idx], before = h.pressure_msl?.[Math.max(0, idx - 3)];
  return (nowP != null && before != null) ? nowP - before : 0;
}
function solunarForDay(date, sunrise, sunset) {
  const periods = Astro.solunarPeriods(date, CONFIG.lat, CONFIG.lon);
  let srMin = sunrise ? nearestMinutes(sunrise) : 420;
  let ssMin = sunset ? nearestMinutes(sunset) : 1140;
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
  const sr = sunrise ? sunrise.getTime() : dayStart.getTime() + 7 * 3600e3;
  const ss = sunset ? sunset.getTime() : dayStart.getTime() + 19 * 3600e3;
  const overlap = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));
  return periods.filter(p => p.end > dayStart && p.start < dayEnd).map(p => {
    const a = Math.max(p.start.getTime(), dayStart.getTime());
    const b = Math.min(p.end.getTime(), dayEnd.getTime());
    // Nuit = 00:00→lever + coucher→24:00 (et non toute la période).
    const night = overlap(a, b, dayStart.getTime(), sr) + overlap(a, b, ss, dayEnd.getTime());
    return { ...p, nightMin: Math.round(night / 60000) };
  });
}

/* ─────────── Indice (4 facteurs, sans saison) ─────────── */
function scoreFor(date, dm) {
  const day = dm?.[dayKey(date)] || null;
  const ph = Astro.phaseInfo(date);
  const moon = GCLEngine.moonScore(ph.elong * Math.PI / 180);
  const periods = solunarForDay(date, day?.sunrise, day?.sunset);
  const sol = GCLEngine.solunarPoints(periods, isPrimeWindow);
  const wave = day?.waveMax ?? state.marine?.current?.wave_height ?? null;
  const sst = state.marine?.current?.sea_surface_temperature ?? null;
  const meteo = GCLEngine.seaPoints(wave, sst, day?.windMax);
  const pres = dayKey(date) === dayKey(new Date())
    ? GCLEngine.pressurePoints(state.meteo?.current?.pressure_msl ?? null, pressureTrendNow())
    : GCLEngine.pressurePoints(null, 0);
  const parts = { moon: Math.round(moon), sol: Math.round(sol), meteo: Math.round(meteo), pres: Math.round(pres) };
  return { total: GCLEngine.totalScore(parts), parts, phase: ph, periods, day };
}
function bestWindowFor(periods) {
  const ranked = periods.filter(p => p.type === 'major' && p.nightMin > 0).sort((a, b) => b.nightMin - a.nightMin);
  if (!ranked.length) return null;
  const p = ranked[0];
  return { start: fmtTime(p.start), end: fmtTime(p.end), night: p.nightMin, type: p.type, center: p.center };
}

/* ─────────── Jauge ─────────── */
let gaugeAnim = null;
function renderGauge(value) {
  const cv = $('#gaugeCanvas');
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1;
  const W = 300, H = 212;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = '100%'; cv.style.height = 'auto';
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const cx = W / 2, cy = H * 0.62, r = 92;
  const css = getComputedStyle(document.documentElement);
  const col = n => css.getPropertyValue(n).trim() || '#48e3c6';
  const bands = [col('--band-low'), col('--band-mid'), col('--band-good'), col('--band-great'), col('--band-epic')];
  const A0 = Math.PI * 0.78, A1 = Math.PI * 2.22;
  const draw = v => {
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 13; ctx.lineCap = 'round';
    const grad = ctx.createLinearGradient(20, 40, W - 20, H);
    bands.forEach((c, i) => grad.addColorStop(i / 4, c));
    ctx.strokeStyle = 'rgba(128,150,160,.16)';
    ctx.beginPath(); ctx.arc(cx, cy, r, A0, A1); ctx.stroke();
    ctx.strokeStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, r, A0, A0 + (A1 - A0) * clamp(v / 100, 0, 1)); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,190,200,.35)'; ctx.lineWidth = 1.5;
    for (let i = 0; i <= 10; i++) {
      const a = A0 + (A1 - A0) * (i / 10);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 11), cy + Math.sin(a) * (r - 11));
      ctx.lineTo(cx + Math.cos(a) * (r - 19), cy + Math.sin(a) * (r - 19));
      ctx.stroke();
    }
    const a = A0 + (A1 - A0) * clamp(v / 100, 0, 1);
    ctx.strokeStyle = col('--strong'); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r - 26), cy + Math.sin(a) * (r - 26)); ctx.stroke();
    ctx.fillStyle = col('--gold'); ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
  };
  if (gaugeAnim) cancelAnimationFrame(gaugeAnim);
  let start = null;
  const frame = t => {
    if (start === null) start = t;
    const k = clamp((t - start) / 600, 0, 1);
    draw(value * (1 - Math.pow(1 - k, 3)));
    $('#gaugeValue').textContent = Math.round(value * (1 - Math.pow(1 - k, 3)));
    if (k < 1) gaugeAnim = requestAnimationFrame(frame);
  };
  gaugeAnim = requestAnimationFrame(frame);
}

/* ─────────── Lune (canvas) ─────────── */
function drawMoon(date) {
  const cv = $('#moonCanvas');
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1, S = 120;
  cv.width = S * dpr; cv.height = S * dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  const glow = css.getPropertyValue('--aqua').trim() || '#48e3c6';
  const cx = S / 2, cy = S / 2, r = 48;
  const ph = Astro.phaseInfo(date);
  ctx.clearRect(0, 0, S, S);
  const g = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.35);
  g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(160,190,200,.16)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  const k = 1 - 2 * ph.illum;
  ctx.fillStyle = '#f3f0e2';
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
  if (ph.waxing) ctx.ellipse(cx, cy, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
  else ctx.ellipse(cx, cy, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, k < 0);
  ctx.fill();
  ctx.strokeStyle = glow; ctx.globalAlpha = .55; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
}

/* ─────────── Courbe d'activité ─────────── */
function renderActivity(now, periods, today) {
  const cv = $('#activityChart');
  if (!cv) return;
  const wrap = cv.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(300, wrap.clientWidth - 32), H = 180;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = '100%'; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);
  const sr = today?.sunrise ? nearestMinutes(today.sunrise) : 440;
  const ss = today?.sunset ? nearestMinutes(today.sunset) : 1140;
  const xOf = m => 28 + (m / 1440) * (W - 44);
  const yOf = v => H - 28 - v * (H - 52);
  ctx.fillStyle = 'rgba(110,130,255,.09)';
  ctx.fillRect(xOf(0), 8, xOf(sr) - xOf(0), H - 34);
  ctx.fillRect(xOf(ss), 8, xOf(1440) - xOf(ss), H - 34);
  ctx.strokeStyle = 'rgba(150,180,190,.18)'; ctx.lineWidth = 1;
  for (let h = 0; h <= 24; h += 4) {
    const x = xOf(h * 60);
    ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x, H - 24); ctx.stroke();
  }
  const valueAt = minute => {
    let v = .12;
    for (const p of periods) {
      const c = nearestMinutes(p.center);
      v += (p.type === 'major' ? .55 : .25) * Math.exp(-Math.pow(minute - c, 2) / (2 * 70 * 70));
    }
    if (minute >= sr && minute <= ss) v *= .45;
    return clamp(v, 0, 1);
  };
  const grad = ctx.createLinearGradient(0, 14, 0, H - 24);
  grad.addColorStop(0, 'rgba(72,227,198,.55)'); grad.addColorStop(1, 'rgba(72,227,198,0)');
  ctx.beginPath(); ctx.moveTo(xOf(0), yOf(0));
  for (let m = 0; m <= 1440; m += 10) ctx.lineTo(xOf(m), yOf(valueAt(m)));
  ctx.lineTo(xOf(1440), yOf(0)); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath();
  for (let m = 0; m <= 1440; m += 10) {
    const x = xOf(m), y = yOf(valueAt(m));
    if (m === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  const css = getComputedStyle(document.documentElement);
  ctx.strokeStyle = css.getPropertyValue('--aqua').trim() || '#48e3c6'; ctx.lineWidth = 2; ctx.stroke();
  const nowMin = nearestMinutes(now);
  ctx.strokeStyle = css.getPropertyValue('--gold').trim() || '#ffb629'; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(xOf(nowMin), 12); ctx.lineTo(xOf(nowMin), H - 22); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = css.getPropertyValue('--muted-2').trim() || '#7e9ba5';
  ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'center';
  for (let h = 0; h <= 24; h += 6) ctx.fillText(String(h).padStart(2, '0') + 'h', xOf(h * 60), H - 8);
}

/* ─────────── Rendus de l'accueil ─────────── */
function renderFactors(parts) {
  const max = { moon: 40, sol: 25, meteo: 25, pres: 10 };
  const labels = { moon: 'Lune', sol: 'Solunaire', meteo: 'Mer', pres: 'Pression' };
  $('#factorList').innerHTML = Object.keys(max).map(k => `
    <li class="factor"><small>${labels[k]}</small>
      <div class="factor-track"><div class="factor-fill" style="width:${clamp(parts[k] / max[k] * 100, 0, 100)}%"></div></div>
      <span class="factor-val">${parts[k]}/${max[k]}</span></li>`).join('');
}
function renderSea() {
  const cur = state.meteo?.current, m = state.marine?.current;
  if (!m) return;
  const wave = m.wave_height;
  $('#waveHeight').textContent = wave != null ? wave.toFixed(2) : '—';
  $('#waveBar').style.left = `${clamp((wave ?? 0) / 1.5, 0, 1) * 100}%`;
  $('#seaDetail').innerHTML = [
    `Direction ${m.wave_direction != null ? Math.round(m.wave_direction) + '°' : '—'}`,
    `Période ${m.wave_period != null ? m.wave_period.toFixed(1) + ' s' : '—'}`,
    `Houle ${m.swell_wave_height != null ? m.swell_wave_height.toFixed(2) + ' m' : '—'}`,
  ].map(s => `<span>${s}</span>`).join('');
  const sst = m.sea_surface_temperature;
  $('#sstValue').textContent = sst != null ? sst.toFixed(1) : '—';
  const verdict = sst == null ? '—' : sst < 13 ? 'Eau froide' : sst <= 21 ? 'Optimum calamar' : 'Un peu chaude';
  const vEl = $('#sstVerdict');
  vEl.textContent = verdict;
  vEl.className = 'chip ' + (sst != null && sst >= 13 && sst <= 21 ? 'chip-sea' : 'chip-ghost');
  $('#seaNote').textContent = wave == null ? 'Données marines en cours…'
    : wave < 0.3 ? 'Mer belle à légère — conditions idéales pour la turlutte comme pour le lamparo.'
      : wave < 0.6 ? 'Petite agitation — agréable en dérive, lamparo déconseillé si le vent forcit.'
        : 'Houle significative — privilégiez la digue abritée ou reportez la sortie en barque.';
  if (cur) {
    const info = wmoInfo(cur.weather_code);
    $('#wxDesc').textContent = info[0];
    $('#wxIcon use').setAttribute('href', '#' + info[1]);
    $('#wxTemp').textContent = state.units.temp === 'f' ? Math.round(cur.temperature_2m * 9 / 5 + 32) : Math.round(cur.temperature_2m);
    $('#wxTemp').nextElementSibling.textContent = state.units.temp === 'f' ? '°F' : '°C';
    $('#wxFeels').textContent = 'Ressenti ' + fmtTemp(cur.apparent_temperature);
    $('#wxGrid').innerHTML = [
      ['Vent', fmtWind(cur.wind_speed_10m) + ' ' + (cur.wind_direction_10m != null ? Math.round(cur.wind_direction_10m) + '°' : '')],
      ['Rafales', fmtWind(cur.wind_gusts_10m)],
      ['Humidité', cur.relative_humidity_2m != null ? cur.relative_humidity_2m + ' %' : '—'],
      ['Pression', cur.pressure_msl != null ? Math.round(cur.pressure_msl) + ' hPa' : '—'],
      ['Nuages', cur.cloud_cover != null ? cur.cloud_cover + ' %' : '—'],
      ['Précip. 24 h', (state.meteo.daily?.precipitation_sum?.[0] ?? 0) + ' mm'],
    ].map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('');
  }
}
function renderReco(score) {
  const now = new Date();
  const ph = score.phase;
  const cur = state.meteo?.current, m = state.marine?.current;
  const out = [];
  const bw = bestWindowFor(score.periods);
  if (bw) out.push({ cls: 'reco-gold', icon: 'i-clock', html: `<strong>Fenêtre à retenir :</strong> ${bw.start} → ${bw.end} (${bw.night} min de nuit effective).` });
  else out.push({ cls: '', icon: 'i-clock', html: '<strong>Pas de majeure nocturne</strong> — tentez l’aube ou reportez-vous au calendrier.' });
  const cosAbs = Math.abs(Math.cos(ph.elong * Math.PI / 180));
  if (cosAbs > 0.85) out.push({ cls: 'reco-gold', icon: 'i-moon', html: `<strong>${ph.name}</strong> — forte attraction solunaire ; coefficient maximal, les calamars chassent activement.` });
  else if (cosAbs > 0.5) out.push({ cls: '', icon: 'i-moon', html: `<strong>${ph.name}</strong> (${Math.round(ph.illum * 100)} % éclairée) — activité intermédiaire.` });
  else out.push({ cls: '', icon: 'i-moon', html: `<strong>${ph.name}</strong> (quadrature) — activité réduite ; misez sur les heures de culmination.` });
  if (cur && cur.weather_code >= 95) out.push({ cls: 'reco-warn', icon: 'i-alert', html: '<strong>Orage en cours</strong> — n’allez pas en mer. La pêche attendra.' });
  else if (m?.wave_height != null && m.wave_height >= 0.6) out.push({ cls: 'reco-warn', icon: 'i-waves', html: `<strong>Houle ${m.wave_height.toFixed(2)} m</strong> — préférez la digue abritée ou reportez la sortie en barque.` });
  else if (cur?.wind_speed_10m > 30) out.push({ cls: 'reco-warn', icon: 'i-wind', html: `<strong>Vent ${fmtWind(cur.wind_speed_10m)}</strong> — dérive difficile (Baléares 2012 : vent fort = CPUE faibles).` });
  if (score.parts.meteo >= 18) out.push({ cls: 'reco-gold', icon: 'i-thermo', html: '<strong>Mer favorable</strong> — houle faible et eau fraîche : combo associé aux meilleures prises (étude Baléares).' });
  if (ph.illum < 0.35) out.push({ cls: '', icon: 'i-sun', html: '<strong>Nuit noire</strong> — lamparo décisif (nouvelle lune) ; LED bleue > blanche (Indonésie 2021).' });
  $('#recoList').innerHTML = out.slice(0, 5).map(r => `<li class="reco-item ${r.cls}"><svg class="ic"><use href="#${r.icon}"/></svg><span>${r.html}</span></li>`).join('');
}
function renderStorm(dm) {
  const codes = [];
  if (state.meteo?.current) codes.push(state.meteo.current.weather_code);
  Object.values(dm).forEach(d => codes.push(d.code));
  const gust = state.meteo?.current?.wind_gusts_10m;
  const storm = codes.some(c => c >= 95);
  const strip = $('#stormAlert');
  if (storm) {
    strip.classList.remove('is-hidden');
    $('#stormAlertText').textContent = 'Alerte orage — mer dangereuse. Restez à quai et sécurisez le matériel.';
  } else if (gust != null && gust > 60) {
    strip.classList.remove('is-hidden');
    $('#stormAlertText').textContent = `Rafales ${fmtWind(gust)} — navigation délicate. Évitez la digue exposée nord-ouest.`;
  } else strip.classList.add('is-hidden');
}

/* ─────────── Prévisions / fiche du jour ─────────── */
function renderForecast(dm) {
  const keys = Object.keys(dm).slice(0, 16);
  const todayKey = dayKey(new Date());
  $('#forecastStrip').innerHTML = keys.map(k => {
    const d = fromKey(k), sc = scoreFor(d, dm), r = GCLEngine.ratingOf(sc.total);
    const info = wmoInfo(dm[k].code);
    const moon = Astro.phaseInfo(d);
    return `<button class="f-card ${k === todayKey ? 'is-today' : ''} ${k === state.selectedDayISO ? 'is-selected' : ''}" data-day="${k}">
      <span class="f-day">${k === todayKey ? 'AUJ.' : d.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: CONFIG.tz }).replace('.', '').toUpperCase()}</span>
      <span class="f-score">${sc.total}</span><span class="f-tag">${r.label}</span>
      <div class="f-bar"><i style="width:${sc.total}%;background:var(--band-${r.level})"></i></div>
      <div class="f-moon-row"><svg class="ic"><use href="#${info[1]}"/></svg><span>${Math.round(moon.illum * 100)} %</span></div>
    </button>`;
  }).join('');
  $$('.f-card[data-day]').forEach(b => b.addEventListener('click', () => {
    state.selectedDayISO = b.dataset.day; renderForecast(dm); renderDayDetail(dm);
  }));
}
function renderDayDetail(dm) {
  const key = state.selectedDayISO || dayKey(new Date());
  const d = fromKey(key), day = dm[key];
  const box = $('#dayDetail');
  if (!day) { box.innerHTML = '<h3>—</h3><p class="note">Données indisponibles.</p>'; return; }
  const sc = scoreFor(d, dm), bw = bestWindowFor(sc.periods);
  box.innerHTML = `<h3>${esc(fmtDateLong(d))}</h3>
    <div class="dd-block">
      <span>Indice <strong>${sc.total}/100</strong> — ${GCLEngine.ratingOf(sc.total).label}</span>
      <span>Météo : ${wmoInfo(day.code)[0]} · ${fmtTemp(day.tMax)} / ${fmtTemp(day.tMin)} · vent ${fmtWind(day.windMax)}</span>
      <span>Lune : ${sc.phase.name} · ${Math.round(sc.phase.illum * 100)} % éclairée</span>
      ${bw ? `<span>Fenêtre : ${bw.start} → ${bw.end} (${bw.night} min de nuit)</span>` : '<span>Pas de fenêtre majeure nocturne.</span>'}
    </div>
    <div class="dd-actions"><button class="btn-ghost" id="ddToday">Revenir à aujourd’hui</button></div>`;
  const btn = $('#ddToday');
  if (btn) btn.addEventListener('click', () => { state.selectedDayISO = dayKey(new Date()); renderDayDetail(dm); });
}

/* ─────────── Lune / calendrier ─────────── */
function renderMoon(now, score) {
  const ph = score.phase;
  drawMoon(now);
  $('#moonPhaseName').textContent = ph.name;
  $('#moonDate').textContent = esc(fmtDateLong(now));
  $('#moonIllum').textContent = Math.round(ph.illum * 100);
  $('#moonAge').textContent = ph.age.toFixed(1) + ' j';
  $('#moonElong').textContent = Math.round(ph.elong) + '°';
  const nx = Astro.nextSyzygy(now);
  $('#moonNext').textContent = `Prochaine ${nx.label.toLowerCase()} dans ${nx.days.toFixed(1)} j.`;
  const md = Astro.moonDay(now, CONFIG.lat, CONFIG.lon);
  const sd = Astro.sunDay(now, CONFIG.lat, CONFIG.lon);
  const rise = md.events.find(e => e.dir === 'rise'), set = md.events.find(e => e.dir === 'set');
  const transit = md.maxAlt;
  $('#moonRise').textContent = fmtTime(rise?.time);
  $('#moonSet').textContent = fmtTime(set?.time);
  $('#moonTransit').textContent = fmtTime(transit);
  $('#solunarRating').textContent = Astro.solunarRating(now) + ' %';
  $('#seasonBanner').textContent = SEASON_INFO[now.getMonth()] + ' Calcul : lune 40 · solunaire 25 · mer 25 · pression 10.';
}
function renderCalendar(dm) {
  const cursor = state.calCursor;
  const year = cursor.getFullYear(), month = cursor.getMonth();
  $('#calMonthTitle').textContent = MONTH_FR[month] + ' ' + year;
  const grid = $('#calGrid');
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysIn = new Date(year, month + 1, 0).getDate();
  const today = dayKey(new Date());
  let html = '';
  for (let i = 0; i < offset; i++) html += '<div class="cal-cell is-out"></div>';
  const scores = [];
  for (let day = 1; day <= daysIn; day++) {
    const d = new Date(year, month, day), k = dayKey(d);
    const sc = scoreFor(d, dm);
    if (dm[k]) scores.push({ day, total: sc.total });
    html += `<div class="cal-cell ${k === today ? 'is-today' : ''}" data-level="${GCLEngine.bandOf(sc.total)}" title="${k} : ${sc.total}/100">
      <span class="cal-daynum">${day}</span><span class="cal-score">${sc.total}</span></div>`;
  }
  grid.innerHTML = html;
  const top = scores.sort((a, b) => b.total - a.total).slice(0, 5);
  $('#topDaysList').innerHTML = top.length ? top.map(t => `<li><span>${t.day} ${MONTH_SHORT[month]}</span><b>${t.total}</b></li>`).join('') : '<li>—</li>';
  const sz = [];
  for (let day = 1; day <= daysIn; day++) {
    const nx = Astro.nextSyzygy(new Date(year, month, day, 12));
    if (nx.time && nx.time.getMonth() === month && nx.days <= 16) sz.push({ day, label: nx.label });
  }
  $('#syzygyList').innerHTML = sz.length ? sz.slice(0, 4).map(s => `<li><span>${s.day} ${MONTH_SHORT[month]}</span><b>${esc(s.label)}</b></li>`).join('') : '<li>—</li>';
}
function renderSeasonBars() {
  const SEASON = [17, 18.5, 16, 12.5, 9.5, 8, 11, 13, 18, 20, 20, 18.5]; // information seulement
  const max = 20;
  const top = Math.max(...SEASON);
  $('#seasonBars').innerHTML = SEASON.map((v, i) => `
    <div class="season-row ${v === top ? 'is-top' : ''}"><span>${MONTH_SHORT[i]}</span>
      <div class="season-track"><div class="season-fill" style="width:${v / max * 100}%"></div></div>
      <b>${Math.round(v / max * 100)}</b></div>`).join('');
}

/* ─────────── FAQ / méthode (statiques, textes v3) ─────────── */
const FAQ = [
  { q: 'Pourquoi la saison ne compte plus dans l’indice ?', a: 'Parce qu’elle est connue : migration jan–fév, pontes échelonnées, recrutement. Elle sert de contexte (bandeau et calendrier mensuel) mais elle n’est plus convertie en points. L’indice mesure les conditions du moment : lune 40, solunaire 25, mer 25, pression 10.' },
  { q: 'Sur quoi repose le calcul ?', a: 'Sur trois études publiées sur le calamar : Baléares 2012 (eau fraîche, vent faible, houle faible, basse pression, syzygie), Égée 2011 (turluttes rouges, pleine lune) et Indonésie 2021 (LED bleue, 3e quartier). Les études mesurent le sens et la significativité des effets ; la répartition exacte des 100 points est un choix de conception documenté.' },
  { q: 'Quelles heures privilégier ?', a: 'Le créneau du coucher du soleil jusqu’à ~3 h après la nuit tombe (fenêtre optimale affichée). Deuxième créneau : 02 h – 04 h. En journée, le calamar redescend. Les majeures solunaires recouvrant la nuit sont mises en avant — avec la réserve d’honnêteté du paragraphe suivant.' },
  { q: 'Le solunaire est-il scientifique ?', a: 'Non. L’hypothèse de Knight (1926) n’a jamais été validée en général. Elle est conservée ici comme descripteur horaire et dans le score (25 pts) par choix explicite ; l’effet lunaire, lui, est démontré chez le calamar par les études 01–03.' },
  { q: 'Quelle eau et quelle houle ?', a: 'L’étude des Baléares associe les meilleures captures à une eau fraîche (≤16 °C = 10 pts), une houle < 0,3 m (10 pts) et un vent ≤30 km/h. Au-delà, le score mer décroît (vent >30 km/h : −4 pts).' },
  { q: 'Faut-il un bateau ?', a: 'Non : la digue et la jetée ouest fonctionnent sous les lampes du port par nuit calme. La barque ouvre le large (30–80 m) et les chasses. Gilet, téléphone chargé, quelqu’un prévenu — jamais seul de nuit.' },
  { q: 'Quelle réglementation ?', a: 'Pêche récréative encadrée en Algérie : tailles minimales, repos biologique, zones classées. Renseignez-vous auprès de la Direction de la Pêche et de l’Aquaculture de la wilaya de Tlemcen.' },
];
function renderFAQ() {
  $('#faqList').innerHTML = FAQ.map((f, i) => `
    <div class="faq-item ${i === 0 ? 'is-open' : ''}">
      <button class="faq-q" aria-expanded="${i === 0}"><span>${esc(f.q)}</span><svg class="ic"><use href="#i-squid"/></svg></button>
      <div class="faq-a"><div class="faq-a-inner">${f.a}</div></div>
    </div>`).join('');
  $$('.faq-q').forEach(btn => btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    item.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', item.classList.contains('is-open'));
  }));
}
const METHOD = [
  { h: 'Lune — 40 points', p: 'Proximité de la syzygie (nouvelle OU pleine lune) : 40 × (0,30 + 0,70 × |cos élongation|^1,8), plancher à 12 pts. Effet lunaire démontré chez le calamar : Égée 2011 (p<0.01), Indonésie 2021 (p<0.05), Baléares 2012. Nouvelle lune = lamparo ; pleine lune = turlutte sans lampe ; l’indice les traite à égalité.', w: '40 pts' },
  { h: 'Périodes solunaires — 25 points', p: 'Majeure = min(8, minutes de nuit / 15), mineure = min(2, /30), bonus +5 si une majeure culmine entre 20 h et 02 h ; plafond 25. Hypothèse de Knight (1926) non validée : conservée ici par choix, comme descripteur horaire — pas comme preuve.', w: '25 pts' },
  { h: 'Mer — 25 points', p: 'Houle ≤10 pts (null 7 · <0,3 m 10 · <0,6 m 8 · <1 m 6 · <1,5 m 3 · ≥1,5 m 0) + eau ≤10 pts (null 6 · <12 °C 4 · ≤16 °C 10 · ≤19 °C 8 · ≤21 °C 6 · >21 °C 2). Vent >30 km/h : −4 pts. Paliers transcrits de Cabanellas-Reboredo 2012 (Baléares).', w: '25 pts' },
  { h: 'Pression — 10 points', p: 'Baisse nette sur 3 h (< −0,7 hPa) = 10 pts ; hausse nette = 5 ; donnée manquante = 6 ; basse stable ≤1012 hPa = 9 ; neutre ≤1018 = 6 ; haute = 5. La basse pression est associée à de meilleures CPUE dans l’étude des Baléares.', w: '10 pts' },
];
function renderMethod() {
  $('#methodList').innerHTML = METHOD.map(m => `
    <li class="method-item"><div><h4>${m.h}</h4><p>${m.p}</p></div><div class="method-weight">${m.w}<small>poids</small></div></li>`).join('');
}

/* ─────────── Orchestration ─────────── */
function renderAll() {
  if (!state.meteo || !state.marine) return;
  markIcons();
  const now = new Date();
  const dm = dailyMap();
  const score = scoreFor(now, dm);
  $('#lastUpdate').textContent = 'MAJ ' + fmtTime(new Date(state.lastUpdate || now));
  $('#todayChip').textContent = esc(fmtDateLong(now));
  $('#gaugeKicker').textContent = 'Indice Calamar™';
  renderGauge(score.total);
  const rating = GCLEngine.ratingOf(score.total);
  const pill = $('#ratingPill');
  pill.textContent = rating.label; pill.dataset.level = rating.level;
  const bw = bestWindowFor(score.periods);
  $('#bestWindow').textContent = bw ? `${bw.start} → ${bw.end}` : '—';
  $('#bestWindowMeta').textContent = bw ? `${bw.type === 'major' ? 'Majeure' : 'Mineure'} · ${bw.night} min de nuit` : 'Aucune fenêtre majeure nocturne';
  renderFactors(score.parts);
  renderStorm(dm);
  renderReco(score);
  renderSea();
  renderActivity(now, score.periods, dm[dayKey(now)]);
  renderForecast(dm);
  renderDayDetail(dm);
  renderMoon(now, score);
  renderCalendar(dm);
  const clock = $('#sideClock');
  if (clock) clock.textContent = new Date().toLocaleTimeString('fr-FR', { timeZone: CONFIG.tz, hour12: false });
  const dateEl = $('#sideDate');
  if (dateEl) dateEl.textContent = fmtDateLong(now);
}
function startClock() {
  const tick = () => {
    const c = $('#sideClock'); if (c) c.textContent = new Date().toLocaleTimeString('fr-FR', { timeZone: CONFIG.tz, hour12: false });
  };
  tick(); setInterval(tick, 1000);
}

/* ─────────── Démarrage ─────────── */
function init() {
  bootSplash();
  bindNav();
  bindSettings();
  renderSeasonBars();
  renderFAQ();
  renderMethod();
  markIcons();
  $('#calPrev').addEventListener('click', () => {
    state.calCursor = new Date(state.calCursor.getFullYear(), state.calCursor.getMonth() - 1, 1);
    if (state.meteo) renderCalendar(dailyMap());
  });
  $('#calNext').addEventListener('click', () => {
    state.calCursor = new Date(state.calCursor.getFullYear(), state.calCursor.getMonth() + 1, 1);
    if (state.meteo) renderCalendar(dailyMap());
  });
  startClock();
  loadData().then(() => {
    renderAll();
    state.refreshTimer = setInterval(() => refreshAll(false), CONFIG.refreshMs);
  }).catch(e => console.warn('Chargement initial impossible', e));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

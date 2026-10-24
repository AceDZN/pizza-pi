import './style.css';
import * as G from './game';
import { LEVELS } from './levels';
import { area, circumference, crustRange, round1, sauceRange, target, waterRange, type Reason } from './rules';
import { PizzaScene, U } from './scene';
import { Sound } from './audio';
import { evaluate } from './calc';
import type { Station } from './game';

const SAVE_KEY = 'pizza-pi-v1';
const EVENTS_KEY = 'pizza-pi-events-v1';
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const n = (x: number | string, digits = 1) => `<bdi>${typeof x === 'number' ? String(round1(x)).replace(/\.0$/, '') : x}</bdi>`;
const fmtText = (t: string) => t.replace(/\{\{(.+?)\}\}/g, (_, x) => `<bdi>${x}</bdi>`);
void n;

interface Save { unlocked: number; stars: number[]; muted: boolean; reduced: boolean }
function readSave(): Save {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); return { unlocked: s.unlocked ?? 0, stars: s.stars ?? [], muted: !!s.muted, reduced: !!s.reduced }; }
  catch { return { unlocked: 0, stars: [], muted: false, reduced: false }; }
}
const save = readSave();
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* storage may be blocked; the game still works */ } }
function writeEvents() { try { localStorage.setItem(EVENTS_KEY, JSON.stringify(g.events.slice(-500))); } catch { /* ignore */ } }

const params = new URLSearchParams(location.search);
const startLevel = Math.max(0, Math.min(LEVELS.length - 1, Number(params.get('level') ?? 1) - 1 || 0));
let g = G.createGame(startLevel, save.stars);
let titleShown = !params.has('level');
let manualClock = false; // true once advanceTime() drives the game (tests)

// ---------- icons ----------
const ICON: Record<string, string> = {
  mix: '<svg viewBox="0 0 48 48"><path d="M6 20h36c0 12-8 20-18 20S6 32 6 20z" fill="#e9e2d4" stroke="#3a2214" stroke-width="3"/><ellipse cx="24" cy="20" rx="18" ry="5" fill="#fbf6ea" stroke="#3a2214" stroke-width="3"/></svg>',
  dough: '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="28" rx="19" ry="11" fill="#f2dcae" stroke="#3a2214" stroke-width="3"/><ellipse cx="20" cy="25" rx="6" ry="2.5" fill="#fff8e8"/></svg>',
  sauce: '<svg viewBox="0 0 48 48"><path d="M8 24h32c0 9-7 15-16 15S8 33 8 24z" fill="#f4efe2" stroke="#3a2214" stroke-width="3"/><ellipse cx="24" cy="24" rx="16" ry="5" fill="#c8311f" stroke="#3a2214" stroke-width="3"/><path d="M30 6l6 16" stroke="#8a5a3a" stroke-width="4" stroke-linecap="round"/></svg>',
  crust: '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="26" rx="18" ry="11" fill="none" stroke="#3a2214" stroke-width="9"/><ellipse cx="24" cy="26" rx="18" ry="11" fill="none" stroke="#f5cf5a" stroke-width="5"/></svg>',
  toppings: '<svg viewBox="0 0 48 48"><path d="M8 24c0-10 7-16 16-16s16 6 16 16z" fill="#e7d6bb" stroke="#3a2214" stroke-width="3"/><rect x="18" y="24" width="12" height="16" rx="4" fill="#f4efe2" stroke="#3a2214" stroke-width="3"/></svg>',
  oven: '<svg viewBox="0 0 48 48"><path d="M6 38V26C6 15 14 8 24 8s18 7 18 18v12z" fill="#c8673f" stroke="#3a2214" stroke-width="3"/><path d="M15 38v-8a9 9 0 0118 0v8z" fill="#ff9a3a" stroke="#3a2214" stroke-width="3"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1.5" fill="#3a2214"/><rect x="14" y="4" width="5" height="16" rx="1.5" fill="#3a2214"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#3a2214"/><path d="M16 8c2 2 2 6 0 8M18.5 5.5c3.5 3.5 3.5 9.5 0 13" stroke="#3a2214" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  muted: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#3a2214"/><path d="M16 9l5 6M21 9l-5 6" stroke="#c8311f" stroke-width="2.5" stroke-linecap="round"/></svg>',
  notebook: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2" fill="#f7ecd4" stroke="#3a2214" stroke-width="2"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#3a2214" stroke-width="2"/><rect x="3" y="3" width="3" height="18" fill="#c8311f"/></svg>',
  calc: '<svg viewBox="0 0 24 24"><rect x="5" y="2.5" width="14" height="19" rx="2.5" fill="#3a3f44" stroke="#3a2214" stroke-width="1.5"/><rect x="7.5" y="5" width="9" height="4" rx="1" fill="#c9dcb3"/><g fill="#f2c45a"><circle cx="9" cy="12.5" r="1.3"/><circle cx="12" cy="12.5" r="1.3"/><circle cx="15" cy="12.5" r="1.3"/><circle cx="9" cy="16.5" r="1.3"/><circle cx="12" cy="16.5" r="1.3"/><circle cx="15" cy="16.5" r="1.3"/></g></svg>',
  restart: '<svg viewBox="0 0 24 24"><path d="M5 12a7 7 0 107-7H9" stroke="#3a2214" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M10 1.5L6.5 5 10 8.5" stroke="#3a2214" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>',
  dough_s: '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="28" rx="17" ry="12" fill="#f2dcae" stroke="#3a2214" stroke-width="3"/></svg>',
  cheese: '<svg viewBox="0 0 48 48"><path d="M6 34l30-20 6 20z" fill="#f5cf5a" stroke="#3a2214" stroke-width="3"/><circle cx="26" cy="28" r="3" fill="#e0a83a"/></svg>',
  water: '<svg viewBox="0 0 48 48"><path d="M24 6c8 12 13 18 13 25a13 13 0 01-26 0c0-7 5-13 13-25z" fill="#8fc6e8" stroke="#3a2214" stroke-width="3"/></svg>',
  flour: '<svg viewBox="0 0 48 48"><path d="M12 14h24l4 26H8z" fill="#d8c49a" stroke="#3a2214" stroke-width="3"/><path d="M12 14l4-6h16l4 6" fill="#fbf6ea" stroke="#3a2214" stroke-width="3"/></svg>',
};
const STATION_NAME: Record<Station, string> = { mix: 'קערה', dough: 'בצק', sauce: 'רוטב', crust: 'קרום', toppings: 'תוספות', oven: 'תנור' };
const CUSTOMER_NAME: Record<string, string> = { noa: 'נועה', saba: 'סבא מוטי', kids: 'שלושת הילדים' };
const TOPPING_NAME = { basil: 'בזיליקום', pepperoni: 'פפרוני', olive: 'זיתים', mushroom: 'פטריות' } as const;

// ---------- DOM ----------
document.querySelector('#app')!.innerHTML = `
  <div id="stage"></div>
  <div class="hud" id="hud">
    <div class="logo"><div class="mark">פיצה<span class="pi">π</span></div><div class="ribbon" id="level-name"></div></div>
    <div class="tools">
      <button class="round" id="btn-pause" aria-label="השהיה (P)" title="השהיה (P)">${ICON.pause}</button>
      <button class="round" id="btn-sound" aria-label="קול (M)" title="קול (M)">${ICON.sound}</button>
      <button class="round" id="btn-notebook" aria-label="המחברת של השף (H)" title="המחברת של השף (H)">${ICON.notebook}</button>
      <button class="round" id="btn-calc" aria-label="מחשבון (C)" title="מחשבון (C)">${ICON.calc}</button>
    </div>
    <div class="tickets" id="tickets"></div>
    <div class="speech hidden" id="speech"></div>
    <div class="stock" id="stock"></div>
    <div class="control" id="control"></div>
    <div class="notebook hidden" id="notebook"></div>
    <div class="calc hidden" id="calc"></div>
    <nav class="stations" id="stations" aria-label="עמדות"></nav>
    <div class="float-tag hidden" id="tag"></div>
  </div>
  <div class="overlay hidden" id="overlay"><div class="sheet" id="sheet"></div></div>
  <div class="loading" id="loading">מחממים את התנור…</div>
`;

const scene = new PizzaScene($('#stage'));
const sound = new Sound();
sound.setMuted(save.muted);
scene.reducedMotion = save.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches;
document.body.classList.toggle('reduced', scene.reducedMotion);
let modelsReady = false;
scene.loadModels((m) => { $('#loading').textContent = m; }).then(() => { modelsReady = true; $('#loading').remove(); });
window.addEventListener('pizza-context-lost', () => {
  const d = document.createElement('div');
  d.className = 'lost';
  d.innerHTML = '<div><h2>התנור כבה 😢</h2><p>הדפדפן עצר את הגרפיקה (WebGL). רעננו את הדף כדי להמשיך — ההתקדמות נשמרה.</p><button class="big" onclick="location.reload()">רענון</button></div>';
  document.body.appendChild(d);
});

// ---------- speech bubble ----------
let speechTimer = 0;
function say(line: string, ms = 3800) {
  const el = $('#speech');
  el.innerHTML = fmtText(line);
  el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  speechTimer = ms;
}
function toast(text: string) {
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = text;
  $('#hud').appendChild(t);
  setTimeout(() => t.remove(), 1500);
}

// ---------- tutorial lines per station (levels with hints) ----------
const STATION_TIP: Partial<Record<Station, string>> = {
  mix: 'מזגו מים לקערה, ואז לושו. היחס קובע אם הבצק יחזיק!',
  dough: 'גררו מהמרכז החוצה. הסרגל מודד רדיוס!',
  sauce: 'כוונו כמה סמ״ר רוטב, ואז סחטו. הרוטב מכסה שטח.',
  crust: 'משכו את חבל הגבינה לאורך הסרגל, ואז חתכו. הוא צריך להקיף את השוליים.',
  toppings: 'תוספות לבחירה — לטעם (וקצת טיפ).',
  oven: 'לתנור! ואז מצלצלים בפעמון.',
};
const toldTip = new Set<string>();

// ---------- rendering the HUD ----------
let lastHudKey = '';
function renderHud(force = false) {
  const tk = G.activeTicket(g);
  void tk;
  const key = JSON.stringify([g.phase, g.station, g.active, g.tickets.map((t) => [t.done, t.attempts]), g.pie, g.sauceDial, g.mix, g.busy?.kind, g.stock, g.levelIndex, notebookOpen, sound.muted]);
  updateLive();
  if (!force && key === lastHudKey) return;
  lastHudKey = key;
  $('#level-name').textContent = `${g.levelIndex + 1} · ${g.level.title}`;
  $('#btn-sound').innerHTML = sound.muted ? ICON.muted : ICON.sound;
  $('#btn-sound').setAttribute('aria-pressed', String(!sound.muted));
  ($('#btn-notebook') as HTMLButtonElement).disabled = !g.level.hints;
  renderTickets();
  renderStations();
  renderStock();
  renderControl();
  renderNotebook();
}

/** Timers change every frame: update them in place so buttons are never rebuilt mid-click. */
function updateLive() {
  document.querySelectorAll<HTMLElement>('#tickets [data-bar]').forEach((b) => {
    const t = g.tickets[Number(b.dataset.bar)];
    if (t) b.style.width = `${Math.max(0, 1 - t.age / 90000) * 100}%`;
  });
  const c = document.querySelector<HTMLElement>('#tickets .clock');
  if (c && g.shiftLeft !== null) {
    const sec = Math.ceil(g.shiftLeft / 1000);
    c.innerHTML = `⏱ <bdi>${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</bdi>`;
    c.classList.toggle('low', g.shiftLeft < 30000);
  }
}

function renderTickets() {
  const el = $('#tickets');
  el.classList.toggle('many', g.tickets.length > 1);
  const clock = g.shiftLeft !== null ? `<div class="clock"></div>` : '';
  el.innerHTML = g.tickets.map((t, i) => {
    const patience = Math.max(0, 1 - t.age / 90000);
    return `<button class="ticket ${i === g.active ? 'active' : ''} ${t.done ? 'done' : ''}" data-ticket="${i}" aria-label="הזמנה ${i + 1}">
      <div class="who">${CUSTOMER_NAME[t.def.customer]}${t.attempts ? ` · ניסיון ${t.attempts + 1}` : ''}</div>
      <div class="order">${fmtText(t.def.text)}</div>
      <div class="patience"><span>סבלנות הלקוח:</span><div class="bar"><i data-bar="${i}" style="width:${patience * 100}%"></i></div></div>
    </button>`;
  }).join('') + (clock ? `<div style="position:absolute;top:100%;left:50%;transform:translate(-50%,8px)">${clock}</div>` : '');
}

function renderStations() {
  const r = G.route(g);
  $('#stations').innerHTML = r.map((s, i) => `<button class="station ${s === g.station ? 'active' : ''}" data-station="${s}" aria-pressed="${s === g.station}">${ICON[s]}<span>${STATION_NAME[s]}</span><span class="key">${i + 1}</span></button>`).join('');
}

function renderStock() {
  const L = g.level.stock;
  const rows: [string, string, number, number, string][] = [
    ['dough_s', 'בצק', g.stock.dough, L.dough, 'סמ״ר'],
  ];
  if (L.sauce) rows.push(['sauce', 'רוטב', g.stock.sauce, L.sauce, 'סמ״ר']);
  if (L.cheese) rows.push(['cheese', 'גבינה', g.stock.cheese, L.cheese, 'ס״מ']);
  if (L.water) rows.push(['water', 'מים', g.stock.water, L.water, 'גרם']);
  if (L.flour) rows.push(['flour', 'קמח במלאי', g.stock.flour, L.flour, 'גרם']);
  $('#stock').innerHTML = rows.map(([ico, name, v, max, unit]) => {
    const f = Math.max(0, v / max);
    return `<div class="card"><span class="ico">${ICON[ico]}</span><div style="flex:1"><b>${name}</b><div class="meter ${f < 0.25 ? 'low' : ''}"><i style="width:${f * 100}%"></i></div><small><bdi>${Math.max(0, Math.round(v))}</bdi> ${unit}</small></div></div>`;
  }).join('');
}

function busyText() {
  switch (g.busy?.kind) {
    case 'squeeze': return 'סוחטים…';
    case 'cleanup': return 'מנגבים את השיש… 🧽';
    case 'bake': return 'אופים… 🔥';
    case 'cut': return 'עוטפים את השוליים…';
    case 'knead': return 'לשים…';
    default: return '';
  }
}

function renderControl() {
  const el = $('#control');
  // Never rebuild the card under the player's fingers while they type a sauce amount.
  if (document.activeElement?.id === 'dial' && g.station === 'sauce' && g.phase === 'playing' && !g.busy) return;
  const p = g.pie;
  const o = G.activeTicket(g).def.order;
  if (g.phase !== 'playing') { el.style.display = 'none'; return; }
  el.style.display = '';
  const busy = busyText();
  const next = G.route(g)[G.route(g).indexOf(g.station) + 1];
  const nextBtn = next ? `<button class="link" data-act="next">← ל${STATION_NAME[next]}</button>` : '';
  const trash = p.r > 0 ? `<button class="link" data-act="trash">🗑 פיצה חדשה</button>` : '';
  let html = '';
  switch (g.station) {
    case 'mix': {
      const mix = o.mix!;
      html = `<h3>קערת הבצק</h3>
        <div class="row"><div class="readout" style="flex:1">${ICON.flour.replace('<svg', '<svg width="30" height="30"')}<bdi>${round1(g.mix.flour)}</bdi><small>גרם</small></div>
        <div class="readout" style="flex:1">${ICON.water.replace('<svg', '<svg width="30" height="30"')}<bdi>${round1(g.mix.water)}</bdi><small>גרם</small></div></div>
        <p class="hint-line">יחס קמח : מים = <bdi>${mix.ratioFlour} : ${mix.ratioWater}</bdi></p>
        ${g.mix.kneaded ? `<p class="hint-line">${g.mix.quality === 'good' ? 'הבצק מוכן — עברו לבצק ומתחו!' : 'כדור בצק מוכן. בדקו אותו כשמותחים…'}</p><button class="big" data-act="next">← לבצק</button>` : `
        <div class="row"><b style="align-self:center">מים:</b><button class="chip" data-pour="water:100">+100</button><button class="chip" data-pour="water:10">+10</button><button class="chip" data-pour="water:1">+1</button></div>
        <div class="row"><b style="align-self:center">קמח:</b><button class="chip" data-pour="flour:100">+100</button><button class="chip" data-pour="flour:10">+10</button></div>
        <button class="big" data-act="knead" ${busy ? 'disabled' : ''}>${busy || 'לישה 🤲'}</button>`}`;
      break;
    }
    case 'dough': {
      const deal = o.dough.kind === 'bestDeal';
      html = `<h3>רדיוס</h3>
        ${deal ? `<div class="row"><button class="chip ${p.count === 1 ? 'on' : ''}" data-count="1">פיצה אחת</button><button class="chip ${p.count === 2 ? 'on' : ''}" data-count="2">שתי פיצות</button></div>` : ''}
        <div class="readout"><bdi>${p.r || '—'}</bdi><small>ס״מ</small></div>
        <div class="row steps"><button class="chip" data-r="-1">−1</button><button class="chip" data-r="-0.5">−½</button><button class="chip" data-r="0.5">+½</button><button class="chip" data-r="1">+1</button></div>
        <p class="hint-line">${p.tore ? (p.tore === 'tear' ? 'הבצק נקרע! יותר מדי מים ביחס לקמח.' : 'הבצק נסדק! חסרים מים ביחס לקמח.') : p.sauce > 0 ? 'הבצק כבר מרוח ברוטב.' : 'גררו על הבצק מהמרכז החוצה (או ← →).'}</p>
        ${p.tore ? '<button class="big gold" data-act="bowl">חזרה לקערה 🥣</button>' : next ? `<button class="big" data-act="next" ${p.r ? '' : 'disabled'}>← ל${STATION_NAME[next]}</button>` : ''}
        <div class="links">${trash}</div>`;
      break;
    }
    case 'sauce': {
      html = `<h3>רוטב</h3>
        ${gauge(g.sauceDial)}
        <div class="row steps"><button class="chip" data-dial="-100">−100</button><button class="chip" data-dial="-10">−10</button><button class="chip" data-dial="-1">−1</button><button class="chip" data-dial="1">+1</button><button class="chip" data-dial="10">+10</button><button class="chip" data-dial="100">+100</button></div>
        <p class="hint-line">על הפיצה: <bdi>${round1(p.sauce)}</bdi> סמ״ר${p.count === 2 ? ' (בכל אחת)' : ''} · סחיטות: <bdi>${p.squeezes}/2</bdi></p>
        <button class="big" data-act="squeeze" ${busy || p.squeezes >= 2 || !p.r ? 'disabled' : ''}>${busy || 'סחיטה 💦'}</button>
        <div class="links">${trash}${nextBtn}</div>`;
      break;
    }
    case 'crust': {
      html = `<h3>חבל גבינה</h3>
        <div class="readout"><bdi>${p.cheese !== null ? p.cheese : p.rope}</bdi><small>ס״מ</small></div>
        ${p.cheese === null ? `<div class="row steps"><button class="chip" data-rope="-5">−5</button><button class="chip" data-rope="-0.5">−½</button><button class="chip" data-rope="0.5">+½</button><button class="chip" data-rope="5">+5</button></div>
        <p class="hint-line">גררו לאורך הסרגל הצהוב כדי למשוך גבינה.</p>
        <button class="big gold" data-act="cut" ${busy || !p.rope ? 'disabled' : ''}>${busy || 'חיתוך ✂️'}</button>` : `<p class="hint-line">הקרום על הפיצה.</p><button class="link" data-act="uncrust">להסיר קרום (הגבינה תתבזבז)</button>`}
        <div class="links">${trash}${nextBtn}</div>`;
      break;
    }
    case 'toppings': {
      html = `<h3>תוספות <small style="font-size:14px">(לבחירה)</small></h3>
        <div class="row">${(Object.keys(TOPPING_NAME) as (keyof typeof TOPPING_NAME)[]).map((k) => `<button class="chip" data-top="${k}">${TOPPING_NAME[k]}</button>`).join('')}</div>
        <p class="hint-line">אפשר גם ללחוץ על הצנצנות. על הפיצה: <bdi>${p.toppings.length}</bdi></p>
        <div class="links">${trash}${nextBtn}</div>`;
      break;
    }
    case 'oven': {
      html = `<h3>תנור עצים</h3>
        ${p.baked ? '<p class="hint-line">הפיצה אפויה! צלצלו בפעמון כדי להגיש.</p><button class="big gold" data-act="serve">🔔 הגשה!</button>' : `<p class="hint-line">${p.r ? 'הכול מוכן? שולחים לתנור.' : 'אין עדיין פיצה.'}</p><button class="big red" data-act="bake" ${busy || !p.r ? 'disabled' : ''}>${busy || 'לתנור 🔥'}</button>`}
        <div class="links">${p.baked ? '' : trash}</div>`;
      break;
    }
  }
  el.innerHTML = html;
  const dial = el.querySelector<HTMLInputElement>('#dial');
  if (dial) {
    dial.addEventListener('input', () => {
      G.setSauceDial(g, Number(dial.value));
      const needle = el.querySelector<SVGGElement>('.gauge g');
      needle?.setAttribute('transform', `rotate(${-90 + 180 * Math.min(1, g.sauceDial / 1600)} 100 100)`);
    });
    dial.addEventListener('change', () => { G.setSauceDial(g, Number(dial.value)); });
  }
}

/** Semicircle sauce gauge (design/mockups/02): needle over 0–1600 cm², the number is typed or stepped. */
function gauge(v: number) {
  const max = 1600, cx = 100, cy = 100, r = 78;
  const seg = (a0: number, a1: number, color: string) => {
    const p = (a: number) => `${cx + Math.cos(Math.PI * (1 - a)) * r},${cy - Math.sin(Math.PI * (1 - a)) * r}`;
    return `<path d="M${p(a0)} A${r},${r} 0 0 1 ${p(a1)}" stroke="${color}" stroke-width="18" fill="none"/>`;
  };
  const colors = ['#ffe08a', '#f6c15a', '#f19a3e', '#e06a2e', '#c8311f'];
  const ang = -90 + 180 * Math.min(1, v / max);
  return `<div class="gauge"><svg viewBox="0 0 200 112" aria-hidden="true">${colors.map((c, i) => seg(i / 5 + 0.005, (i + 1) / 5 - 0.005, c)).join('')}
    <g transform="rotate(${ang} ${cx} ${cy})"><path d="M${cx - 5},${cy} L${cx},${cy - 70} L${cx + 5},${cy} z" fill="#3a2214"/></g><circle cx="${cx}" cy="${cy}" r="9" fill="#3a2214"/></svg>
    <div class="gauge-val"><input class="dial-input" id="dial" type="number" inputmode="decimal" min="0" max="3000" value="${v}" aria-label="כמות רוטב בסמ״ר"><small>סמ״ר</small></div></div>`;
}

let notebookOpen = false;
function renderNotebook() {
  const el = $('#notebook');
  const visible = notebookOpen && g.level.hints && g.phase === 'playing';
  el.classList.toggle('hidden', !visible);
  if (visible) el.innerHTML = `<div>📒 המחברת של השף</div><div class="formula">${fmtText(G.hintText(g))}</div>`;
}

// ---------- overlays ----------
function showOverlay(html: string, kind = '') { $('#sheet').innerHTML = html; $('#sheet').className = `sheet ${kind}`; $('#overlay').classList.remove('hidden'); }
function hideOverlay() { $('#overlay').classList.add('hidden'); }
const stars = (k: number) => `<div class="stars">${[1, 2, 3].map((i) => `<span class="${i <= k ? '' : 'off'}">★</span>`).join('')}</div>`;

function showTitle() {
  showOverlay(`<div class="title"><div class="mark">פיצה<span class="pi">π</span></div></div>
    <p>משמרת לילה בפיצרייה של פפה. מותחים בצק לפי <b>רדיוס</b>, מורחים רוטב לפי <b>שטח</b>, ועוטפים קרום לפי <b>היקף</b>. טעות בחישוב? רואים אותה על הפיצה.</p>
    <button class="big" data-act="play">שחקו ▶</button>
    <div class="levels">${LEVELS.map((l, i) => `<button data-level="${i}" ${i > save.unlocked ? 'disabled' : ''}><b>${i + 1}. ${l.title}</b>${l.topic} ${save.stars[i] ? '★'.repeat(save.stars[i]) : ''}</button>`).join('')}</div>
    <div class="toggles"><button class="chip ${scene.reducedMotion ? 'on' : ''}" data-act="motion">פחות תנועה</button><button class="chip ${sound.muted ? '' : 'on'}" data-act="sound">קול</button></div>
    <p style="font-size:13px;opacity:.7">עכבר/מגע: גוררים ולוחצים · מקלדת: 1–6 עמדות, ← → כיוון, Enter פעולה, H מחברת, C מחשבון, P השהיה</p>`);
}

function showIntro() {
  const L = g.level;
  showOverlay(`<span class="topic">${L.topic}</span><h2>שלב ${g.levelIndex + 1}: ${L.title}</h2>
    <p>${fmtText(L.intro)}</p>
    ${L.shiftSeconds ? `<p><b>⏱ <bdi>${L.shiftSeconds}</bdi> שניות · בלי מחברת</b></p>` : ''}
    <button class="big" data-act="start">יאללה, לעבודה!</button>`);
}

function explain(r: Reason): string {
  const v = r.values;
  const o = G.activeTicket(g).def.order;
  switch (r.code) {
    case 'used_diameter_as_radius': return `ההזמנה: קוטר <bdi>${v.want_r * 2}</bdi> ס״מ. מתחתם רדיוס <bdi>${v.got_r}</bdi> — זה קוטר <bdi>${v.got_r * 2}</bdi>! קוטר = 2 × רדיוס, ולכן <bdi>r = ${v.want_r * 2} ÷ 2 = ${v.want_r}</bdi>.`;
    case 'used_radius_as_diameter': return `ההזמנה: רדיוס <bdi>${v.want_r}</bdi>. הפיצה ברדיוס <bdi>${v.got_r}</bdi>, כלומר קוטר <bdi>${v.got_r * 2}</bdi> בלבד. הסרגל כבר מודד רדיוס — אין צורך לחלק ב־2.`;
    case 'dough_too_big': case 'dough_too_small': case 'dough_radius_wrong': return `הרדיוס היה <bdi>${v.got_r}</bdi> ס״מ, וצריך <bdi>${v.want_r}</bdi> ס״מ.`;
    case 'forgot_to_enlarge': { const s = o.dough as { baseD: number; percent: number }; return `זו בדיוק הפיצה הרגילה. קוטר חדש = <bdi>${s.baseD} × ${1 + s.percent / 100} = ${round1(s.baseD * (1 + s.percent / 100))}</bdi>, כלומר רדיוס <bdi>${v.want_r}</bdi>.`; }
    case 'area_short_by_cm2': return `<bdi>π × r² ≈ ${v.got_cm2}</bdi> סמ״ר, אבל צריך לפחות <bdi>${v.need_cm2}</bdi>. חסרו <bdi>${v.short_by_cm2}</bdi> סמ״ר — והילדים רבים על המשולש האחרון!`;
    case 'dough_wasted_cm2': return `כולם שבעים, אבל גם רדיוס קטן יותר היה מספיק (<bdi>${v.best_cm2}</bdi> סמ״ר). בזבזתם <bdi>${v.wasted_cm2}</bdi> סמ״ר בצק.`;
    case 'deal_less_pizza_by_cm2': return `שתי פיצות בקוטר 28: <bdi>2 × π × 14² ≈ ${v.got_cm2}</bdi>. פיצה אחת בקוטר 40: <bdi>π × 20² ≈ ${v.best_cm2}</bdi>. הגדולה מנצחת ב־<bdi>${v.less_by_cm2}</bdi> סמ״ר! כשהקוטר גדל, השטח גדל בריבוע.`;
    case 'sauce_short_by_cm2': return `מרחתם <bdi>${v.got_cm2}</bdi> סמ״ר, אבל שטח הפיצה הוא <bdi>π × r² ≈ ${v.want_cm2}</bdi>. חסרו <bdi>${v.short_by_cm2}</bdi> סמ״ר, והטבעת החשופה נשרפה.`;
    case 'sauce_used_circumference': return `<bdi>${v.got_cm2}</bdi> זה בערך ההיקף (<bdi>2πr</bdi>), לא השטח. רוטב מכסה שטח: <bdi>π × r² ≈ ${v.want_cm2}</bdi> סמ״ר.`;
    case 'sauce_scaled_linearly': return `הגדלתם את הרוטב פי <bdi>${v.factor_used}</bdi>, כמו הקוטר. אבל כשהקוטר גדל פי <bdi>k</bdi>, השטח גדל פי <bdi>k²</bdi>: <bdi>${v.factor_used}² = ${v.factor_needed}</bdi>, כלומר בערך <bdi>${v.want_cm2}</bdi> סמ״ר.`;
    case 'sauce_over_by_cm2': return `<bdi>${v.over_by_cm2}</bdi> סמ״ר רוטב עודף נשפכו על השיש וביזבזו מלאי וזמן.`;
    case 'crust_gap_cm': return `החבל היה <bdi>${v.got_cm}</bdi> ס״מ, אבל ההיקף הוא <bdi>2 × π × r ≈ ${v.want_cm}</bdi>. נשאר חור של <bdi>${v.gap_cm}</bdi> ס״מ — והגבינה ברחה בתנור!`;
    case 'crust_used_pi_r': return `<bdi>${v.got_cm}</bdi> זה רק <bdi>π × r</bdi> — חצי מההיקף. היקף = <bdi>2 × π × r ≈ ${v.want_cm}</bdi> ס״מ.`;
    case 'crust_used_area': return `<bdi>${v.got_cm}</bdi> זה השטח (<bdi>πr²</bdi>), לא ההיקף. היקף = <bdi>2 × π × r ≈ ${v.want_cm}</bdi> ס״מ.`;
    case 'crust_overlap_cm': return `<bdi>${v.overlap_cm}</bdi> ס״מ גבינה מיותרת יצרו גוש כפול.`;
    default: return r.code;
  }
}
const REACTION: Record<string, string> = {
  used_diameter_as_radius: 'זה מגש, לא פיצה! 😳', used_radius_as_diameter: 'פיצה לבובות? 🤏', dough_too_big: 'ענקית מדי!', dough_too_small: 'קטנטונת!',
  forgot_to_enlarge: 'היי, זו בדיוק הרגילה!', area_short_by_cm2: 'אנחנו רבים על המשולש האחרון! 😤', deal_less_pizza_by_cm2: 'רגע… זה פחות פיצה!', dough_radius_wrong: 'זה לא הגודל מהעסקה.',
  sauce_short_by_cm2: 'הקצוות שרופים! 🔥', sauce_used_circumference: 'הקצוות שרופים! 🔥', sauce_scaled_linearly: 'הרוטב לא מגיע לקצה!',
  crust_gap_cm: 'הגבינה ברחה מהחור! 🧀', crust_used_pi_r: 'חצי קרום?!', crust_used_area: 'הגבינה ברחה מהחור! 🧀',
};

function showResult() {
  const res = g.result!;
  const v = res.verdict;
  const tk = g.tickets.find((t) => t.def.id === res.ticketId)!;
  const who = CUSTOMER_NAME[tk.def.customer];
  const main = v.reasons.find((r) => r.severity === 'fail') ?? v.reasons[0];
  const reaction = v.outcome === 'perfect' ? 'מושלם!!! 🤩' : v.outcome === 'ok' ? 'טעים! אבל…' : REACTION[main.code] ?? 'אממ… לא בדיוק.';
  const deal = G.activeTicket(g).def.order.dough.kind === 'bestDeal' ? dealScale(res.pie.count, res.pie.r) : '';
  const facts: string[] = [];
  if (v.want.sauce) facts.push(`🍅 רוטב <bdi>${round1(res.pie.sauce)}</bdi> מתוך <bdi>≈ ${round1(v.want.sauce.want)}</bdi> סמ״ר`);
  if (v.want.crust) facts.push(`🧀 קרום <bdi>${res.pie.cheese ?? 0}</bdi> מתוך <bdi>≈ ${round1(v.want.crust.want)}</bdi> ס״מ`);
  showOverlay(`<div class="scroll ${v.outcome}">
    <div class="who">♥ ${who} ♥</div>
    <div class="reaction">${reaction}</div>
    ${stars(v.stars)}
    ${deal}
    ${v.outcome === 'perfect' ? facts.map((f) => `<div class="fact">${f} <span class="ok">✓</span></div>`).join('') : ''}
    ${v.reasons.length ? `<div class="explain"><ul>${v.reasons.map((r) => `<li>${explain(r)}</li>`).join('')}</ul></div>` : ''}
    ${v.outcome !== 'fail' ? `<div class="tips">🪙🪙 טיפ: <bdi>+${res.tips}</bdi> <small>· <bdi>${res.seconds}</bdi> שניות</small></div>` : '<p>אין נורא — מכינים שוב! ההזמנה עדיין פתוחה.</p>'}
    <button class="big" data-act="continue">${v.outcome === 'fail' ? 'ננסה שוב ↻' : 'המשך ◀'}</button></div>`, 'result');
  if (v.outcome !== 'fail') sound.coin(Math.ceil(res.tips / 3));
}

/** Level 5: the pastry scale reveals both options after baking. */
function dealScale(count: number, r: number) {
  const one = area(20), two = 2 * area(14);
  const tilt = one > two ? -6 : 6;
  return `<div style="margin:8px auto;max-width:360px">
    <div style="display:flex;justify-content:space-between;font-weight:900;font-size:15px"><span>אחת בקוטר 40<br><bdi>${round1(one)}</bdi> סמ״ר</span><span>⚖️</span><span>שתיים בקוטר 28<br><bdi>${round1(two)}</bdi> סמ״ר</span></div>
    <div style="height:8px;background:var(--brown);border-radius:4px;transform:rotate(${tilt}deg);margin:10px 20px"></div>
    <div style="font-size:14px">בחרתם: ${count === 1 ? 'פיצה אחת' : 'שתי פיצות'} ברדיוס <bdi>${r}</bdi></div></div>`;
}

function showLevelDone() {
  const st = save.stars[g.levelIndex] = Math.max(save.stars[g.levelIndex] ?? 0, g.starsByLevel[g.levelIndex] ?? 0);
  save.unlocked = Math.max(save.unlocked, g.levelIndex + 1);
  writeSave();
  const last = g.phase === 'finished';
  showOverlay(`<h2>${last ? 'סוף המשמרת! 🎉' : 'שלב הושלם!'}</h2>${stars(st)}
    <p>טיפים במשמרת: <bdi>${g.tipsTotal}</bdi> 🪙 · רמזים: <bdi>${g.hintsUsed}</bdi></p>
    ${last ? `<p>שרדתם את שעת העומס בלי המחברת של השף. רדיוס, קוטר, שטח, היקף, אחוזים ויחס — הכול עבד על פיצות אמיתיות.</p>
      <div class="levels">${LEVELS.map((l, i) => `<button data-level="${i}"><b>${i + 1}. ${l.title}</b>${'★'.repeat(save.stars[i] ?? 0) || '—'}</button>`).join('')}</div>` : ''}
    <button class="big" data-act="${last ? 'menu' : 'nextlevel'}">${last ? 'לתפריט' : 'לשלב הבא ←'}</button>
    ${last ? '' : '<button class="link" data-act="restart">לשחק שוב את השלב</button>'}`);
}

function showShiftOver() {
  const what = g.shortOf === 'time' ? 'נגמר הזמן' : g.shortOf === 'dough' ? 'נגמר הבצק' : g.shortOf === 'sauce' ? 'נגמר הרוטב' : 'נגמרה הגבינה';
  const served = g.tickets.filter((t) => t.done).length;
  showOverlay(`<h2>${what}!</h2>
    <p>הגשתם <bdi>${served}</bdi> מתוך <bdi>${g.tickets.length}</bdi> הזמנות. פפה אומר: “כל טבח שורף כמה פיצות בדרך. מחר בערב שוב!”</p>
    <p class="hint-line">טיפ: כל טעות מבזבזת מלאי. חשבו לפני שסוחטים.</p>
    <button class="big" data-act="restart">משמרת חדשה ↻</button>`);
}

let shownPhase = '';
function syncOverlay() {
  const key = `${g.phase}:${titleShown}:${g.levelIndex}`;
  if (key === shownPhase) return;
  shownPhase = key;
  if (titleShown) { showTitle(); return; }
  switch (g.phase) {
    case 'intro': showIntro(); break;
    case 'result': setTimeout(() => g.phase === 'result' && showResult(), scene.reducedMotion ? 0 : 900); break;
    case 'levelDone': case 'finished': showLevelDone(); break;
    case 'shiftOver': showShiftOver(); break;
    default: hideOverlay();
  }
}

// ---------- actions ----------
function act(name: string, el?: HTMLElement) {
  sound.unlock();
  switch (name) {
    case 'play': titleShown = false; g = G.createGame(Math.min(save.unlocked, LEVELS.length - 1), save.stars); break;
    case 'start': G.start(g); break;
    case 'next': G.nextStation(g, 1); break;
    case 'trash': G.trashPie(g); break;
    case 'bowl': G.backToBowl(g); break;
    case 'knead': G.knead(g); break;
    case 'squeeze': G.squeeze(g); break;
    case 'cut': G.cut(g); break;
    case 'uncrust': G.removeCrust(g); break;
    case 'bake': G.bake(g); break;
    case 'serve': G.serve(g); break;
    case 'continue': G.continueAfterResult(g); break;
    case 'nextlevel': g = G.nextLevel(g); break;
    case 'restart': g = G.restartLevel(g); break;
    case 'menu': titleShown = true; shownPhase = ''; break;
    case 'motion': save.reduced = scene.reducedMotion = !scene.reducedMotion; document.body.classList.toggle('reduced', scene.reducedMotion); writeSave(); shownPhase = ''; break;
    case 'sound': toggleSound(); shownPhase = ''; break;
  }
  void el;
  writeEvents();
  renderHud(true);
}
function toggleSound() { sound.setMuted(!sound.muted); save.muted = sound.muted; writeSave(); renderHud(true); }
function togglePause() {
  if (g.phase !== 'playing' && !g.paused) return;
  g.paused = !g.paused;
  $('#btn-pause').setAttribute('aria-pressed', String(g.paused));
  if (g.paused) showOverlay(`<h2>הפסקה ☕</h2><p>הפיצה מחכה.</p><button class="big" data-act-pause="1">המשך</button>
    <div class="toggles"><button class="chip" data-act="restart">התחלת השלב מחדש</button><button class="chip" data-act="menu">תפריט</button><button class="chip ${scene.reducedMotion ? 'on' : ''}" data-act="motion">פחות תנועה</button></div>`);
  else { hideOverlay(); shownPhase = ''; }
}

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('button');
  if (!t) return;
  sound.unlock();
  if (t.dataset.actPause) { togglePause(); return; }
  if (t.dataset.act) { if (g.paused && t.dataset.act !== 'motion') { g.paused = false; } sound.click(); act(t.dataset.act, t); return; }
  if (t.dataset.level) { titleShown = false; g = G.createGame(Number(t.dataset.level), save.stars); shownPhase = ''; renderHud(true); return; }
  if (t.dataset.station) { G.goStation(g, t.dataset.station as Station); renderHud(true); return; }
  if (t.dataset.ticket) { G.selectTicket(g, Number(t.dataset.ticket)); renderHud(true); return; }
  if (t.dataset.r) { G.setRadius(g, g.pie.r + Number(t.dataset.r)); G.commitDough(g); renderHud(true); return; }
  if (t.dataset.dial) { G.setSauceDial(g, g.sauceDial + Number(t.dataset.dial)); sound.click(); renderHud(true); return; }
  if (t.dataset.rope) { G.setRope(g, g.pie.rope + Number(t.dataset.rope)); sound.click(); renderHud(true); return; }
  if (t.dataset.top) { G.addTopping(g, t.dataset.top as G.ToppingKind); renderHud(true); return; }
  if (t.dataset.count) { G.setCount(g, Number(t.dataset.count) as 1 | 2); renderHud(true); return; }
  if (t.dataset.pour) { const [w, a] = t.dataset.pour.split(':'); G.pour(g, w as 'water' | 'flour', Number(a)); renderHud(true); return; }
  switch (t.id) {
    case 'btn-pause': togglePause(); break;
    case 'btn-sound': toggleSound(); break;
    case 'btn-notebook': if (g.level.hints) { notebookOpen = !notebookOpen; if (notebookOpen) G.useHint(g); renderHud(true); } break;
    case 'btn-calc': toggleCalc(); break;
  }
});

// ---------- pointer on the 3D counter ----------
let drag: 'dough' | 'rope' | null = null;
const canvas = scene.renderer.domElement;
canvas.addEventListener('pointerdown', (e) => {
  sound.unlock();
  if (g.phase !== 'playing' || g.paused) return;
  const hit = scene.pickCounter(e.clientX, e.clientY);
  const obj = scene.pickObject(e.clientX, e.clientY);
  if (obj?.topping && g.station === 'toppings') { G.addTopping(g, obj.topping as G.ToppingKind); return; }
  if (obj?.bell) { if (g.pie.baked) G.serve(g); else { G.goStation(g, 'oven'); } return; }
  if (obj?.oven) { if (g.station !== 'oven') G.goStation(g, 'oven'); else G.bake(g); return; }
  if (!hit) return;
  if (g.station === 'dough') {
    const c = scene.pieCenter();
    const d = Math.hypot(hit.x - c.x, hit.z - c.z);
    if (d < Math.max(g.pie.r * U, 0.8) + 1.2) { drag = 'dough'; canvas.setPointerCapture(e.pointerId); if (g.pie.r > 0 && d > 0.3) G.setRadius(g, d / U); }
  } else if (g.station === 'crust' && g.pie.cheese === null) {
    drag = 'rope'; canvas.setPointerCapture(e.pointerId);
    G.setRope(g, (scene.reelX() - hit.x) / U);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const hit = scene.pickCounter(e.clientX, e.clientY);
  if (!hit) return;
  if (drag === 'dough') { const c = scene.pieCenter(); G.setRadius(g, Math.hypot(hit.x - c.x, hit.z - c.z) / U); }
  else G.setRope(g, (scene.reelX() - hit.x) / U);
});
const endDrag = () => { if (drag === 'dough') G.commitDough(g); drag = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ---------- keyboard ----------
document.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT' && e.key !== 'Enter') return;
  sound.unlock();
  const k = e.key;
  if (k === 'p' || k === 'P' || k === 'Escape') { togglePause(); return; }
  if (k === 'm' || k === 'M') { toggleSound(); return; }
  if (k === 'c' || k === 'C') { toggleCalc(); return; }
  if ((k === 'h' || k === 'H') && g.level.hints) { notebookOpen = !notebookOpen; if (notebookOpen) G.useHint(g); renderHud(true); return; }
  if (k === 'Enter' || k === ' ') {
    e.preventDefault();
    const t = e.target as HTMLInputElement;
    if (t.id === 'dial') G.setSauceDial(g, Number(t.value));
    const primary = document.querySelector<HTMLButtonElement>('#sheet .big:not([disabled])') && !$('#overlay').classList.contains('hidden')
      ? document.querySelector<HTMLButtonElement>('#sheet .big')
      : document.querySelector<HTMLButtonElement>('#control .big:not([disabled])');
    primary?.click();
    return;
  }
  if (g.phase !== 'playing') return;
  const route = G.route(g);
  if (/^[1-6]$/.test(k) && route[Number(k) - 1]) { G.goStation(g, route[Number(k) - 1]); renderHud(true); return; }
  const dir = k === 'ArrowRight' || k === 'ArrowUp' ? 1 : k === 'ArrowLeft' || k === 'ArrowDown' ? -1 : 0;
  if (!dir) return;
  e.preventDefault();
  if (g.station === 'dough') { G.setRadius(g, g.pie.r + dir * 0.5); G.commitDough(g); }
  if (g.station === 'sauce') G.setSauceDial(g, g.sauceDial + dir * (e.shiftKey ? 1 : 10));
  if (g.station === 'crust') G.setRope(g, g.pie.rope + dir * (e.shiftKey ? 5 : 0.5));
  renderHud(true);
});

// ---------- calculator ----------
let calcExpr = '';
function toggleCalc() {
  const el = $('#calc');
  el.classList.toggle('hidden');
  if (!el.classList.contains('hidden')) renderCalc();
}
function renderCalc(result?: string) {
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', 'π', '+', '(', ')', 'x²', '√', 'C', '⌫', '='];
  $('#calc').innerHTML = `<div class="screen"><small>${result !== undefined ? calcExpr : ''}</small>${result ?? (calcExpr || '0')}</div>
    <div class="keys">${keys.map((k) => `<button data-calc="${k}" class="${'÷×−+'.includes(k) ? 'op' : k === '=' ? 'eq' : ''}" ${k === '=' ? 'style="grid-column:span 2"' : ''}>${k}</button>`).join('')}</div>`;
}
$('#calc').addEventListener('click', (e) => {
  e.stopPropagation();
  const k = (e.target as HTMLElement).closest<HTMLElement>('[data-calc]')?.dataset.calc;
  if (!k) return;
  sound.click();
  if (k === 'C') calcExpr = '';
  else if (k === '⌫') calcExpr = calcExpr.slice(0, -1);
  else if (k === 'x²') calcExpr += '²';
  else if (k === '=') {
    const v = evaluate(calcExpr);
    if (v === null) { renderCalc('שגיאה'); return; }
    const shown = String(Math.round(v * 1000) / 1000);
    G.noteCalculator(g, calcExpr, v);
    renderCalc(shown);
    calcExpr = shown;
    return;
  } else calcExpr += k;
  renderCalc();
});

// ---------- cues → scene, sound, speech ----------
function consumeCues() {
  for (const c of g.cues) {
    scene.handleCue(c, g);
    sound.handle(c);
    if (c.kind === 'say') say(String(c.values?.line));
    if (c.kind === 'station' && g.level.hints) {
      const s = c.values?.station as Station;
      const k = `${g.levelIndex}:${s}`;
      if (!toldTip.has(k) && STATION_TIP[s]) { toldTip.add(k); say(STATION_TIP[s]!); }
    }
    if (c.kind === 'tray') toast('מגש?! 😳');
    if (c.kind === 'serve' && c.values?.outcome === 'perfect') toast('מושלם! ⭐⭐⭐');
    if (c.kind === 'cut' && c.values?.outcome === 'sealed') toast('נסגר בדיוק! 🧀');
  }
  if (g.cues.length) { writeEvents(); renderHud(true); }
  g.cues.length = 0;
}

/** A floating tag over the pie names what the player can see (bare ring, flood, gap). */
function updateTag() {
  const el = $('#tag');
  const p = g.pie;
  let text = '', ok = false;
  if (g.phase === 'playing' && p.r > 0 && !g.busy) {
    const o = G.activeTicket(g).def.order;
    if (g.station === 'sauce' && p.sauce > 0) {
      const s = sauceRange(p.r);
      if (p.sauce < s.min) text = 'טבעת חשופה!'; else if (p.sauce > s.max) text = 'שיטפון!'; else { text = 'מכוסה ✓'; ok = true; }
    } else if (g.station === 'crust' && p.cheese !== null && o.crust) {
      const c = crustRange(p.r);
      if (p.cheese < c.min) text = 'חור בקרום!'; else if (p.cheese > c.max) text = 'גוש כפול'; else { text = 'סגור ✓'; ok = true; }
    }
  }
  el.classList.toggle('hidden', !text);
  if (!text) return;
  el.textContent = text; el.classList.toggle('ok', ok);
  const c = scene.pieCenter();
  const v = c.clone(); v.x += p.r * U * 0.7; v.z -= p.r * U * 0.7; v.y += 0.3;
  v.project(scene.camera);
  const rect = canvas.getBoundingClientRect();
  el.style.left = `${((v.x + 1) / 2) * rect.width}px`;
  el.style.top = `${((1 - v.y) / 2) * rect.height}px`;
}

function placeSpeech() {
  const el = $('#speech');
  const chef = scene.chef?.root;
  const narrow = innerWidth < 760;
  if (!chef || narrow) { el.style.right = narrow ? '8px' : '18%'; el.style.top = narrow ? '64px' : '24%'; el.style.left = 'auto'; el.style.maxWidth = narrow ? '34%' : ''; return; }
  const v = chef.position.clone(); v.y += 11.5; v.x -= 1.5;
  v.project(scene.camera);
  const x = ((v.x + 1) / 2) * innerWidth, y = ((1 - v.y) / 2) * innerHeight;
  el.style.left = 'auto';
  el.style.right = `${Math.max(12, Math.min(innerWidth * 0.45, innerWidth - x - 40))}px`;
  el.style.top = `${Math.max(150, Math.min(innerHeight * 0.45, y))}px`;
}

// ---------- loop ----------
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!manualClock) G.update(g, dt * 1000);
  step(dt);
  requestAnimationFrame(frame);
}
function step(dt: number) {
  consumeCues();
  if (speechTimer > 0) { speechTimer -= dt * 1000; if (speechTimer <= 0) $('#speech').classList.add('hidden'); }
  syncOverlay();
  renderHud();
  scene.sync(g, dt);
  updateTag();
  placeSpeech();
}
requestAnimationFrame(frame);
if (!titleShown) shownPhase = '';

// ---------- test hooks ----------
function stateForText() {
  const tk = G.activeTicket(g);
  const o = tk?.def.order;
  const p = g.pie;
  const t = o ? target(o) : null;
  return {
    coordinates: 'x right, y up, z toward camera; pie centred on the counter; 1 world unit = 10 cm',
    level: { index: g.levelIndex + 1, id: g.level.id, title: g.level.title, hints: g.level.hints },
    phase: g.phase, paused: g.paused, station: g.station, route: G.route(g), busy: g.busy?.kind ?? null,
    ticket: tk ? { id: tk.def.id, customer: tk.def.customer, order: o, text: tk.def.text.replace(/\{\{|\}\}/g, ''), attempts: tk.attempts, age_s: Math.round(tk.age / 1000) } : null,
    tickets: g.tickets.map((x) => ({ id: x.def.id, done: x.done, attempts: x.attempts, age_s: Math.round(x.age / 1000), stars: x.stars })),
    pie: { r: p.r, d: p.r * 2, count: p.count, area: round1(area(p.r)), sauce: p.sauce, squeezes: p.squeezes, cheese: p.cheese, rope_pulled: p.rope, toppings: p.toppings.length, baked: p.baked, dough_defect: p.tore },
    required: t && o ? {
      r: t.r, count: t.count,
      sauce_cm2: o.sauce && p.r ? { want: round1(sauceRange(p.r).want), min: round1(sauceRange(p.r).min), max: round1(sauceRange(p.r).max), for_r: p.r } : null,
      crust_cm: o.crust && p.r ? { want: round1(crustRange(p.r).want), min: round1(crustRange(p.r).min), max: round1(crustRange(p.r).max), for_r: p.r } : null,
      water_g: o.mix ? { ...waterRange(o.mix, g.mix.flour) } : null,
      circumference_at_target: round1(circumference(t.r)),
    } : null,
    mix: g.level.tickets[0].order.mix ? g.mix : null,
    sauce_dial: g.sauceDial,
    stock: Object.fromEntries(Object.entries(g.stock).map(([k, v]) => [k, round1(v)])),
    shift_left_s: g.shiftLeft === null ? null : Math.round(g.shiftLeft / 1000),
    last_outcome: g.lastOutcome,
    result: g.result ? { outcome: g.result.verdict.outcome, stars: g.result.verdict.stars, tips: g.result.tips, reasons: g.result.verdict.reasons } : null,
    tips_total: g.tipsTotal, hints_used: g.hintsUsed, calculator_uses: g.calcUses,
    overlay: $('#overlay').classList.contains('hidden') ? null : (titleShown ? 'title' : g.phase),
    models: scene.modelInfo, models_ready: modelsReady, fps: scene.fps,
  };
}
const w = window as unknown as Record<string, unknown>;
w.render_game_to_text = () => JSON.stringify(stateForText());
w.advanceTime = (ms: number) => {
  manualClock = true;
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i++) { G.update(g, ms / steps); step(ms / steps / 1000); }
};
w.pizza = { get state() { return g; }, G, act, scene, goLevel: (i: number) => { titleShown = false; g = G.createGame(i, save.stars); shownPhase = ''; renderHud(true); } };

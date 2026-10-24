// Deterministic game state machine. Pure TS (no Three.js, no DOM): the scene and HUD render it.
import { LEVELS, type LevelDef, type TicketDef } from './levels';
import {
  area, circumference, crustRange, doughQuality, judge, MAX_R, MIN_R, outOfStock, round1, sauceRange, snapHalf, target, tips,
  waterRange, type DoughQuality, type ShortOf, type Stock, type Verdict,
} from './rules';

export type Station = 'mix' | 'dough' | 'sauce' | 'crust' | 'toppings' | 'oven';
export const STATIONS: Station[] = ['mix', 'dough', 'sauce', 'crust', 'toppings', 'oven'];
export type ToppingKind = 'basil' | 'pepperoni' | 'olive' | 'mushroom';
export interface Topping { kind: ToppingKind; x: number; z: number; rot: number; pie: number }

export interface PieState {
  r: number; // cm, 0 = still a dough ball
  count: 1 | 2;
  sauce: number; // cm² per pie
  squeezes: number;
  cheese: number | null;
  rope: number; // cm of rope pulled out, not cut yet
  toppings: Topping[];
  baked: boolean;
  tore: 'tear' | 'crack' | null;
}

export interface MixState { flour: number; water: number; kneaded: boolean; quality: DoughQuality | null }
export interface TicketState { def: TicketDef; done: boolean; attempts: number; age: number; stars: number }
export type Busy = { kind: 'squeeze' | 'cleanup' | 'bake' | 'cut' | 'knead'; left: number; total: number } | null;
export type Phase = 'intro' | 'playing' | 'result' | 'levelDone' | 'shiftOver' | 'finished';

export interface Result { ticketId: string; verdict: Verdict; tips: number; seconds: number; pie: PieState }
export interface GameEvent { t: number; level: string; ticket: string | null; action: string; values?: Record<string, number | string | boolean>; outcome?: string; hint?: boolean; attempt?: number }
export type Cue = { kind: string; values?: Record<string, number | string> };

export interface GameState {
  levelIndex: number;
  level: LevelDef;
  phase: Phase;
  paused: boolean;
  station: Station;
  tickets: TicketState[];
  active: number;
  pie: PieState;
  mix: MixState;
  stock: Stock;
  sauceDial: number;
  clock: number; // ms elapsed in this level
  shiftLeft: number | null; // ms, rush hour only
  busy: Busy;
  result: Result | null;
  shortOf: ShortOf | 'time' | null;
  hintsUsed: number;
  calcUses: number;
  tipsTotal: number;
  starsByLevel: number[];
  lastOutcome: string | null;
  saidTray: boolean;
  events: GameEvent[];
  cues: Cue[]; // one-shot effects for the scene/audio to consume
  seed: number;
}

const freshPie = (): PieState => ({ r: 0, count: 1, sauce: 0, squeezes: 0, cheese: null, rope: 0, toppings: [], baked: false, tore: null });

export function createGame(levelIndex = 0, starsByLevel: number[] = []): GameState {
  const level = LEVELS[levelIndex];
  const mix = level.tickets[0].order.mix;
  return {
    levelIndex, level, phase: 'intro', paused: false,
    station: mix ? 'mix' : 'dough',
    tickets: level.tickets.map((def) => ({ def, done: false, attempts: 0, age: 0, stars: 0 })),
    active: 0,
    pie: freshPie(),
    mix: { flour: mix?.flour ?? 0, water: 0, kneaded: !mix, quality: mix ? null : 'good' },
    stock: { ...level.stock },
    sauceDial: 0,
    clock: 0,
    shiftLeft: level.shiftSeconds ? level.shiftSeconds * 1000 : null,
    busy: null, result: null, shortOf: null,
    hintsUsed: 0, calcUses: 0, tipsTotal: 0, starsByLevel: [...starsByLevel],
    lastOutcome: null, saidTray: false, events: [], cues: [], seed: 1234 + levelIndex * 97,
  };
}

export const activeTicket = (g: GameState) => g.tickets[g.active];
const order = (g: GameState) => activeTicket(g).def.order;
const rand = (g: GameState) => { g.seed = (g.seed * 1664525 + 1013904223) % 4294967296; return g.seed / 4294967296; };

function log(g: GameState, action: string, values?: GameEvent['values'], outcome?: string, hint?: boolean) {
  const tk = activeTicket(g);
  g.events.push({ t: Math.round(g.clock), level: g.level.id, ticket: tk?.def.id ?? null, action, values, outcome, hint, attempt: tk ? tk.attempts + 1 : undefined });
  if (g.events.length > 500) g.events.splice(0, g.events.length - 500);
}
const cue = (g: GameState, kind: string, values?: Cue['values']) => g.cues.push({ kind, values });
const say = (g: GameState, line: string) => cue(g, 'say', { line });

function canAct(g: GameState) { return g.phase === 'playing' && !g.paused && !g.busy; }

export function start(g: GameState) {
  if (g.phase !== 'intro') return;
  g.phase = 'playing';
  log(g, 'level_start');
  cue(g, 'ticket');
}

/** Stations this ticket uses; toppings is always optional. */
export function route(g: GameState): Station[] {
  const o = order(g);
  return STATIONS.filter((s) => (s === 'mix' ? !!o.mix : s === 'sauce' ? o.sauce : s === 'crust' ? o.crust : true));
}

export function goStation(g: GameState, s: Station) {
  if (g.phase !== 'playing' || g.paused) return;
  if (!route(g).includes(s)) return;
  if (g.station === s) return;
  g.station = s;
  cue(g, 'station', { station: s });
}

export function nextStation(g: GameState, dir: 1 | -1 = 1) {
  const r = route(g);
  const i = r.indexOf(g.station);
  const n = r[Math.max(0, Math.min(r.length - 1, i + dir))];
  goStation(g, n);
}

// ---------- mixing (level 6) ----------
export function pour(g: GameState, what: 'water' | 'flour', grams: number) {
  if (!canAct(g) || g.station !== 'mix' || g.mix.kneaded) return;
  const key = what === 'water' ? 'water' : 'flour';
  const amount = Math.max(0, Math.min(grams, g.stock[key]));
  if (amount <= 0) { say(g, what === 'water' ? 'נגמרו המים בכד!' : 'נגמר הקמח בשק!'); return; }
  g.stock[key] -= amount;
  g.mix[what] = round1(g.mix[what] + amount);
  cue(g, 'pour', { what, grams: amount });
}

export function knead(g: GameState) {
  const o = order(g);
  if (!canAct(g) || g.station !== 'mix' || !o.mix || g.mix.kneaded) return;
  if (g.mix.water <= 0) { say(g, 'בלי מים זה סתם ערימת קמח. מזגו קודם מים.'); return; }
  g.mix.quality = doughQuality(o.mix, g.mix.flour, g.mix.water);
  g.mix.kneaded = true;
  g.busy = { kind: 'knead', left: 1200, total: 1200 };
  const wr = waterRange(o.mix, g.mix.flour);
  log(g, 'knead', { flour: g.mix.flour, water: g.mix.water, water_needed_for_flour: round1(wr.want) }, g.mix.quality);
  cue(g, 'knead', { quality: g.mix.quality });
}

/** Return a torn or cracked ball to the bowl to fix the ratio. */
export function backToBowl(g: GameState) {
  if (!canAct(g) || !order(g).mix || !g.mix.kneaded) return;
  g.mix.kneaded = false; g.mix.quality = null;
  g.pie = freshPie();
  g.station = 'mix';
  log(g, 'back_to_bowl', { flour: g.mix.flour, water: g.mix.water });
  cue(g, 'station', { station: 'mix' });
}

// ---------- dough ----------
const maxRadiusFromStock = (g: GameState) => Math.sqrt(g.stock.dough / (g.pie.count * Math.PI));

export function setRadius(g: GameState, rawCm: number) {
  if (!canAct(g) || g.station !== 'dough') return;
  if (!g.mix.kneaded) { say(g, 'קודם צריך ללוש בצק בקערה.'); return; }
  if (g.pie.sauce > 0) { say(g, 'הבצק כבר מרוח ברוטב — אי אפשר למתוח אותו עכשיו.'); return; }
  let r = Math.max(MIN_R, Math.min(MAX_R, snapHalf(rawCm)));
  const cap = Math.floor(maxRadiusFromStock(g) * 2) / 2;
  if (r > cap) { r = cap; cue(g, 'stock_cap'); }
  // Wet dough tears, dry dough cracks, once stretched past a small disc.
  if (g.mix.quality && g.mix.quality !== 'good' && r > 7) {
    r = 7;
    if (!g.pie.tore) {
      g.pie.tore = g.mix.quality === 'wet' ? 'tear' : 'crack';
      log(g, 'dough_failed', { flour: g.mix.flour, water: g.mix.water }, g.pie.tore);
      cue(g, g.pie.tore);
      say(g, g.pie.tore === 'tear' ? 'אוי! הבצק דביק ונקרע — יש בו יותר מדי מים ביחס לקמח.' : 'הבצק נסדק — חסרים בו מים ביחס לקמח.');
    }
  }
  if (r === g.pie.r) return;
  g.pie.r = r;
  cue(g, 'stretch', { r });
  const t = target(order(g));
  if (!g.saidTray && r >= Math.max(t.r * 1.8, t.r + 8)) {
    g.saidTray = true;
    cue(g, 'tray');
    say(g, 'וואו, זה כבר מגש! בטוחים שזה הגודל?');
  }
}

export function commitDough(g: GameState) {
  if (g.pie.r > 0) log(g, 'stretch', { r: g.pie.r, d: g.pie.r * 2, area: round1(area(g.pie.r)), count: g.pie.count });
}

export function setCount(g: GameState, count: 1 | 2) {
  if (!canAct(g) || g.station !== 'dough' || order(g).dough.kind !== 'bestDeal') return;
  if (g.pie.sauce > 0 || g.pie.count === count) return;
  g.pie.count = count;
  const cap = Math.floor(maxRadiusFromStock(g) * 2) / 2;
  if (g.pie.r > cap) g.pie.r = cap;
  log(g, 'deal_choice', { count });
  cue(g, 'split', { count });
}

// ---------- sauce ----------
export function setSauceDial(g: GameState, v: number) {
  g.sauceDial = Math.max(0, Math.min(3000, Math.round(v)));
}

export function squeeze(g: GameState) {
  if (!canAct(g) || g.station !== 'sauce') return;
  if (g.pie.r <= 0) { say(g, 'אין על מה למרוח — קודם מותחים בצק.'); return; }
  if (g.pie.baked) return;
  if (g.sauceDial <= 0) { say(g, 'כוונו את החוגה לכמות הרוטב בסמ״ר.'); return; }
  if (g.pie.squeezes >= 2) { say(g, 'הבקבוק מרשה רק תוספת אחת. אם צריך — מתחילים פיצה מחדש.'); return; }
  const per = Math.min(g.sauceDial, g.stock.sauce / g.pie.count);
  if (per <= 0) return;
  g.stock.sauce -= per * g.pie.count;
  g.pie.sauce = round1(g.pie.sauce + per);
  g.pie.squeezes++;
  const range = sauceRange(g.pie.r);
  const over = g.pie.sauce > range.max;
  g.busy = over ? { kind: 'cleanup', left: 2600, total: 2600 } : { kind: 'squeeze', left: 900, total: 900 };
  log(g, 'squeeze', { dial: g.sauceDial, total: g.pie.sauce, needed: round1(range.want), r: g.pie.r }, over ? 'overflow' : g.pie.sauce < range.min ? 'bare_ring' : 'covered');
  cue(g, over ? 'overflow' : 'squeeze', { total: g.pie.sauce });
  if (over) say(g, `שיטפון! ${round1(g.pie.sauce - range.want)} סמ״ר רוטב על השיש. מנגבים…`);
  else if (g.pie.sauce < range.min) say(g, 'נשארה טבעת בצק חשופה. אפשר להוסיף פעם אחת — כמה חסר?');
  checkStock(g);
}

// ---------- cheese crust ----------
export function setRope(g: GameState, cm: number) {
  if (!canAct(g) || g.station !== 'crust' || g.pie.cheese !== null) return;
  g.pie.rope = Math.max(0, Math.min(120, Math.min(g.stock.cheese, snapHalf(cm))));
}

export function cut(g: GameState) {
  if (!canAct(g) || g.station !== 'crust') return;
  if (g.pie.r <= 0) { say(g, 'קודם בצק, אחר כך קרום.'); return; }
  if (g.pie.cheese !== null) { say(g, 'כבר יש קרום. רוצים אחר? הסירו אותו קודם.'); return; }
  if (g.pie.rope <= 0) { say(g, 'משכו את חבל הגבינה לאורך הרצוי.'); return; }
  g.stock.cheese = round1(g.stock.cheese - g.pie.rope);
  g.pie.cheese = g.pie.rope;
  g.pie.rope = 0;
  g.busy = { kind: 'cut', left: 1300, total: 1300 };
  const range = crustRange(g.pie.r);
  const outcome = g.pie.cheese < range.min ? 'gap' : g.pie.cheese > range.max ? 'overlap' : 'sealed';
  log(g, 'cut_crust', { length: g.pie.cheese, needed: round1(range.want), r: g.pie.r }, outcome);
  cue(g, 'cut', { outcome });
  if (outcome === 'gap') say(g, `חסר קרום! יש פער של ${round1(range.want - g.pie.cheese)} ס״מ.`);
  if (outcome === 'overlap') say(g, 'החבל ארוך מדי — נוצר גוש כפול. חבל על הגבינה.');
  checkStock(g);
}

export function removeCrust(g: GameState) {
  if (!canAct(g) || g.pie.cheese === null || g.pie.baked) return;
  log(g, 'remove_crust', { wasted_cm: g.pie.cheese });
  g.pie.cheese = null;
  cue(g, 'trash');
  checkStock(g);
}

// ---------- toppings (optional, just for fun and a small tip) ----------
export function addTopping(g: GameState, kind: ToppingKind) {
  if (!canAct(g) || g.station !== 'toppings' || g.pie.r <= 0 || g.pie.baked) return;
  if (g.pie.toppings.length >= 30) return;
  const pie = g.pie.count === 2 ? (g.pie.toppings.length % 2) : 0;
  const rr = Math.sqrt(rand(g)) * g.pie.r * 0.78;
  const a = rand(g) * Math.PI * 2;
  g.pie.toppings.push({ kind, x: Math.cos(a) * rr, z: Math.sin(a) * rr, rot: rand(g) * Math.PI * 2, pie });
  cue(g, 'topping', { kind });
}

// ---------- oven + serve ----------
export function bake(g: GameState) {
  if (!canAct(g) || g.station !== 'oven') return;
  if (g.pie.r <= 0) { say(g, 'התנור חם, אבל אין בו כלום. קודם בצק!'); return; }
  if (g.pie.baked) return;
  g.busy = { kind: 'bake', left: 2600, total: 2600 };
  log(g, 'bake', { r: g.pie.r, sauce: g.pie.sauce, cheese: g.pie.cheese ?? 0 });
  cue(g, 'bake_start');
}

export function serve(g: GameState) {
  if (!canAct(g)) return;
  if (!g.pie.baked) { say(g, 'קודם לתנור, אחר כך לפעמון!'); return; }
  const tk = activeTicket(g);
  const v = judge(tk.def.order, { r: g.pie.r, count: g.pie.count, sauce: g.pie.sauce, cheese: g.pie.cheese, toppings: g.pie.toppings.length });
  const seconds = Math.round(tk.age / 1000);
  const t = tips(v, seconds, g.pie.toppings.length);
  g.stock.dough -= g.pie.count * area(g.pie.r);
  g.result = { ticketId: tk.def.id, verdict: v, tips: t, seconds, pie: structuredClone(g.pie) };
  g.lastOutcome = v.reasons.length ? v.reasons.map((r) => `${r.code}: ${Object.values(r.values).at(-1)}`).join(', ') : 'perfect';
  g.tipsTotal += t;
  tk.attempts++;
  if (v.outcome !== 'fail') { tk.done = true; tk.stars = Math.max(tk.stars, v.stars); }
  g.phase = 'result';
  log(g, 'serve', { r: g.pie.r, count: g.pie.count, sauce: g.pie.sauce, cheese: g.pie.cheese ?? 0, seconds, hints: g.hintsUsed }, v.outcome);
  cue(g, 'serve', { outcome: v.outcome });
}

/** Called after the player reads the customer's reaction. */
export function continueAfterResult(g: GameState) {
  if (g.phase !== 'result') return;
  g.result = null;
  g.pie = freshPie();
  g.sauceDial = 0;
  g.saidTray = false;
  const open = g.tickets.findIndex((t) => !t.done);
  if (open < 0) {
    const stars = Math.round(g.tickets.reduce((s, t) => s + t.stars, 0) / g.tickets.length);
    g.starsByLevel[g.levelIndex] = Math.max(g.starsByLevel[g.levelIndex] ?? 0, stars);
    g.phase = g.levelIndex === LEVELS.length - 1 ? 'finished' : 'levelDone';
    log(g, 'level_done', { stars, tips: g.tipsTotal, hints: g.hintsUsed });
    cue(g, 'level_done');
    return;
  }
  if (activeTicket(g).done) g.active = open;
  g.phase = 'playing';
  const mix = order(g).mix;
  if (mix) g.mix = { flour: mix.flour, water: 0, kneaded: false, quality: null };
  g.station = mix ? 'mix' : 'dough';
  cue(g, 'station', { station: g.station });
  checkStock(g);
}

export function selectTicket(g: GameState, i: number) {
  if (g.phase !== 'playing' || !g.tickets[i] || g.tickets[i].done || i === g.active) return;
  g.active = i;
  if (!route(g).includes(g.station)) g.station = 'dough';
  log(g, 'select_ticket');
  cue(g, 'ticket');
}

/** Toss the pie and start again. Sauced dough is wasted; a plain ball is just re-rolled. */
export function trashPie(g: GameState) {
  if (!canAct(g) || g.pie.r <= 0) return;
  if (g.pie.sauce > 0 || g.pie.cheese !== null || g.pie.baked) g.stock.dough -= g.pie.count * area(g.pie.r);
  log(g, 'trash_pie', { r: g.pie.r, sauce: g.pie.sauce, cheese: g.pie.cheese ?? 0 });
  const count = g.pie.count;
  g.pie = { ...freshPie(), count };
  if (order(g).mix && g.mix.quality !== 'good') { g.mix.kneaded = false; g.mix.quality = null; g.station = 'mix'; }
  else g.station = 'dough';
  cue(g, 'trash');
  cue(g, 'station', { station: g.station });
  checkStock(g);
}

export function useHint(g: GameState) {
  if (!g.level.hints || g.phase !== 'playing') return null;
  g.hintsUsed++;
  log(g, 'hint', { station: g.station }, undefined, true);
  return hintText(g);
}

export function noteCalculator(g: GameState, expr: string, value: number) {
  g.calcUses++;
  log(g, 'calculator', { expr, value: round1(value) });
}

/** The chef's notebook: the formula with the current numbers plugged in, never the result. */
export function hintText(g: GameState): string {
  const o = order(g);
  const r = g.pie.r;
  const s = o.dough;
  switch (g.station) {
    case 'mix': return o.mix ? `קמח : מים = 5 : 3 ⇐ מים = {{${g.mix.flour} × 3 ÷ 5}} גרם` : '';
    case 'dough':
      if (s.kind === 'byDiameter') return `רדיוס = קוטר ÷ 2 ⇐ {{r = ${s.d} ÷ 2}}`;
      if (s.kind === 'byRadius') return `ההזמנה כבר נותנת רדיוס: {{r = ${s.r}}}`;
      if (s.kind === 'minArea') return `מחפשים r קטן ככל האפשר כך ש־{{π × r² ≥ ${s.minArea}}}. נסו: {{3.14 × ${r || 10}²}}`;
      if (s.kind === 'percentLarger') return `מקדם כיפלי לעלייה של {{${s.percent}%}}: {{1 + ${s.percent}/100}}. קוטר חדש = {{${s.baseD} × מקדם}}, ואז רדיוס = קוטר ÷ 2`;
      return `שטח כולל = מספר פיצות × π × r². השוו: {{1 × 3.14 × 20²}} מול {{2 × 3.14 × 14²}}`;
    case 'sauce':
      if (s.kind === 'percentLarger') return `כשהקוטר גדל פי k, השטח גדל פי k² (יחס שטחים). כאן {{k = 1 + ${s.percent}/100}}. או ישר: {{π × ${r || 'r'}²}}`;
      return `שטח עיגול = π × r² ⇐ {{3.14 × ${r || 'r'}²}}${g.pie.count === 2 ? ' (לכל פיצה)' : ''}`;
    case 'crust': return `היקף מעגל = 2 × π × r ⇐ {{2 × 3.14 × ${r || 'r'}}}`;
    default: return 'כמעט שם! לתנור ואז לפעמון.';
  }
}

function checkStock(g: GameState) {
  if (g.phase !== 'playing') return;
  const open = g.tickets.filter((t) => !t.done).map((t) => t.def.order);
  // Stock already spent on the pie in progress still counts: it can be served.
  const inPie = { ...g.stock };
  if (g.pie.sauce > 0) inPie.sauce += g.pie.sauce * g.pie.count;
  if (g.pie.cheese !== null) inPie.cheese += g.pie.cheese;
  const short = outOfStock(inPie, open);
  if (short) {
    g.shortOf = short;
    g.phase = 'shiftOver';
    log(g, 'shift_over', { short_of: short });
    cue(g, 'shift_over');
  }
}

export function update(g: GameState, ms: number) {
  if (g.paused || (g.phase !== 'playing' && g.phase !== 'result')) return;
  g.clock += ms;
  if (g.phase === 'playing') for (const t of g.tickets) if (!t.done) t.age += ms;
  if (g.shiftLeft !== null && g.phase === 'playing') {
    g.shiftLeft = Math.max(0, g.shiftLeft - ms);
    if (g.shiftLeft === 0) {
      g.shortOf = 'time';
      g.phase = 'shiftOver';
      log(g, 'shift_over', { short_of: 'time' });
      cue(g, 'shift_over');
      return;
    }
  }
  if (g.busy) {
    g.busy.left -= ms;
    if (g.busy.left <= 0) {
      const kind = g.busy.kind;
      g.busy = null;
      if (kind === 'bake') { g.pie.baked = true; cue(g, 'bake_done'); bakeComments(g); }
    }
  }
}

function bakeComments(g: GameState) {
  const o = order(g);
  if (o.sauce && g.pie.sauce < sauceRange(g.pie.r).min) say(g, 'הטבעת החשופה נשרפה בתנור…');
  if (o.crust && (g.pie.cheese ?? 0) < crustRange(g.pie.r).min) say(g, 'הגבינה נוזלת מהחור בקרום כמו לבה!');
  if (!o.sauce && !o.crust) say(g, 'ריח מעולה! לפעמון.');
}

export function restartLevel(g: GameState): GameState {
  const n = createGame(g.levelIndex, g.starsByLevel);
  n.events = g.events;
  n.events.push({ t: 0, level: n.level.id, ticket: null, action: 'restart' });
  return n;
}

export function nextLevel(g: GameState): GameState {
  const n = createGame(Math.min(g.levelIndex + 1, LEVELS.length - 1), g.starsByLevel);
  n.events = g.events;
  n.tipsTotal = g.tipsTotal;
  return n;
}

export { area, circumference, sauceRange, crustRange, target };

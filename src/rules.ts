// Pure pizza math and judging. No Three.js or DOM here: the scene only renders this state.

export const area = (r: number) => Math.PI * r * r;
export const circumference = (r: number) => 2 * Math.PI * r;
export const diameter = (r: number) => 2 * r;
export const snapHalf = (x: number) => Math.round(x * 2) / 2;
export const round1 = (x: number) => Math.round(x * 10) / 10;

export const SAUCE_TOL = 0.05;
export const CRUST_TOL = 0.04;
export const RATIO_TOL = 0.03;
export const MIN_R = 4;
export const MAX_R = 25;

export type DoughSpec =
  | { kind: 'byDiameter'; d: number }
  | { kind: 'byRadius'; r: number }
  | { kind: 'minArea'; minArea: number; people?: number; perPerson?: number }
  | { kind: 'percentLarger'; baseD: number; percent: number }
  | { kind: 'bestDeal'; options: { count: 1 | 2; d: number }[] };

export interface MixSpec { flour: number; ratioFlour: number; ratioWater: number }

export interface Order {
  dough: DoughSpec;
  sauce: boolean;
  crust: boolean;
  mix?: MixSpec;
}

/** Smallest radius on the 0.5 cm grid whose disc area reaches the target. */
export function minRadiusForArea(target: number): number {
  let r = snapHalf(Math.sqrt(target / Math.PI));
  while (area(r) < target) r += 0.5;
  while (r - 0.5 > 0 && area(r - 0.5) >= target) r -= 0.5;
  return r;
}

export function dealTotal(o: { count: number; d: number }) {
  return o.count * area(o.d / 2);
}

export function bestDealOption(spec: Extract<DoughSpec, { kind: 'bestDeal' }>) {
  return [...spec.options].sort((a, b) => dealTotal(b) - dealTotal(a))[0];
}

/** The radius (cm) the order wants, plus how many pies. For deals: the best option. */
export function target(order: Order): { r: number; count: 1 | 2 } {
  const s = order.dough;
  switch (s.kind) {
    case 'byDiameter': return { r: s.d / 2, count: 1 };
    case 'byRadius': return { r: s.r, count: 1 };
    case 'minArea': return { r: minRadiusForArea(s.minArea), count: 1 };
    case 'percentLarger': return { r: (s.baseD * (1 + s.percent / 100)) / 2, count: 1 };
    case 'bestDeal': { const b = bestDealOption(s); return { r: b.d / 2, count: b.count }; }
  }
}

export interface Range { want: number; min: number; max: number }
const tol = (want: number, t: number): Range => ({ want, min: want * (1 - t), max: want * (1 + t) });

/** Required sauce (per pie) and cheese for the pie actually stretched: sauce covers the disc, crust runs its rim. */
export const sauceRange = (r: number) => tol(area(r), SAUCE_TOL);
export const crustRange = (r: number) => tol(circumference(r), CRUST_TOL);
export function waterRange(mix: MixSpec, flour: number): Range {
  return tol((flour * mix.ratioWater) / mix.ratioFlour, RATIO_TOL);
}

export type DoughQuality = 'good' | 'wet' | 'dry';
/** Compares flour:water against the recipe ratio (±3% of the ratio). */
export function doughQuality(mix: MixSpec, flour: number, water: number): DoughQuality {
  if (water <= 0) return 'dry';
  const want = mix.ratioFlour / mix.ratioWater;
  const got = flour / water;
  if (got < want * (1 - RATIO_TOL)) return 'wet';
  if (got > want * (1 + RATIO_TOL)) return 'dry';
  return 'good';
}

export interface Pie {
  r: number;
  count: 1 | 2;
  sauce: number; // cm² per pie
  cheese: number | null; // cm of rope wrapped, null when none
  toppings: number;
}

export type Severity = 'fail' | 'ok';
export interface Reason { code: string; severity: Severity; values: Record<string, number> }
export type Outcome = 'perfect' | 'ok' | 'fail';
export interface Verdict { outcome: Outcome; reasons: Reason[]; stars: 0 | 1 | 2 | 3; want: { r: number; count: number; sauce?: Range; crust?: Range } }

const rv = (x: number) => round1(x);

/** Judges a finished pie against its order. Every wrong size names the classic mistake when it can. */
export function judge(order: Order, pie: Pie): Verdict {
  const t = target(order);
  const reasons: Reason[] = [];
  const s = order.dough;
  const push = (code: string, severity: Severity, values: Record<string, number>) => reasons.push({ code, severity, values });

  if (s.kind === 'bestDeal') {
    const chosen = s.options.find((o) => o.count === pie.count);
    if (!chosen || Math.abs(pie.r - chosen.d / 2) > 1e-9) {
      push('dough_radius_wrong', 'fail', { got_r: pie.r, want_r: chosen ? chosen.d / 2 : t.r });
    } else if (pie.count !== t.count) {
      push('deal_less_pizza_by_cm2', 'fail', { got_cm2: rv(dealTotal(chosen)), best_cm2: rv(dealTotal(bestDealOption(s))), less_by_cm2: rv(dealTotal(bestDealOption(s)) - dealTotal(chosen)) });
    }
  } else if (s.kind === 'minArea') {
    const got = area(pie.r);
    if (got < s.minArea) push('area_short_by_cm2', 'fail', { got_cm2: rv(got), need_cm2: s.minArea, short_by_cm2: rv(s.minArea - got) });
    else if (pie.r > t.r) push('dough_wasted_cm2', 'ok', { got_cm2: rv(got), best_cm2: rv(area(t.r)), wasted_cm2: rv(got - area(t.r)) });
  } else if (Math.abs(pie.r - t.r) > 1e-9) {
    const values = { got_r: pie.r, want_r: t.r };
    if (Math.abs(pie.r - 2 * t.r) < 1e-9) push('used_diameter_as_radius', 'fail', values);
    else if (Math.abs(pie.r - t.r / 2) < 1e-9) push('used_radius_as_diameter', 'fail', values);
    else if (s.kind === 'percentLarger' && Math.abs(pie.r - s.baseD / 2) < 1e-9) push('forgot_to_enlarge', 'fail', values);
    else push(pie.r > t.r ? 'dough_too_big' : 'dough_too_small', 'fail', values);
  }

  let sauce: Range | undefined;
  if (order.sauce) {
    sauce = sauceRange(pie.r);
    if (pie.sauce < sauce.min) {
      const values: Record<string, number> = { got_cm2: rv(pie.sauce), want_cm2: rv(sauce.want), short_by_cm2: rv(sauce.want - pie.sauce) };
      if (s.kind === 'percentLarger') {
        const linear = area(s.baseD / 2) * (1 + s.percent / 100);
        if (Math.abs(pie.sauce - linear) <= linear * SAUCE_TOL) { push('sauce_scaled_linearly', 'fail', { ...values, factor_used: 1 + s.percent / 100, factor_needed: rv(((1 + s.percent / 100) ** 2) * 100) / 100 }); }
        else push('sauce_short_by_cm2', 'fail', values);
      } else if (Math.abs(pie.sauce - circumference(pie.r)) <= circumference(pie.r) * SAUCE_TOL) {
        push('sauce_used_circumference', 'fail', values);
      } else push('sauce_short_by_cm2', 'fail', values);
    } else if (pie.sauce > sauce.max) {
      push('sauce_over_by_cm2', 'ok', { got_cm2: rv(pie.sauce), want_cm2: rv(sauce.want), over_by_cm2: rv(pie.sauce - sauce.want) });
    }
  }

  let crust: Range | undefined;
  if (order.crust) {
    crust = crustRange(pie.r);
    const got = pie.cheese ?? 0;
    if (got < crust.min) {
      const values = { got_cm: rv(got), want_cm: rv(crust.want), gap_cm: rv(crust.want - got) };
      if (pie.cheese !== null && Math.abs(got - area(pie.r)) <= area(pie.r) * CRUST_TOL) push('crust_used_area', 'fail', values);
      else if (pie.cheese !== null && Math.abs(got - Math.PI * pie.r) <= Math.PI * pie.r * CRUST_TOL) push('crust_used_pi_r', 'fail', values);
      else push('crust_gap_cm', 'fail', values);
    } else if (got > crust.max) {
      push('crust_overlap_cm', 'ok', { got_cm: rv(got), want_cm: rv(crust.want), overlap_cm: rv(got - crust.want) });
    }
  }

  const fails = reasons.filter((x) => x.severity === 'fail').length;
  const oks = reasons.length - fails;
  const outcome: Outcome = fails ? 'fail' : oks ? 'ok' : 'perfect';
  const stars = outcome === 'fail' ? 0 : outcome === 'ok' ? (oks > 1 ? 1 : 2) : 3;
  return { outcome, reasons, stars, want: { r: t.r, count: t.count, sauce, crust } };
}

/** Tips never go negative: accuracy plus a little speed bonus. */
export function tips(v: Verdict, seconds: number, toppings: number): number {
  if (v.outcome === 'fail') return 0;
  const base = v.stars * 4;
  const speed = seconds < 30 ? 4 : seconds < 60 ? 2 : seconds < 90 ? 1 : 0;
  const garnish = Math.min(Math.floor(toppings / 3), 2);
  return base + speed + garnish;
}

export interface Stock { dough: number; sauce: number; cheese: number; flour: number; water: number }

/** What a correct pie for this order costs, at the low end of each tolerance. */
export function minimumNeed(order: Order) {
  const t = target(order);
  return {
    dough: t.count * area(t.r),
    sauce: order.sauce ? t.count * sauceRange(t.r).min : 0,
    cheese: order.crust ? crustRange(t.r).min : 0,
  };
}

export type ShortOf = keyof Pick<Stock, 'dough' | 'sauce' | 'cheese'>;
/** Which stock can no longer cover a correct pie for any open ticket (null = still playable). */
export function outOfStock(stock: Stock, open: Order[]): ShortOf | null {
  if (!open.length) return null;
  for (const k of ['dough', 'sauce', 'cheese'] as const) {
    const cheapest = Math.min(...open.map((o) => minimumNeed(o)[k]));
    if (stock[k] + 1e-6 < cheapest) return k;
  }
  return null;
}

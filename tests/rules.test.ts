import { test } from 'node:test';
import assert from 'node:assert/strict';
import { area, circumference, crustRange, doughQuality, judge, minRadiusForArea, outOfStock, sauceRange, target, type Pie } from '../src/rules.ts';
import { LEVELS } from '../src/levels.ts';

const pie = (p: Partial<Pie>): Pie => ({ r: 10, count: 1, sauce: 0, cheese: null, toppings: 0, ...p });
const solve = (order: (typeof LEVELS)[number]['tickets'][number]['order']): Pie => {
  const t = target(order);
  return pie({ r: t.r, count: t.count, sauce: order.sauce ? area(t.r) : 0, cheese: order.crust ? circumference(t.r) : null });
};

test('circle formulas', () => {
  assert.equal(Math.round(area(10)), 314);
  assert.equal(Math.round(circumference(15) * 10) / 10, 94.2);
});

test('every authored ticket has a legal perfect solution', () => {
  for (const level of LEVELS) for (const tk of level.tickets) {
    const v = judge(tk.order, solve(tk.order));
    assert.equal(v.outcome, 'perfect', `${tk.id}: ${JSON.stringify(v.reasons)}`);
    // The intended solution stays within the shift's stock.
    const t = target(tk.order);
    assert.ok(level.stock.dough >= t.count * area(t.r), `${tk.id} dough stock`);
    assert.ok(level.stock.sauce >= (tk.order.sauce ? t.count * area(t.r) : 0), `${tk.id} sauce stock`);
    assert.ok(level.stock.cheese >= (tk.order.crust ? circumference(t.r) : 0), `${tk.id} cheese stock`);
  }
});

test('rush hour has enough stock for all four tickets together', () => {
  const l7 = LEVELS[6];
  let dough = 0, sauce = 0, cheese = 0;
  for (const tk of l7.tickets) { const t = target(tk.order); dough += area(t.r); sauce += area(t.r); cheese += tk.order.crust ? circumference(t.r) : 0; }
  assert.ok(l7.stock.dough >= dough && l7.stock.sauce >= sauce && l7.stock.cheese >= cheese);
  assert.equal(l7.hints, false);
});

test('L1: diameter 20 means r = 10; sauce window 298–330; r = 20 is the diameter-as-radius tray', () => {
  const o = LEVELS[0].tickets[0].order;
  assert.equal(target(o).r, 10);
  const s = sauceRange(10);
  assert.ok(s.min > 298 && s.min < 299 && s.max > 329 && s.max < 330);
  assert.equal(judge(o, pie({ r: 10, sauce: 300 })).outcome, 'perfect');
  assert.equal(judge(o, pie({ r: 20, sauce: area(20) })).reasons[0].code, 'used_diameter_as_radius');
  const short = judge(o, pie({ r: 10, sauce: 250 }));
  assert.equal(short.outcome, 'fail');
  assert.equal(short.reasons[0].code, 'sauce_short_by_cm2');
  assert.equal(short.reasons[0].values.short_by_cm2, 64.2);
  const flood = judge(o, pie({ r: 10, sauce: 400 }));
  assert.equal(flood.outcome, 'ok');
  assert.equal(flood.reasons[0].code, 'sauce_over_by_cm2');
  // Mixing up circumference and area for the sauce is named.
  assert.equal(judge(o, pie({ r: 10, sauce: 62.8 })).reasons[0].code, 'sauce_used_circumference');
});

test('L2: crust 94.2 cm ±4%; short leaves a gap, long a lumpy overlap', () => {
  const o = LEVELS[1].tickets[0].order;
  const c = crustRange(15);
  assert.equal(Math.round(c.want * 10) / 10, 94.2);
  assert.equal(judge(o, pie({ r: 15, sauce: area(15), cheese: 91 })).outcome, 'perfect');
  assert.equal(judge(o, pie({ r: 15, sauce: area(15), cheese: 97.5 })).outcome, 'perfect');
  const gap = judge(o, pie({ r: 15, sauce: area(15), cheese: 80 }));
  assert.equal(gap.reasons[0].code, 'crust_gap_cm');
  assert.equal(gap.reasons[0].values.gap_cm, 14.2);
  assert.equal(judge(o, pie({ r: 15, sauce: area(15), cheese: 110 })).reasons[0].code, 'crust_overlap_cm');
  // π·r (half the rim) is a named mistake.
  assert.equal(judge(o, pie({ r: 15, sauce: area(15), cheese: 47 })).reasons[0].code, 'crust_used_pi_r');
  // Using the radius-15 pie at diameter 15 is named too.
  assert.equal(judge(o, pie({ r: 7.5, sauce: area(7.5) })).reasons[0].code, 'used_radius_as_diameter');
});

test('L3: three kids × 200 cm² → smallest r on the 0.5 grid is 14', () => {
  assert.equal(minRadiusForArea(600), 14);
  assert.ok(area(13.5) < 600 && area(14) >= 600);
  const o = LEVELS[2].tickets[0].order;
  const small = judge(o, pie({ r: 13.5, sauce: area(13.5) }));
  assert.equal(small.outcome, 'fail');
  assert.equal(small.reasons[0].code, 'area_short_by_cm2');
  const big = judge(o, pie({ r: 15, sauce: area(15) }));
  assert.equal(big.outcome, 'ok');
  assert.equal(big.reasons[0].code, 'dough_wasted_cm2');
});

test('L4: 30% wider than d = 20 → d = 26; sauce ×1.69 not ×1.3', () => {
  const o = LEVELS[3].tickets[0].order;
  assert.ok(Math.abs(target(o).r - 13) < 1e-9);
  assert.equal(Math.round(area(13)), 531);
  assert.ok(Math.abs(area(13) / area(10) - 1.69) < 1e-9);
  const linear = judge(o, pie({ r: 13, sauce: 314 * 1.3 }));
  assert.equal(linear.outcome, 'fail');
  assert.equal(linear.reasons[0].code, 'sauce_scaled_linearly');
  assert.equal(judge(o, pie({ r: 10, sauce: 314 })).reasons[0].code, 'forgot_to_enlarge');
});

test('L5: one d = 40 (1256.6) beats two d = 28 (1231.5), barely', () => {
  const o = LEVELS[4].tickets[0].order;
  assert.deepEqual(target(o), { r: 20, count: 1 });
  assert.equal(judge(o, pie({ r: 20, count: 1, sauce: area(20) })).outcome, 'perfect');
  const two = judge(o, pie({ r: 14, count: 2, sauce: area(14) }));
  assert.equal(two.outcome, 'fail');
  assert.equal(two.reasons[0].code, 'deal_less_pizza_by_cm2');
  assert.equal(two.reasons[0].values.less_by_cm2, 25.1);
  assert.equal(judge(o, pie({ r: 14, count: 1, sauce: area(14) })).reasons[0].code, 'dough_radius_wrong');
});

test('L6: 900 g flour at 5 : 3 needs 540 g water', () => {
  const mix = LEVELS[5].tickets[0].order.mix!;
  assert.equal(doughQuality(mix, 900, 540), 'good');
  assert.equal(doughQuality(mix, 900, 530), 'good');
  assert.equal(doughQuality(mix, 900, 600), 'wet');
  assert.equal(doughQuality(mix, 900, 480), 'dry');
  // Fixing wet dough by proportion: 600 g water needs 1000 g flour.
  assert.equal(doughQuality(mix, 1000, 600), 'good');
});

test('L7 transfer numbers', () => {
  const [a, b, c, d] = LEVELS[6].tickets.map((t) => t.order);
  assert.equal(target(a).r, 15);
  assert.equal(Math.round(circumference(12) * 10) / 10, 75.4);
  assert.equal(target(c).r, 18);
  assert.equal(Math.round(area(18) * 10) / 10, 1017.9);
  assert.ok(Math.abs(target(d).r - 15) < 1e-9);
  assert.ok(Math.abs(area(15) / area(12.5) - 1.44) < 1e-9);
});

test('running out of a stock is detected for the open tickets', () => {
  const o = LEVELS[0].tickets[0].order;
  assert.equal(outOfStock({ dough: 2000, sauce: 1000, cheese: 0, flour: 0, water: 0 }, [o]), null);
  assert.equal(outOfStock({ dough: 200, sauce: 1000, cheese: 0, flour: 0, water: 0 }, [o]), 'dough');
  assert.equal(outOfStock({ dough: 2000, sauce: 100, cheese: 0, flour: 0, water: 0 }, [o]), 'sauce');
});

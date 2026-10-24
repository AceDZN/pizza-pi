import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/game.ts';
import { area, circumference } from '../src/rules.ts';

function playing(level: number) { const g = G.createGame(level); G.start(g); return g; }
function stretch(g: G.GameState, r: number) { G.goStation(g, 'dough'); G.setRadius(g, r); G.commitDough(g); }
function sauce(g: G.GameState, cm2: number) { G.goStation(g, 'sauce'); G.setSauceDial(g, cm2); G.squeeze(g); G.update(g, 3000); }
function crust(g: G.GameState, cm: number) { G.goStation(g, 'crust'); G.setRope(g, cm); G.cut(g); G.update(g, 2000); }
function bakeServe(g: G.GameState) { G.goStation(g, 'oven'); G.bake(g); G.update(g, 3000); G.serve(g); }

test('level 1 end to end: correct pie completes the level', () => {
  const g = playing(0);
  stretch(g, 10);
  sauce(g, 314);
  bakeServe(g);
  assert.equal(g.result?.verdict.outcome, 'perfect');
  G.continueAfterResult(g);
  assert.equal(g.phase, 'levelDone');
  assert.equal(g.starsByLevel[0], 3);
});

test('level 1: diameter-as-radius tray is funny, recoverable and costs dough', () => {
  const g = playing(0);
  stretch(g, 20);
  assert.ok(g.cues.some((c) => c.kind === 'tray'));
  sauce(g, Math.round(area(20)));
  bakeServe(g);
  assert.equal(g.result?.verdict.reasons[0].code, 'used_diameter_as_radius');
  G.continueAfterResult(g);
  assert.equal(g.phase, 'playing');
  assert.ok(g.stock.dough < 2600 - 1256);
  stretch(g, 10); sauce(g, 314); bakeServe(g);
  assert.equal(g.result?.verdict.outcome, 'perfect');
});

test('sauce overflow costs cleanup time; a short squeeze can be topped up once', () => {
  const g = playing(0);
  stretch(g, 10);
  G.goStation(g, 'sauce');
  G.setSauceDial(g, 200); G.squeeze(g);
  assert.equal(g.busy?.kind, 'squeeze');
  G.update(g, 1000);
  G.setSauceDial(g, 114); G.squeeze(g); G.update(g, 1000);
  assert.equal(g.pie.sauce, 314);
  G.setSauceDial(g, 50); G.squeeze(g);
  assert.equal(g.pie.squeezes, 2, 'a third squeeze is refused');
  const h = playing(0);
  stretch(h, 10); G.goStation(h, 'sauce'); G.setSauceDial(h, 500); G.squeeze(h);
  assert.equal(h.busy?.kind, 'cleanup');
  assert.ok(h.cues.some((c) => c.kind === 'overflow'));
});

test('level 2: a short rope leaves a gap and the ticket stays open', () => {
  const g = playing(1);
  stretch(g, 15); sauce(g, 707); crust(g, 80);
  bakeServe(g);
  assert.equal(g.result?.verdict.reasons[0].code, 'crust_gap_cm');
  G.continueAfterResult(g);
  assert.equal(g.tickets[0].done, false);
  stretch(g, 15); sauce(g, 707); crust(g, Math.round(circumference(15) * 2) / 2);
  bakeServe(g);
  assert.equal(g.result?.verdict.outcome, 'perfect');
});

test('level 5: choosing two mediums is revealed as less pizza', () => {
  const g = playing(4);
  G.goStation(g, 'dough'); G.setCount(g, 2); G.setRadius(g, 14);
  sauce(g, 616);
  bakeServe(g);
  assert.equal(g.result?.verdict.reasons[0].code, 'deal_less_pizza_by_cm2');
});

test('level 6: wet dough tears when stretched; adding flour by proportion fixes it', () => {
  const g = playing(5);
  assert.equal(g.station, 'mix');
  G.pour(g, 'water', 600); G.knead(g); G.update(g, 2000);
  assert.equal(g.mix.quality, 'wet');
  stretch(g, 12);
  assert.equal(g.pie.tore, 'tear');
  assert.equal(g.pie.r, 7);
  G.backToBowl(g);
  G.pour(g, 'flour', 100); G.knead(g); G.update(g, 2000);
  assert.equal(g.mix.quality, 'good');
  stretch(g, 12); sauce(g, 452); bakeServe(g);
  assert.equal(g.result?.verdict.outcome, 'perfect');
});

test('level 7: the shift clock runs out with a friendly summary state', () => {
  const g = playing(6);
  assert.equal(G.useHint(g), null, 'no hints in the transfer level');
  G.update(g, 151_000);
  assert.equal(g.phase, 'shiftOver');
  assert.equal(g.shortOf, 'time');
});

test('level 7: all four tickets can be served in any order', () => {
  const g = playing(6);
  const plan: [number, number, number, number | null][] = [[2, 18, 1018, null], [0, 15, 707, null], [1, 12, 452, 75.5], [3, 15, 707, null]];
  for (const [i, r, s, c] of plan) {
    G.selectTicket(g, i);
    stretch(g, r); sauce(g, s); if (c) crust(g, c);
    bakeServe(g);
    assert.equal(g.result?.verdict.outcome, 'perfect', JSON.stringify(g.result?.verdict.reasons));
    G.continueAfterResult(g);
  }
  assert.equal(g.phase, 'finished');
});

test('running out of sauce ends the shift early', () => {
  const g = playing(0);
  for (let i = 0; i < 3 && g.phase === 'playing'; i++) {
    stretch(g, 10); sauce(g, 1000);
    G.trashPie(g);
  }
  assert.equal(g.phase, 'shiftOver');
  assert.equal(g.shortOf, 'sauce');
  assert.ok(g.events.some((e) => e.action === 'shift_over'));
});

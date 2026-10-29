import { test } from "node:test";
import assert from "node:assert/strict";
import { countWatchers, targetLevel, stepLevel, barColor, jitter, isPanicking } from "../src/logic.js";

const vp = (x, y) => ({ x, y, width: 100, height: 100 });
const me = { sessionId: 1, position: { x: 50, y: 50 }, viewport: vp(0, 0) };

test("counts others whose viewport contains my cursor, ignoring me", () => {
  const others = [me, { sessionId: 2, viewport: vp(0, 0) }, { sessionId: 3, viewport: vp(500, 500) },
    { sessionId: 4, viewport: vp(40, 40) }];
  assert.equal(countWatchers(me, others), 2);
});

test("no cursor means no watchers", () => {
  assert.equal(countWatchers({ ...me, position: null }, [{ sessionId: 2, viewport: vp(0, 0) }]), 0);
});

test("target level clamps at 3 watchers", () => {
  assert.equal(targetLevel(0), 0);
  assert.equal(targetLevel(3), 1);
  assert.equal(targetLevel(7), 1);
  assert.ok(Math.abs(targetLevel(1) - 1 / 3) < 1e-9);
});

test("rises faster than it falls", () => {
  const up = stepLevel(0, 1, 0.1);
  const down = 1 - stepLevel(1, 0, 0.1);
  assert.ok(up > 0 && up < 1);
  assert.ok(up > down);
});

test("converges to target", () => {
  let l = 0;
  for (let i = 0; i < 300; i++) l = stepLevel(l, 1, 1 / 30);
  assert.equal(l, 1);
});

test("color goes green to red", () => {
  assert.ok(barColor(0).g > barColor(0).r);
  assert.ok(barColor(1).r > barColor(1).g);
});

test("only trembles when full with 3+ watchers", () => {
  assert.deepEqual(jitter(1, 2), { dx: 0, dy: 0, rot: 0 });
  assert.deepEqual(jitter(0.5, 3), { dx: 0, dy: 0, rot: 0 });
  assert.ok(isPanicking(1, 3));
  const j = jitter(1, 3, () => 1);
  assert.equal(j.dx, 3);
});

import { stepTilt, TILT } from "../src/logic.js";

test("tilts opposite to cursor motion and settles back to upright", () => {
  let tilt = { angle: 0, vel: 0 };
  for (let i = 0; i < 15; i++) tilt = stepTilt(tilt, 800, 1 / 30); // moving right
  assert.ok(tilt.angle < -5, `expected lean left, got ${tilt.angle}`);
  for (let i = 0; i < 120; i++) tilt = stepTilt(tilt, 0, 1 / 30); // stopped
  assert.ok(Math.abs(tilt.angle) < 0.5);
  let fast = { angle: 0, vel: 0 };
  for (let i = 0; i < 120; i++) fast = stepTilt(fast, -99999, 1 / 30);
  assert.ok(Math.abs(fast.angle - TILT.max) < 1);
});

import { Typer } from "../demo/typing.js";

test("demo typist: more typos when anxious, always ends with the right text", () => {
  const run = (level) => {
    const ty = new Typer(3);
    ty.start("Make the logo bigger, please", 0);
    for (let t = 0; t < 120 && !ty.done; t += 1 / 30) ty.update(t, level);
    return ty;
  };
  const calm = run(0), panic = run(1);
  assert.equal(calm.buf, calm.target);
  assert.equal(panic.buf, panic.target);
  assert.ok(panic.typos > calm.typos + 5);
  assert.ok(panic.backspaces >= panic.typos);
});

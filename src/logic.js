// Pure anxiety-bar logic shared by the plugin (code.js) and the demo page.
// build.mjs strips the `export` keywords when inlining this into code.js.

export const MAX_WATCHERS = 3;

// Bar size in screen pixels (the plugin divides by zoom to keep it constant on screen).
export const BAR = { width: 18, height: 64, pad: 3, offsetX: 22, offsetY: -78 };

export function inRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

// How many other people currently have my cursor inside their viewport.
export function countWatchers(me, others) {
  if (!me || !me.position) return 0;
  let n = 0;
  for (const o of others) {
    if (o.sessionId === me.sessionId) continue;
    if (o.viewport && inRect(me.position, o.viewport)) n++;
  }
  return n;
}

export function targetLevel(watchers) {
  return Math.min(Math.max(watchers, 0), MAX_WATCHERS) / MAX_WATCHERS;
}

// Exponential ease toward target: panic fast (~0.4s), calm down slowly (~1.5s).
export function stepLevel(level, target, dt) {
  const tau = target > level ? 0.4 / 3 : 1.5 / 3;
  const k = 1 - Math.exp(-dt / tau);
  const next = level + (target - level) * k;
  return Math.abs(target - next) < 0.001 ? target : next;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Green -> yellow -> red, as {r,g,b} in 0..1 (Figma's color format).
export function barColor(level) {
  const green = { r: 0.2, g: 0.78, b: 0.35 };
  const yellow = { r: 1.0, g: 0.78, b: 0.1 };
  const red = { r: 0.95, g: 0.18, b: 0.15 };
  const t = Math.min(Math.max(level, 0), 1);
  const [a, b, u] = t < 0.5 ? [green, yellow, t / 0.5] : [yellow, red, (t - 0.5) / 0.5];
  return { r: lerp(a.r, b.r, u), g: lerp(a.g, b.g, u), b: lerp(a.b, b.b, u) };
}

export function isPanicking(level, watchers) {
  return watchers >= MAX_WATCHERS && level > 0.97;
}

// Tremble offset in screen pixels plus rotation in degrees. Zero unless panicking.
export function jitter(level, watchers, rand = Math.random) {
  if (!isPanicking(level, watchers)) return { dx: 0, dy: 0, rot: 0 };
  return {
    dx: (rand() * 2 - 1) * 3,
    dy: (rand() * 2 - 1) * 3,
    rot: (rand() * 2 - 1) * 4,
  };
}

// Swing the bar opposite to cursor motion, like it's dragging behind on a hinge.
// vx is cursor velocity in screen px/s. Angle is clockwise degrees (CSS convention).
// A damped spring gives a little overshoot and wobble when the cursor stops.
export const TILT = { perPx: 0.035, max: 28, stiffness: 140, damping: 11 };

export function stepTilt(tilt, vx, dt) {
  const target = Math.max(-TILT.max, Math.min(TILT.max, -vx * TILT.perPx));
  const accel = (target - tilt.angle) * TILT.stiffness - tilt.vel * TILT.damping;
  const vel = tilt.vel + accel * dt;
  return { angle: tilt.angle + vel * dt, vel };
}

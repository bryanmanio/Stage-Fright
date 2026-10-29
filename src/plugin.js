// Plugin main thread. Polls figma.activeUsers, moves a locked "Anxiety bar"
// frame to the current user's cursor, and fills it by how many people are watching.

const TICK_MS = 33;
const UI_EVERY_MS = 250;

let bar = null;
let track = null;
let fill = null;
let face = null;
let level = 0;
let tilt = { angle: 0, vel: 0 };
let lastPos = null;
let fakeWatchers = -1; // -1 = use real watchers
let lastTick = Date.now();
let lastUi = 0;
let timer = null;

figma.showUI(__html__, { width: 240, height: 210, themeColors: true });

figma.ui.onmessage = (msg) => {
  if (msg.type === "fake") fakeWatchers = msg.value;
  if (msg.type === "stop") stop();
};

figma.on("close", cleanup);

function solid(c) {
  return [{ type: "SOLID", color: c }];
}

async function createBar() {
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

  bar = figma.createFrame();
  bar.name = "Anxiety bar";
  bar.fills = [];
  bar.clipsContent = false;

  track = figma.createRectangle();
  track.name = "track";
  track.fills = solid({ r: 1, g: 1, b: 1 });
  track.strokes = solid({ r: 0.12, g: 0.12, b: 0.14 });
  track.effects = [
    { type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 2 },
      radius: 6, spread: 0, visible: true, blendMode: "NORMAL" },
  ];
  bar.appendChild(track);

  fill = figma.createRectangle();
  fill.name = "fill";
  bar.appendChild(fill);

  face = figma.createText();
  face.name = "face";
  face.fontName = { family: "Inter", style: "Bold" };
  face.characters = "😐";
  bar.appendChild(face);

  bar.locked = true;
}

function layout(s, lvl, panicking) {
  const w = BAR.width * s;
  const h = BAR.height * s;
  const pad = BAR.pad * s;

  bar.resizeWithoutConstraints(w, h + 20 * s);

  track.resize(w, h);
  track.x = 0;
  track.y = 20 * s;
  track.cornerRadius = w / 2;
  track.strokeWeight = 1.5 * s;

  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const fh = Math.max(innerW, innerH * lvl); // never smaller than a pill
  fill.resize(innerW, fh);
  fill.x = pad;
  fill.y = 20 * s + pad + (innerH - fh);
  fill.cornerRadius = innerW / 2;
  fill.fills = solid(barColor(lvl));
  fill.opacity = lvl < 0.02 ? 0.35 : 1;

  face.fontSize = 14 * s;
  const emoji = panicking ? "😱" : lvl > 0.6 ? "😰" : lvl > 0.25 ? "😬" : "😐";
  if (face.characters !== emoji) face.characters = emoji;
  face.x = w / 2 - face.width / 2;
  face.y = 0;
}

function tick() {
  if (!bar || bar.removed) return;
  const now = Date.now();
  const dt = Math.min((now - lastTick) / 1000, 0.25);
  lastTick = now;

  const users = figma.activeUsers;
  const myId = figma.currentUser ? figma.currentUser.sessionId : null;
  const me = users.find((u) => u.sessionId === myId) || users[0];

  const watchers = fakeWatchers >= 0 ? fakeWatchers : countWatchers(me, users);
  level = stepLevel(level, targetLevel(watchers), dt);
  const panicking = isPanicking(level, watchers);

  if (me && me.position) {
    const s = 1 / figma.viewport.zoom;
    bar.visible = true;
    layout(s, level, panicking);
    const j = jitter(level, watchers);

    // Cursor velocity in screen px/s drives the swing.
    const vx = lastPos && dt > 0 ? ((me.position.x - lastPos.x) / s) / dt : 0;
    lastPos = me.position;
    tilt = stepTilt(tilt, vx, dt);

    // Rotate around the bottom-centre of the bar so it hinges near the cursor.
    // Figma rotation is counter-clockwise, so negate the clockwise tilt angle.
    const w = BAR.width * s;
    const hTotal = (BAR.height + 20) * s;
    const pivotX = me.position.x + (BAR.offsetX + j.dx) * s + w / 2;
    const pivotY = me.position.y + (BAR.offsetY + j.dy) * s + hTotal;
    const th = (-(tilt.angle + j.rot) * Math.PI) / 180;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const lx = w / 2;
    const ly = hTotal;
    bar.relativeTransform = [
      [c, sn, pivotX - (c * lx + sn * ly)],
      [-sn, c, pivotY - (-sn * lx + c * ly)],
    ];
  } else {
    bar.visible = false;
    lastPos = null;
  }

  if (now - lastUi > UI_EVERY_MS) {
    lastUi = now;
    figma.ui.postMessage({
      type: "state",
      watchers,
      level,
      panicking,
      fake: fakeWatchers >= 0,
      others: users
        .filter((u) => u.sessionId !== myId)
        .map((u) => ({ name: u.name, color: u.color,
          watching: !!(me && me.position && u.viewport && inRect(me.position, u.viewport)) })),
    });
  }
}

function cleanup() {
  if (timer) clearInterval(timer);
  timer = null;
  if (bar && !bar.removed) bar.remove();
  bar = null;
}

function stop() {
  cleanup();
  figma.closePlugin("Anxiety relieved.");
}

createBar().then(() => {
  timer = setInterval(tick, TICK_MS);
});

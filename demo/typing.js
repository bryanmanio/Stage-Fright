// Nervous typist for the demo. Types a target string one key at a time. The higher
// the anxiety level, the more typos: wrong neighbouring keys, typing on past the
// mistake before noticing, then backspacing to fix it.

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A key next to `ch` on a QWERTY keyboard, keeping its case.
export function neighbor(ch, rand) {
  const lower = ch.toLowerCase();
  for (const row of ROWS) {
    const i = row.indexOf(lower);
    if (i === -1) continue;
    const j = i === 0 ? 1 : i === row.length - 1 ? i - 1 : i + (rand() < 0.5 ? -1 : 1);
    return ch === lower ? row[j] : row[j].toUpperCase();
  }
  return ch === " " ? (rand() < 0.5 ? "b" : "n") : "x";
}

export function typoChance(level) {
  return 0.008 + 0.36 * level;
}

export class Typer {
  constructor(seed = 1) {
    this.rand = mulberry32(seed);
    this.target = "";
    this.buf = "";
    this.queue = [];
    this.next = 0;
    this.lastKey = -1;
    this.typos = 0;
    this.backspaces = 0;
  }

  start(text, t) {
    this.target = text;
    this.buf = "";
    this.queue = [];
    this.next = t;
  }

  get done() {
    return this.queue.length === 0 && this.buf === this.target;
  }

  // Apply every keystroke due by time t.
  update(t, level) {
    while (t >= this.next && !this.done) {
      if (!this.queue.length) this.plan(level);
      const a = this.queue.shift();
      if (a.op === "type") this.buf += a.ch;
      else { this.buf = this.buf.slice(0, -1); this.backspaces++; }
      this.lastKey = this.next;
      this.next += a.delay;
    }
  }

  plan(level) {
    const r = this.rand;
    const T = this.target;
    const k = this.buf.length; // plan() is only called when buf is a correct prefix
    const key = () => 0.07 + r() * 0.07 + (r() < level * 0.15 ? 0.25 : 0); // nervous hesitations
    const ch = T[k];

    if (r() >= typoChance(level)) {
      this.queue.push({ op: "type", ch, delay: key() + (ch === " " ? r() * 0.08 : 0) });
      return;
    }

    // Typo: wrong key (sometimes two), keep typing a few correct letters, notice, backspace.
    this.typos++;
    const wrong = [neighbor(ch, r)];
    if (r() < level * 0.5) wrong.push(neighbor(T[k + 1] || ch, r));
    const extra = T.slice(k + 1, k + 1 + Math.floor(r() * (1 + level * 3)));
    const typed = [...wrong, ...extra];
    typed.forEach((c, i) => {
      const last = i === typed.length - 1;
      this.queue.push({ op: "type", ch: c, delay: last ? 0.22 + r() * 0.3 + level * 0.25 : key() });
    });
    typed.forEach((_, i) => {
      const last = i === typed.length - 1;
      this.queue.push({ op: "bs", delay: last ? 0.12 + r() * 0.1 : 0.06 + r() * 0.03 });
    });
  }
}

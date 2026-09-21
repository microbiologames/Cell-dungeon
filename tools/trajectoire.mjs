/* ---------------------------------------------------------------------------
   Trace la TRAJECTOIRE du joueur sous une entree clavier.

   C'est le seul juge qui vaille pour la giration : ce qu'on regarde n'est pas
   le sprite qui pivote, c'est le chemin parcouru. Au clavier, l'entree ne
   propose que huit directions, donc la cible de cap saute de 45 degres d'un
   coup — c'est de la que vient la brusquerie, pas du rendu. Au joystick,
   l'angle balaie en continu et le probleme ne se pose pas.

   On rejoue la MEME sequence de touches pour plusieurs agilites, plus le
   comportement d'avant (cap colle a l'entree), et on superpose.

     node tools/trajectoire.mjs        -> assets/reference/trajectoire.png
--------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';

const ROOT = process.cwd();
const OUT = process.env.OUT || 'assets/reference/trajectoire.png';
const srv = createServer(async (q, r) => {
  try {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const b = await readFile(join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, '')));
    const t = { '.html': 'text/html', '.png': 'image/png' }[extname(p)] || 'text/javascript';
    r.writeHead(200, { 'content-type': t });
    r.end(b);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((r) => srv.listen(8094, r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const pg = await b.newPage({ viewport: { width: 1100, height: 620 } });
pg.on('pageerror', (e) => console.log('ERREUR', e.message));
await pg.goto('http://localhost:8094/');

const res = await pg.evaluate(async () => {
  const { Game } = await import('./src/game/game.js');
  const { NAGE } = await import('./src/game/player.js');

  /* Sequence de TOUCHES, pas de directions continues : c'est le cas qui
     pose probleme. Chaque entree dure 0,75 s. */
  const TOUCHES = [
    [1, 0], [0, -1], [-1, 0], [0, -1], [1, 0], [1, 1], [-1, 1], [-1, 0], [0, -1],
  ];
  const DUREE = 0.75, DT = 1 / 60;

  let rejoue = function ({ accel, figeCap, alignement, tauAngMax }) {
    if (alignement !== undefined) NAGE.alignement = alignement;
    if (tauAngMax !== undefined) NAGE.tauAngMax = tauAngMax;
    const g = new Game('milk', 12345);
    g.start();
    /* On veut mesurer la NAGE, pas le combat : le champ reste vide. */
    g.director.update = () => {};
    g.enemies.length = 0;
    g.player.recompute();
    g.player.stats.accel = accel;
    const p = g.player;
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
    const input = { move: { x: 0, y: 0 }, focusAxis: 0,
      takeFocusImpulse: () => 0, takeDash: () => false, takePause: () => false };
    const chemin = [];
    for (let k = 0; k < TOUCHES.length; k++) {
      const [mx, my] = TOUCHES[k];
      const n = Math.hypot(mx, my) || 1;
      input.move.x = mx / n; input.move.y = my / n;
      for (let i = 0; i < DUREE / DT; i++) {
        g.player.stats.accel = accel;
        g.update(DT, input);
        if (figeCap) { p.ang = p.angCible; p.omega = 0; }
        if (g.state !== 'playing') g.state = 'playing';
        chemin.push({ x: p.x, y: p.y, t: k });
      }
    }
    return chemin;
  };

  /* Balayage : le cas qui decide est la flagellation POLAIRE, la moins
     agile. Si elle suit encore l'intention, tout le reste suit. */
  const A = Number(new URLSearchParams(location.search).get('a') || 0.34);
  const trace = [];
  const _r = rejoue;
  rejoue = (o) => { const c = _r(o); trace.push(`${o.accel} A=${NAGE.alignement} tmax=${NAGE.tauAngMax}`); return c; };
  return {
    trace,
    avantBase: rejoue({ accel: 400, figeCap: true, alignement: A }),
    avantPolaire: rejoue({ accel: 184, figeCap: true, alignement: A }),
    base: rejoue({ accel: 400, figeCap: false, alignement: A }),
    polaire: rejoue({ accel: 184, figeCap: false, alignement: A }),
  };
});

/* --- rendu de la planche, au trait ------------------------------------- */
const dataUrl = await pg.evaluate((res) => {
  const CASES = [
    ['AVANT  base 400  (cap colle a l entree)', res.avantBase, '#ff6b6b'],
    ['AVANT  polaire 184  (cap colle a l entree)', res.avantPolaire, '#ff9f6b'],
    ['APRES  base 400', res.base, '#7dff9b'],
    ['APRES  polaire 184', res.polaire, '#8fd6ff'],
  ];
  const W = 1100, H = 620, COLS = 2;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = '#05080b'; c.fillRect(0, 0, W, H);
  c.font = '13px ui-monospace, monospace';

  /* Meme echelle pour toutes les cases : sinon on compare des dessins. */
  let lo = 1e9, hi = -1e9, lo2 = 1e9, hi2 = -1e9;
  for (const [, ch] of CASES) for (const q of ch) {
    lo = Math.min(lo, q.x); hi = Math.max(hi, q.x);
    lo2 = Math.min(lo2, q.y); hi2 = Math.max(hi2, q.y);
  }
  const cw = W / COLS, chh = H / 2;
  const span = Math.max(hi - lo, hi2 - lo2) * 1.12 || 1;
  const k = Math.min(cw - 70, chh - 70) / span;

  CASES.forEach(([nom, ch, col], i) => {
    const ox = (i % COLS) * cw + cw / 2 - ((lo + hi) / 2) * k;
    const oy = Math.floor(i / COLS) * chh + chh / 2 - ((lo2 + hi2) / 2) * k;
    c.strokeStyle = '#17241d';
    c.strokeRect((i % COLS) * cw + 6, Math.floor(i / COLS) * chh + 6, cw - 12, chh - 12);
    /* Un point par changement de touche : on voit ou le cap saute. */
    c.lineWidth = 2; c.strokeStyle = col; c.beginPath();
    ch.forEach((q, j) => {
      const X = ox + q.x * k, Y = oy + q.y * k;
      if (j === 0) c.moveTo(X, Y); else c.lineTo(X, Y);
    });
    c.stroke();
    c.fillStyle = col;
    let prev = -1;
    for (const q of ch) {
      if (q.t !== prev) { prev = q.t; c.fillRect(ox + q.x * k - 2, oy + q.y * k - 2, 4, 4); }
    }
    c.fillStyle = '#cfe6d8';
    c.fillText(nom, (i % COLS) * cw + 14, Math.floor(i / COLS) * chh + 26);
  });
  c.fillStyle = '#5d7a68';
  c.fillText('meme sequence de 9 touches, 0,75 s chacune — les carres marquent les changements de touche',
    14, H - 12);
  return cv.toDataURL('image/png');
}, res);

await writeFile(join(ROOT, OUT), Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log('reglages appliques :', res.trace.join(' | '));
console.log('trajectoires ->', OUT);
await b.close(); srv.close();

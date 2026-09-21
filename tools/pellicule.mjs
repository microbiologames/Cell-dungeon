/* ---------------------------------------------------------------------------
   Pellicule : des images successives du joueur pendant une manoeuvre.

   Une planche de poses fixes ne peut pas juger un flagelle a inertie : le
   sillage est une MEMOIRE, il n'existe que si la cellule a bouge avant.
   On rejoue donc une manoeuvre dans le vrai jeu et on preleve des images.

     node tools/pellicule.mjs           -> assets/reference/pellicule.png
--------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';

const ROOT = process.cwd();
const OUT = process.env.OUT || 'assets/reference/pellicule.png';
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
await new Promise((r) => srv.listen(8095, r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const pg = await b.newPage({ viewport: { width: 1200, height: 700 } });
pg.on('pageerror', (e) => console.log('ERREUR', e.message));
await pg.goto('http://localhost:8095/');

const dataUrl = await pg.evaluate(async () => {
  const { Game } = await import('./src/game/game.js');
  const { Screen } = await import('./src/core/pixel.js');
  const { drawPlayer } = await import('./src/render/organisms.js');
  const { MATRICES_PALETTE } = await import('./src/data/palette.js');
  const { drawText } = await import('./src/core/font.js');
  const pal = MATRICES_PALETTE.pipe;

  /* Trois manoeuvres, celles dont on veut juger : la course en ligne, le
     virage sec, et l'arret brutal. */
  const MANOEUVRES = [
    { nom: 'COURSE  cap tenu', suite: [[[1, 0], 1.6]] },
    { nom: 'VIRAGE SEC  droite puis haut', suite: [[[1, 0], 1.2], [[0, -1], 0.9]] },
    { nom: 'ARRET BRUTAL', suite: [[[1, 0], 1.4], [[0, 0], 0.9]] },
  ];
  const DT = 1 / 60, CASE = 58, ZOOM = 4, IMAGES = 8;

  const bandes = [];
  for (const man of MANOEUVRES) {
    const g = new Game('pipe', 77);
    g.start();
    g.director.update = () => {};
    g.enemies.length = 0;
    g.conduite = null;                     // pas de courant : on juge la nage
    const p = g.player;
    p.taken.set('peritriche', 2); p.taken.set('flagelle', 3); p.recompute();
    const input = { move: { x: 0, y: 0 }, focusAxis: 0,
      takeFocusImpulse: () => 0, takeDash: () => false, takePause: () => false };

    /* On preleve les images sur la FIN de la manoeuvre : c'est la que le
       sillage a quelque chose a raconter. */
    const total = man.suite.reduce((a, [, d]) => a + d, 0);
    const debut = total - IMAGES * 6 * DT;
    const poses = [];
    let t = 0;
    for (const [mv, duree] of man.suite) {
      const n = Math.hypot(mv[0], mv[1]) || 1;
      for (let i = 0; i < duree / DT; i++) {
        input.move.x = mv[0] && mv[0] / n; input.move.y = mv[1] && mv[1] / n;
        if (!mv[0] && !mv[1]) { input.move.x = 0; input.move.y = 0; }
        g.update(DT, input);
        if (g.state !== 'playing') g.state = 'playing';
        t += DT;
        if (t >= debut && poses.length < IMAGES
          && (poses.length === 0 || t - poses[poses.length - 1].t >= 6 * DT - 1e-6)) {
          poses.push({ t, ang: p.ang, phase: p.phase, drive: p.drive,
            lean: p.lean, bend: p.bend, trouble: p.trouble,
            sillage: p.sillage, fl: p.flagellation });
        }
      }
    }
    bandes.push({ nom: man.nom, poses });
  }

  const COLS = IMAGES;
  const W = COLS * CASE, H = bandes.length * (CASE + 10);
  const cv = document.createElement('canvas');
  const scr = new Screen(cv, { W, H, CX: W / 2, CY: H / 2, R: 99999, mode: 'film' });
  scr.beginFrame(0xff05080b);
  scr.clip = false;
  bandes.forEach((bande, r) => {
    bande.poses.forEach((q, i) => {
      const cx = i * CASE + CASE / 2;
      const cy = r * (CASE + 10) + CASE / 2 + 6;
      scr.layer(0);
      drawPlayer(scr, cx, cy, 3.4, q.ang, q.phase, pal, q.fl, q);
      scr.composite(0);
    });
    drawText(scr, bande.nom, 2, r * (CASE + 10) + 2, 0xff8fa8b5, 1, 1);
    const q = bande.poses[bande.poses.length - 1];
    drawText(scr, `drive ${q.drive.toFixed(2)}  trouble ${q.trouble.toFixed(2)}`,
      2, r * (CASE + 10) + CASE + 1, 0xff4a6350, 1, 1);
  });
  scr.present();

  const out = document.createElement('canvas');
  out.width = W * ZOOM; out.height = H * ZOOM;
  const c = out.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(cv, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
});

await writeFile(join(ROOT, OUT), Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log('pellicule ->', OUT);
await b.close(); srv.close();

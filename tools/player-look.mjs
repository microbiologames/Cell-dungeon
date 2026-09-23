/* ---------------------------------------------------------------------------
   Planche du joueur : plusieurs etats d'animation, agrandis.

   Un personnage se juge sur ses ETATS, pas sur une pose. On rend donc la
   meme cellule a l'arret, en nage, en virage et en cambrure, et on regarde
   la planche. C'est le seul juge qui vaille.

   Depuis qu'il y a quatre souches jouables, la planche a un second emploi :
   comparer les MORPHOLOGIES entre elles, a la meme echelle et sur le meme
   fond. Une grappe doree et une levure ocre peuvent etre superbes chacune
   de son cote et se confondre cote a cote — c'est ce que la planche montre,
   et rien d'autre ne le montre.

     node tools/player-look.mjs            -> assets/reference/joueur.png
     node tools/player-look.mjs souches    -> assets/reference/souches.png
--------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
const ROOT = process.cwd();
const MODE = process.argv[2] === 'souches' ? 'souches' : 'etats';
const OUT = process.env.OUT
  || (MODE === 'souches' ? 'assets/reference/souches.png' : 'assets/reference/joueur.png');
const srv = createServer(async (q, r) => {
  try {
    const p = decodeURIComponent(q.url.split('?')[0]);
    const b = await readFile(join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, '')));
    const t = { '.png': 'image/png', '.html': 'text/html' }[extname(p)] || 'text/javascript';
    r.writeHead(200, { 'content-type': t });
    r.end(b);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((r) => srv.listen(8092, r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const pg = await b.newPage({ viewport: { width: 1180, height: 760 } });
pg.on('pageerror', (e) => console.log('ERREUR', e.message));
await pg.goto('http://localhost:8092/index.html');
const dataUrl = await pg.evaluate(async ({ base, mode }) => {
  const { Screen } = await import(base + '/src/core/pixel.js');
  const { drawPlayer } = await import(base + '/src/render/organisms.js');
  const { MATRICES_PALETTE, souchePalette } = await import(base + '/src/data/palette.js');
  const { ESPECES } = await import(base + '/src/data/especes.js');
  const { drawText } = await import(base + '/src/core/font.js');

  const CASE = 64, ZOOM = 5, COLS = 4;
  const etats = [];
  if (mode === 'souches') {
    /* Une colonne par souche, une ligne par etat de sa caracteristique : on
       voit d'un coup si la spore se lit, si la grappe fond avec les PV et si
       le bourgeon grossit. Les deux palettes sont la parce qu'une couleur
       qui marche sur creme peut disparaitre sur noir. */
    for (const [nomPal, pal] of [['LAIT', MATRICES_PALETTE.milk], ['PIPE', MATRICES_PALETTE.pipe]]) {
      for (const e of ESPECES) {
        /* Le rayon EST celui du jeu, amas compris : un coque de trois pixels
           et une grappe de six cellules n'ont pas la meme emprise, et c'est
           justement ce qu'on vient comparer. */
        const n = e.trait && e.trait.id === 'amas' ? e.trait.max : 1;
        const r = (e.stats.hitbox || 3.4) * (1 + 0.10 * (n - 1));
        etats.push({
          nom: `${nomPal} ${e.id.slice(0, 6).toUpperCase()}`, pal, r,
          o: { drive: 1, bend: 0.2,
            morpho: e.morpho, couleurs: souchePalette(pal, e.id),
            trait: { spores: 1, amas: 6, bourgeon: 1, dormance: 0 } },
          fl: { count: e.morpho === 'bacille' || e.morpho === 'bacillelong' ? 6 : 0,
            mode: 'peritriche' },
          ang: -0.5,
        });
      }
    }
  } else {
    for (const [nomPal, pal] of [['LAIT', MATRICES_PALETTE.milk], ['PIPE', MATRICES_PALETTE.pipe]]) {
      for (const [nom, o, fl, ang] of [
        ['ARRET', { drive: 0, bend: 0 }, { count: 0, mode: 'bundle' }, -0.5],
        ['NAGE', { drive: 1, bend: 0 }, { count: 6, mode: 'peritriche' }, -0.5],
        ['CAMBRE +', { drive: 0.7, bend: 1 }, { count: 6, mode: 'peritriche' }, 0],
        ['POLAIRE', { drive: 1, bend: -0.6 }, { count: 3, mode: 'polaire' }, 2.4],
      ]) etats.push({ nom: `${nomPal} ${nom}`, pal, o, fl, ang });
    }
  }

  const rows = Math.ceil(etats.length / COLS);
  const cv = document.createElement('canvas');
  const W = COLS * CASE, H = rows * CASE + 8;
  const scr = new Screen(cv, { W, H, CX: W / 2, CY: H / 2, R: 9999, mode: 'plate' });
  scr.beginFrame(0xff0b0f12);
  scr.clip = false;
  etats.forEach((e, i) => {
    const cx = (i % COLS) * CASE + CASE / 2;
    const cy = Math.floor(i / COLS) * CASE + CASE / 2 - 4;
    scr.layer(0);
    /* Fond du milieu, pour juger le halo sur la vraie couleur. */
    for (let y = -CASE / 2 + 1; y < CASE / 2 - 1; y++) {
      for (let x = -CASE / 2 + 1; x < CASE / 2 - 1; x++) scr.plot(cx + x, cy + y, e.pal.bg);
    }
    /* Trois phases : on voit l'onde se propager. */
    drawPlayer(scr, cx, cy, e.r || 3.4, e.ang, 1.15, e.pal, e.fl, e.o);
    scr.composite(0);
  });
  etats.forEach((e, i) => {
    const cx = (i % COLS) * CASE;
    const cy = Math.floor(i / COLS) * CASE + CASE - 7;
    drawText(scr, e.nom, cx + 2, cy, 0xff8fa8b5, 1, 1);
  });
  scr.present();
  const out = document.createElement('canvas');
  out.width = W * ZOOM; out.height = H * ZOOM;
  const c = out.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(cv, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}, { base: 'http://localhost:8092', mode: MODE });
await writeFile(join(ROOT, OUT), Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log('planche ->', OUT);
await b.close(); srv.close();

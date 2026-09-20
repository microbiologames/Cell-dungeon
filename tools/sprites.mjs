/* ---------------------------------------------------------------------------
   Chaine de fabrication des sprites.

     node tools/sprites.mjs bake     rend chaque espece proceduralement a sa
                                     taille native et ecrit un PNG editable
                                     dans assets/sprites/. C'est la TOILE DE
                                     DEPART : on l'ouvre dans Aseprite, on
                                     retouche, on reimporte.

     node tools/sprites.mjs bake --size 64
                                     meme chose mais sur une toile de 64 px
                                     avec de la MARGE, dans
                                     assets/reference/gen-src/. C'est ce
                                     qu'on envoie en img2img : sans marge, le
                                     generateur rogne le sujet au cadre.

     node tools/sprites.mjs import   lit assets/sprites/<id>.png, redimensionne
                                     a la taille de l'espece, quantifie sur une
                                     palette courte, et ecrit
                                     src/render/sprite-data.js.

   Le decodage PNG passe par Chromium, deja present pour les tests : aucune
   dependance supplementaire.

   Nommage : assets/sprites/<id>.png ou <id> est l'identifiant du bestiaire
   (listeria, staph, kluyveromyces...) ou 'player'. Un suffixe @WxH force une
   taille : listeria@40x40.png.
--------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, basename } from 'node:path';

const MODE = process.argv[2] || 'import';
const ROOT = process.cwd();
const SPRITE_DIR = join(ROOT, 'assets/sprites');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };

const srv = createServer(async (q, r) => {
  try {
    const p = decodeURIComponent(q.url.split('?')[0]);
    const body = await readFile(join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, '')));
    r.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    r.end(body);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((r) => srv.listen(8093, r));

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('ERREUR', e.message));
await page.goto('http://localhost:8093/index.html');

await mkdir(SPRITE_DIR, { recursive: true });

/* ------------------------------------------------------------- palette --- */
/* Ecrit la palette du jeu en image, pour la passer en input_palette a la
   generation. Sans elle, le generateur sort des couleurs plus saturees que
   celles du jeu et l'illustration jure avec le reste. */
if (MODE === 'palette') {
  const dataUrl = await page.evaluate(async () => {
    const { MATRICES_PALETTE, UI } = await import('./src/data/palette.js');
    const pal = MATRICES_PALETTE.milk;
    const pick = [
      UI.player, UI.playerRim, UI.playerCore,
      UI.acid, UI.acidRim, UI.acidCore,
      UI.aa, UI.aaGlow, UI.plasmid,
      UI.hostile, UI.damage, UI.heal, UI.gel, UI.shield, UI.ally,
      pal.bact, pal.bactRim, pal.rod, pal.rodRim, pal.fast, pal.fastRim,
      pal.yeast, pal.yeastRim, pal.spore, pal.sporeRim,
      pal.hypha, pal.hyphaRim, pal.phage, pal.phageRim,
      pal.boss, pal.bossRim, pal.amoeba, pal.amoebaRim,
      pal.neutral, pal.neutralRim, pal.debris, pal.debrisRim, pal.edge,
      0xff000000, 0xff0a1410,
    ];
    const S = 8;
    const cols = 8;
    const rows = Math.ceil(pick.length / cols);
    const cv = document.createElement('canvas');
    cv.width = cols * S; cv.height = rows * S;
    const g = cv.getContext('2d');
    pick.forEach((c, i) => {
      const r = c & 255, gg = (c >> 8) & 255, b = (c >> 16) & 255;
      g.fillStyle = `rgb(${r},${gg},${b})`;
      g.fillRect((i % cols) * S, Math.floor(i / cols) * S, S, S);
    });
    return cv.toDataURL('image/png');
  });
  await mkdir(join(ROOT, 'assets/reference'), { recursive: true });
  const out = join(ROOT, 'assets/reference/palette.png');
  await writeFile(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`palette du jeu ecrite dans ${out}`);
  console.log('Usage : node tools/rd.mjs gen ... --palette assets/reference/palette.png');
  await browser.close(); srv.close();
  process.exit(0);
}

/* --------------------------------------------------------------- bake --- */
if (MODE === 'bake') {
  const sizeArg = process.argv.indexOf('--size');
  const forcedSize = sizeArg > -1 ? Number(process.argv[sizeArg + 1]) : 0;
  const files = await page.evaluate(async (forced) => {
    const { Screen } = await import('./src/core/pixel.js');
    const { drawOrganism, drawPlayer, colorOf } = await import('./src/render/organisms.js');
    const { BESTIARY } = await import('./src/data/bestiary.js');
    const { MATRICES_PALETTE, UI } = await import('./src/data/palette.js');
    const pal = MATRICES_PALETTE.milk;
    const out = [];

    const bake = (id, size, draw) => {
      const cv = document.createElement('canvas');
      const scr = new Screen(cv, { W: size, H: size, CX: size / 2, CY: size / 2, R: size, mode: 'bake' });
      scr.beginFrame(0x00000000);
      scr.clip = false;
      scr.layer(0);
      draw(scr, size / 2, size / 2, size / 2 - 0.5);
      scr.composite(0);
      /* Le fond doit rester transparent : on remet alpha a 0 la ou rien
         n'a ete dessine, sinon le sprite arrive avec un carre noir. */
      const d = scr.image.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0) d[i + 3] = 0;
      }
      scr.ctx.putImageData(scr.image, 0, 0);
      out.push({ id, dataUrl: cv.toDataURL('image/png') });
    };

    /* Avec --size, l'organisme occupe 70 % de la toile et reste centre :
       il faut de la marge, sinon le generateur rogne au cadre. */
    const fit = (native) => (forced ? (forced * 0.70) / (native * 2) : 1);

    bake('player', forced || 16, (s, x, y) => drawPlayer(s, x, y, 3.4 * fit(3.4), 0, 1.2, UI, { count: 4, mode: 'bundle' }));
    /* Tout le bestiaire, toutes matrices : la toile de depart d'une espece
       de la conduite se bake exactement comme celle du lait cru. */
    for (const spec of Object.values(BESTIARY)) {
      const size = forced || Math.max(6, Math.ceil(spec.radius * 2) + 2);
      const [fill, rim] = colorOf(spec, pal);
      bake(spec.id, size, (s, x, y) => drawOrganism(s, spec, x, y, spec.radius * fit(spec.radius), 0, 1.1, fill, rim));
    }
    return out;
  }, forcedSize);

  /* Les toiles de depart ne vont PLUS dans assets/sprites/. Ce dossier ne
     contient que les sprites ADOPTES : y deverser les treize toiles faisait
     perdre a chaque espece son animation procedurale au profit d'une image
     fixe qui, pour la plupart, n'apportait rien. */
  const dir = join(ROOT, forcedSize ? 'assets/reference/gen-src' : 'assets/reference/bake');
  await mkdir(dir, { recursive: true });
  for (const f of files) {
    const b64 = f.dataUrl.split(',')[1];
    await writeFile(join(dir, `${f.id}.png`), Buffer.from(b64, 'base64'));
  }
  console.log(`${files.length} toiles ecrites dans ${forcedSize ? 'assets/reference/gen-src/' : 'assets/reference/bake/'}`
    + (forcedSize ? ` (${forcedSize}px, avec marge — sources img2img)` : ''));
  console.log(forcedSize
    ? 'Puis : node tools/rd.mjs gen <id> "<prompt>" --from assets/reference/gen-src/<id>.png --w 64 --h 64'
    : 'Retouche, puis COPIE dans assets/sprites/ ce que tu adoptes, et : node tools/sprites.mjs import');
  await browser.close(); srv.close();
  process.exit(0);
}

/* ------------------------------------------------------------- import --- */
const all = (await readdir(SPRITE_DIR)).filter((f) => f.endsWith('.png'));
if (!all.length) {
  console.log('Aucun PNG dans assets/sprites/. Lance d\'abord : node tools/sprites.mjs bake');
  await browser.close(); srv.close();
  process.exit(0);
}

const specs = await page.evaluate(async () => {
  const { BESTIARY } = await import('./src/data/bestiary.js');
  const t = {};
  for (const [id, m] of Object.entries(BESTIARY)) t[id] = Math.max(6, Math.ceil(m.radius * 2) + 2);
  t.player = 16;
  return t;
});

const sprites = {};
for (const file of all) {
  const name = basename(file, '.png');
  const m = name.match(/^(.+?)@(\d+)x(\d+)$/);
  const id = m ? m[1] : name;
  const target = m ? [Number(m[2]), Number(m[3])] : [specs[id] || 16, specs[id] || 16];
  if (!specs[id] && !m) {
    console.warn(`  ! ${file} : identifiant inconnu du bestiaire, ignore`);
    continue;
  }

  const res = await page.evaluate(async ([url, tw, th]) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    /* Reduction par moyenne de surface : a ces tailles, un simple
       echantillonnage perdrait la moitie des details. */
    const cv = document.createElement('canvas');
    cv.width = tw; cv.height = th;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, tw, th);
    const d = g.getImageData(0, 0, tw, th).data;

    /* Palette : on quantifie grossierement, on compte, on garde les plus
       frequentes, et le reste tombe sur la plus proche. */
    const bucket = new Map();
    for (let i = 0; i < tw * th; i++) {
      if (d[i * 4 + 3] < 110) continue;
      const key = ((d[i * 4] >> 4) << 8) | ((d[i * 4 + 1] >> 4) << 4) | (d[i * 4 + 2] >> 4);
      const e = bucket.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += d[i * 4]; e.g += d[i * 4 + 1]; e.b += d[i * 4 + 2];
      bucket.set(key, e);
    }
    const cols = [...bucket.values()]
      .sort((a, b) => b.n - a.n).slice(0, 11)
      .map((e) => [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)]);
    if (!cols.length) return null;

    const nearest = (r, g2, b) => {
      let best = 0, bd = Infinity;
      cols.forEach((c, k) => {
        const dd = (c[0] - r) ** 2 + (c[1] - g2) ** 2 + (c[2] - b) ** 2;
        if (dd < bd) { bd = dd; best = k; }
      });
      return best + 1;              // 0 est reserve a la transparence
    };
    const idx = [];
    for (let i = 0; i < tw * th; i++) {
      idx.push(d[i * 4 + 3] < 110 ? 0 : nearest(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]));
    }
    return { cols, idx, used: cols.length };
  }, [`/assets/sprites/${file}`, target[0], target[1]]);

  if (!res) { console.warn(`  ! ${file} : entierement transparent, ignore`); continue; }

  const ALPHABET = '.0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let data = '';
  for (const v of res.idx) data += v === 0 ? '.' : ALPHABET[v];
  sprites[id] = {
    w: target[0], h: target[1], ox: target[0] / 2, oy: target[1] / 2,
    palette: [0, ...res.cols.map(([r, g, b]) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0)],
    data,
  };
  console.log(`  ${id.padEnd(16)} ${target[0]}x${target[1]}  ${res.used} couleurs`);
}

/* Liste des vignettes de cartes disponibles. Sans elle, l'interface
   demandait assets/cards/<id>.png pour CHAQUE evolution et encaissait un 404
   par carte sans illustration : le repli marchait, mais la console se
   remplissait d'erreurs attendues, ce qui noie les vraies. */
let cardIds = [];
try {
  cardIds = (await readdir(join(ROOT, 'assets/cards')))
    .filter((f) => f.endsWith('.png'))
    .map((f) => basename(f, '.png'))
    .sort();
} catch { /* pas encore de vignettes */ }
await writeFile(join(ROOT, 'src/ui/card-art.js'),
  `/* GENERE PAR tools/sprites.mjs - ne pas editer a la main.\n`
  + `   Source : assets/cards/*.png */\n\n`
  + `export const CARD_ART = new Set(${JSON.stringify(cardIds)});\n`);
console.log(`${cardIds.length} vignette(s) de carte -> src/ui/card-art.js`);

const body = `/* GENERE PAR tools/sprites.mjs - ne pas editer a la main.
   Source : assets/sprites/*.png  |  ${new Date().toISOString().slice(0, 10)} */

import { registerSprites } from './sprites.js';

export const SPRITE_DATA = ${JSON.stringify(sprites, null, 1)};

registerSprites(SPRITE_DATA);
`;
await writeFile(join(ROOT, 'src/render/sprite-data.js'), body);
console.log(`\n${Object.keys(sprites).length} sprite(s) ecrits dans src/render/sprite-data.js`);
console.log("N'oublie pas de l'importer depuis src/main.js pour les activer.");
await browser.close();
srv.close();

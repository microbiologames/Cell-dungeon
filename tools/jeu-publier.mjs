/* ---------------------------------------------------------------------------
   Fabrique une copie AUTONOME du jeu, puis la conduit dans un navigateur.

   Le jeu se sert normalement depuis le depot (`npm run serve`) ou depuis
   GitHub Pages. Cet outil en produit une version hebergeable ailleurs :
   `index.html` adapte au squelette de publication, plus les modules sous un
   prefixe versionne.

   ─── Les deux regles, payees sur le studio ────────────────────────────────

     1. les modules sont publies sous un prefixe VERSIONNE (`j1/src/...`),
        sinon un navigateur sert les modules d'une version precedente a cote
        du nouvel `index.html`, et un import nomme manquant fait echouer tout
        le graphe AVANT sa premiere ligne : page morte, sans rien dans le
        depot qui cloche ;
     2. les ANCIENS prefixes restent en ligne. Les supprimer cree la panne
        symetrique : un navigateur qui garde en cache l'ancien `index.html`
        y cherche ses modules et ne trouve plus rien.

   Et la regle de methode : c'est la copie FABRIQUEE qu'on verifie, pas celle
   du depot. Verifier la page qu'on garde n'est pas verifier celle qu'on
   livre.

     node tools/jeu-publier.mjs [dossier] [prefixe]
--------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const SORTIE = process.argv[2] || join(ROOT, '.jeu-publie');
const PREFIXE = process.argv[3] || 'j1';

/* --- fabrication -------------------------------------------------------- */

await rm(SORTIE, { recursive: true, force: true });
await mkdir(join(SORTIE, PREFIXE), { recursive: true });
/* Tout `src/` : les sprites et les vignettes de cartes sont deja inlines
   dans des modules, il n'y a donc aucun asset a copier a cote. */
await cp(join(ROOT, 'src'), join(SORTIE, PREFIXE, 'src'), { recursive: true });

let page = await readFile(join(ROOT, 'index.html'), 'utf8');
page = page.replace('./src/main.js', `./${PREFIXE}/src/main.js`);
/* Le squelette de publication fournit doctype, head et body : on ne garde
   que le titre, la feuille de style et le contenu. */
page = page.slice(page.indexOf('<title>'));
page = page.replace('</head>\n<body>\n', '').replace(/\n<\/body>\n<\/html>\s*$/, '\n');
/* L'icone est posee a la publication, pas par la page. */
page = page.replace(/<link rel="icon"[^>]*>\n/, '');
await writeFile(join(SORTIE, 'index.html'), page);

const soucis = [];
if (page.includes('<!DOCTYPE')) soucis.push('le doctype n a pas ete retire');
if (!page.includes(`./${PREFIXE}/src/main.js`)) soucis.push('le prefixe de version est absent de l import');
if (page.includes('"./src/')) soucis.push('un chemin relatif n a pas ete reecrit');

/* --- verification ------------------------------------------------------- */

const T = { '.html': 'text/html', '.png': 'image/png', '.wav': 'audio/wav' };
const srv = createServer(async (q, r) => {
  try {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const b = await readFile(join(SORTIE, normalize(p).replace(/^(\.\.[/\\])+/, '')));
    r.writeHead(200, { 'content-type': T[extname(p)] || 'text/javascript' });
    r.end(b);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((r) => srv.listen(8124, r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const nav = await chromium.launch({
  ...(exe ? { executablePath: exe } : {}),
  args: ['--autoplay-policy=no-user-gesture-required'],
});

/* On verifie sur les DEUX formats : le jeu se joue autant au telephone. */
const releves = [];
for (const [nom, vp, mobile] of [
  ['bureau', { width: 1280, height: 800 }, false],
  ['telephone', { width: 390, height: 844 }, true],
]) {
  const ctx = await nav.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => soucis.push(`${nom} : ${e.message}`));
  pg.on('response', (r) => { if (r.status() >= 400) soucis.push(`${nom} : ${r.status()} ${r.url()}`); });
  await pg.goto('http://localhost:8124/');
  await pg.waitForTimeout(1200);
  const depart = await pg.locator('#btnStart').count();
  if (depart) { await pg.click('#btnStart'); await pg.waitForTimeout(800); }
  /* Puis on LANCE une partie, parce qu'une page qui s'affiche n'est pas une
     page qui joue. */
  await pg.evaluate(() => window.__startMatrice && window.__startMatrice('levain'));
  await pg.waitForTimeout(1500);
  releves.push({ nom, depart: !!depart, ...await pg.evaluate(() => ({
    scene: window.__scene,
    etat: window.__game && window.__game.state,
    mat: window.__game && window.__game.matrix && window.__game.matrix.id,
    ennemis: window.__game ? window.__game.enemies.length : 0,
  })) });
  await ctx.close();
}
await nav.close(); srv.close();

/* --- verdicts ----------------------------------------------------------- */

const verdicts = [];
const dit = (ok, texte) => { verdicts.push(ok); console.log(`${ok ? 'ok  ' : 'ECHEC'} ${texte}`); };
console.log(`copie autonome -> ${SORTIE}  (modules sous ${PREFIXE}/src/)\n`);
for (const r of releves) {
  dit(r.depart, `${r.nom} : l ecran de depart est la`);
  dit(r.scene === 'jeu' && r.etat === 'playing',
    `${r.nom} : une partie demarre (scene ${r.scene}, etat ${r.etat}, matrice ${r.mat})`);
  dit(r.ennemis > 0, `${r.nom} : la matrice est peuplee (${r.ennemis} entites)`);
}
dit(soucis.length === 0, soucis.length ? [...new Set(soucis)].join(' | ') : 'aucune erreur, aucune ressource manquante');
console.log(`\nA publier : index.html + ${PREFIXE}/src/** (36 modules)`);
console.log('Changer de prefixe a chaque publication, et GARDER les anciens en ligne.');
process.exit(verdicts.every(Boolean) ? 0 : 1);

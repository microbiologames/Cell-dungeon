/* ---------------------------------------------------------------------------
   Fabrique la copie AUTONOME du studio, puis la verifie dans un navigateur.

   Le studio du depot vit a `tools/son-studio.html` et importe le moteur par
   des chemins relatifs (`../src/...`). Une page hebergee, elle, est servie a
   la racine : il faut donc en fabriquer une variante, et cette variante n'est
   plus celle que `son-studio-check.mjs` teste.

   ─── Pourquoi cet outil existe ────────────────────────────────────────────

   Parce qu'on a livre une page cassee en croyant le contraire. Le banc du
   depot etait vert, la page hebergee ne construisait plus aucun panneau et
   ne produisait plus de son. En cause : le navigateur servait les MODULES
   d'une version precedente depuis son cache, a cote du `index.html` de la
   nouvelle. Un import nomme manquant fait echouer tout le graphe de modules
   avant sa premiere ligne — donc rien ne s'affiche et rien ne sonne, sans
   qu'aucune erreur ne remonte ailleurs que dans la console.

   D'ou les deux regles que cet outil applique :

     1. les modules sont publies sous un prefixe VERSIONNE (`v3/src/...`), si
        bien qu'un cache ne peut pas servir les anciens a leur place ;
     2. la copie fabriquee est CONDUITE dans un vrai navigateur avant d'etre
        publiee, et pas seulement celle du depot.

     node tools/son-studio-publier.mjs [dossier] [prefixe]
--------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';

const ROOT = process.cwd();
const SORTIE = process.argv[2] || join(ROOT, '.studio-publie');
const PREFIXE = process.argv[3] || 'v3';

/* Les modules dont la page a besoin. La liste est courte et explicite : une
   dependance oubliee ne se voit pas a la lecture, elle se voit en 404. */
const MODULES = [
  'src/audio/son.js', 'src/audio/voix.js',
  'src/core/util.js',
  'src/data/son-presets.js', 'src/data/son-instruments.js',
];

/* --- fabrication -------------------------------------------------------- */

await rm(SORTIE, { recursive: true, force: true });
for (const m of MODULES) {
  const cible = join(SORTIE, PREFIXE, m);
  await mkdir(dirname(cible), { recursive: true });
  await cp(join(ROOT, m), cible);
}

let page = await readFile(join(ROOT, 'tools/son-studio.html'), 'utf8');
page = page.replaceAll("'../src/", `'./${PREFIXE}/src/`);
/* Le squelette de publication fournit doctype, head et body : on ne garde
   que le titre, la feuille de style et le contenu. */
page = page.slice(page.indexOf('<title>'));
page = page.replace('<title>Cell Dungeon — studio sonore</title>\n<link rel="icon" href="data:,">',
  '<title>Studio sonore Cell Dungeon</title>');
page = page.replace('</head>\n<body>\n', '').replace('\n</body>\n</html>\n', '\n');
/* L'en-tete colle est sous la barre systeme du telephone, pas dessus. */
page = page.replace('position: sticky; top: 0; z-index: 5;',
  'position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5;');
/* Le squelette impose une police systeme sur fond clair : cette page assume
   un seul theme, celui du microscope, et le reprend explicitement. */
page = page.replace('body {\n    margin: 0; background: var(--bg); color: var(--ink);',
  'body {\n    margin: 0; background: var(--bg); color: var(--ink);\n    color-scheme: dark;');
page = page.replace('.wrap { max-width: 1180px; margin: 0 auto; padding: 16px; }',
  '.wrap { max-width: 1180px; margin: 0 auto; padding-block: 16px; padding-inline: 16px; }');
await writeFile(join(SORTIE, 'index.html'), page);

const soucis = [];
if (page.includes('<!DOCTYPE')) soucis.push('le doctype n a pas ete retire');
if (page.includes(`'../src/`)) soucis.push('un import relatif n a pas ete reecrit');
if (!page.includes(`./${PREFIXE}/src/audio/son.js`)) soucis.push('le prefixe de version est absent des imports');

/* --- verification ------------------------------------------------------- */

const srv = createServer(async (q, r) => {
  try {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const b = await readFile(join(SORTIE, normalize(p).replace(/^(\.\.[/\\])+/, '')));
    r.writeHead(200, { 'content-type': extname(p) === '.html' ? 'text/html' : 'text/javascript' });
    r.end(b);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((r) => srv.listen(8116, r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const nav = await chromium.launch({
  ...(exe ? { executablePath: exe } : {}),
  /* Sans ca, le contexte audio reste suspendu en mode sans tete et la page
     a l'air morte alors qu'elle va tres bien. */
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const pg = await nav.newPage();
pg.on('pageerror', (e) => soucis.push('exception : ' + e.message));
pg.on('response', (r) => { if (r.status() === 404) soucis.push('404 ' + r.url()); });
await pg.goto('http://localhost:8116/');
await pg.waitForTimeout(700);

const vu = {
  ambiances: await pg.locator('#onglets .btn').count(),
  champs: await pg.locator('#groupes input[type=range]').count(),
  voix: await pg.locator('#voix .btn').count(),
  patch: await pg.locator('#patch input[type=range]').count(),
  code: (await pg.locator('#codeCourant').textContent()).trim(),
};
await pg.click('#jouer');
await pg.waitForTimeout(900);
vu.transport = (await pg.locator('#jouer').textContent()).trim();
await nav.close(); srv.close();

/* --- verdicts ----------------------------------------------------------- */

const verdicts = [];
const dit = (ok, texte) => { verdicts.push(ok); console.log(`${ok ? 'ok  ' : 'ECHEC'} ${texte}`); };
console.log(`copie autonome -> ${SORTIE}  (modules sous ${PREFIXE}/src/)\n`);
dit(vu.ambiances === 5, `les cinq ambiances ont leur onglet (${vu.ambiances})`);
dit(vu.champs === 7, `les sept champs d ambiance ont leur curseur (${vu.champs})`);
dit(vu.voix === 9, `les neuf voix du rack ont leur onglet (${vu.voix})`);
dit(vu.patch > 0, `le panneau de voix se construit (${vu.patch} curseurs)`);
dit(vu.code.startsWith('CD2-'), `le code se calcule (${vu.code.slice(0, 24)}…)`);
/* Le bouton bascule sur « Couper » une fois le moteur demarre : c'est la
   preuve qu'`init()` a abouti, et pas seulement que la page s'affiche. */
dit(vu.transport === 'Couper', `le moteur demarre sur un geste (bouton : ${vu.transport})`);
dit(soucis.length === 0, soucis.length ? soucis.join(' | ') : 'aucune erreur, aucune ressource manquante');
console.log(`\nA publier : index.html + ${MODULES.map((m) => `${PREFIXE}/${m}`).join(', ')}`);
console.log('Changer de prefixe a chaque publication : un cache ne peut pas servir');
console.log("d'anciens modules a la place des nouveaux s'ils n'ont pas le meme chemin.");
process.exit(verdicts.every(Boolean) ? 0 : 1);

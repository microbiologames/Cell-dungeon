/* ---------------------------------------------------------------------------
   Verification du studio sonore.

   Le studio est une page de reglage, pas du code de jeu : elle ne casse rien
   en production. Mais elle sert a DECIDER de la direction artistique, et une
   page qui ment sur ce qu'elle applique fait perdre une soiree d'ecoute sans
   jamais lever d'exception. On la conduit donc pour de vrai, dans un vrai
   navigateur, avec du vrai son.

   Ce qu'on verifie :
     - que le schema tient dans ses bits et que les presets adoptes tombent
       exactement sur la grille du code (aller-retour = identite) ;
     - qu'un curseur change reellement le preset ET le code ;
     - qu'un code se recharge et repositionne les curseurs ;
     - qu'un code faux ne charge RIEN ;
     - que l'arc de partie fait bouger le contexte tout seul ;
     - que l'export produit un bloc reutilisable ;
     - qu'aucune ressource ne manque et qu'aucune exception ne passe.

     node tools/son-studio-check.mjs
--------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const T = { '.html': 'text/html', '.png': 'image/png', '.css': 'text/css' };
const srv = createServer(async (q, r) => {
  try {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const b = await readFile(join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, '')));
    r.writeHead(200, { 'content-type': T[extname(p)] || 'text/javascript' });
    r.end(b);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((r) => srv.listen(8107, r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const b = await chromium.launch({
  ...(exe ? { executablePath: exe } : {}),
  /* Sans ca, le contexte audio reste suspendu en mode sans tete et la page
     a l'air morte alors qu'elle va tres bien. */
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const pg = await b.newPage();
const errs = [];
pg.on('pageerror', (e) => errs.push('exception : ' + e.message));
pg.on('response', (r) => { if (r.status() === 404) errs.push('404 ' + r.url()); });
await pg.goto('http://localhost:8107/tools/son-studio.html');
await pg.waitForTimeout(400);

const verdicts = [];
const dit = (ok, texte) => { verdicts.push(ok); console.log(`${ok ? 'ok  ' : 'ECHEC'} ${texte}`); };

/* --- le schema et la grille ------------------------------------------- */
const schema = await pg.evaluate(async () => {
  const m = await import('../src/data/son-presets.js');
  const maux = m.verifierSchema();
  const allers = [];
  for (const [nom, p] of Object.entries(m.PRESETS)) {
    const d = m.decoderCode(m.encoderCode(nom, p, 0x5eed));
    const exact = d && d.graine === 0x5eed
      && m.CHAMPS.every((ch) => d.preset[ch.cle] === p[ch.cle]);
    if (!exact) allers.push(nom);
  }
  return { maux, allers, champs: m.CHAMPS.length };
});
dit(schema.maux.length === 0, `schema et presets sur la grille${schema.maux.length ? ' : ' + schema.maux.join(' | ') : ''}`);
dit(schema.allers.length === 0, `aller-retour preset -> code -> preset exact${schema.allers.length ? ' SAUF ' + schema.allers.join(', ') : ''}`);

/* --- la page ----------------------------------------------------------- */
const nb = await pg.locator('#groupes input[type=range]').count();
dit(nb === schema.champs, `les ${schema.champs} champs ont tous un curseur (${nb} affiches)`);

const code0 = await pg.locator('#codeCourant').textContent();
await pg.click('#jouer');
await pg.waitForTimeout(700);
dit((await pg.locator('#jouer').textContent()).trim() === 'Couper', 'le moteur demarre sur un geste');

await pg.locator('#groupes input[type=range]').first().fill('120');
await pg.waitForTimeout(150);
const code1 = await pg.locator('#codeCourant').textContent();
dit(code1 !== code0, `un curseur change le code (${code0} -> ${code1})`);
dit(await pg.locator('#groupes .rang.bouge').count() > 0, 'l ecart a l adopte est signale');

await pg.fill('#charger', 'CD1-pipe-FRR4XRQ34A6AA5XVE8');
await pg.click('#btnCharger');
await pg.waitForTimeout(250);
const apresCharge = (await pg.locator('#codeCourant').textContent()).trim();
dit(apresCharge === 'CD1-pipe-FRR4XRQ34A6AA5XVE8', `un code se recharge tel quel (${apresCharge})`);

await pg.fill('#charger', 'CD1-pipe-FRR4XRQ34A6AA5XVE9');
await pg.click('#btnCharger');
await pg.waitForTimeout(150);
dit((await pg.locator('#codeCourant').textContent()).trim() === apresCharge,
  'un code faux ne charge RIEN');

await pg.click('#arc');
await pg.waitForTimeout(1500);
const avance = parseInt((await pg.locator('#arcEtat').textContent()).trim(), 10);
dit(Number.isFinite(avance) && avance > 0, `l arc de partie avance tout seul (${avance} %)`);

/* Le detecteur de raie en direct doit dire la meme chose que le banc hors
   ligne : sur un mix dense et corrige, une texture, pas un sifflement. */
await pg.click('#arc');
await pg.evaluate(() => {
  const i = document.querySelectorAll('#contexte input')[0];
  i.value = 0.8; i.dispatchEvent(new Event('input'));
});
await pg.waitForTimeout(1200);
const verdict = (await pg.locator('#verdict').textContent()).trim();
dit(!verdict.includes('sifflement.') || verdict.includes('pas sifflement'),
  `le detecteur en direct est d accord avec le banc : ${verdict}`);

await pg.click('#exporter');
await pg.waitForTimeout(150);
const sortie = await pg.locator('#sortie').inputValue();
dit(sortie.includes('export const PRESETS') && sortie.includes('CD1-'),
  `l export rend un bloc reutilisable (${sortie.split('\n').length} lignes)`);

dit(errs.length === 0, errs.length ? errs.join(' | ') : 'aucune erreur de page, aucune ressource manquante');
await b.close(); srv.close();
process.exit(verdicts.every(Boolean) ? 0 : 1);

/* ---------------------------------------------------------------------------
   Verification du studio sonore.

   Le studio est une page de reglage, pas du code de jeu : elle ne casse rien
   en production. Mais elle sert a DECIDER de la direction artistique, et une
   page qui ment sur ce qu'elle applique fait perdre une soiree d'ecoute sans
   jamais lever d'exception. On la conduit donc pour de vrai, dans un vrai
   navigateur, avec du vrai son.

   Ce qu'on verifie :
     - que le schema tient dans ses bits et que les reglages adoptes, AMBIANCE
       ET RACK, tombent exactement sur la grille du code (aller-retour =
       identite) ;
     - qu'un curseur d'ambiance ET un curseur de rack changent le code ;
     - que chaque voix a bien tous ses champs, et que le solo se voit ;
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
  for (const nom of Object.keys(m.PRESETS)) {
    const p = m.PRESETS[nom], r = m.RACKS[nom];
    const d = m.decoderCode(m.encoderCode(nom, p, r, 0x5eed));
    const exact = d && d.graine === 0x5eed && d.rack.desaccord === r.desaccord
      && m.CHAMPS.every((ch) => d.preset[ch.cle] === p[ch.cle])
      && m.VOIX.every((v) => m.CHAMPS_PAR_GENRE[v.genre]
        .every((ch) => d.rack[v.cle][ch.cle] === r[v.cle][ch.cle]));
    if (!exact) allers.push(nom);
  }
  /* Un code de la premiere version ne connaissait pas les racks. Il doit
     encore se relire : un code note a l'oreille represente une soiree
     d'ecoute, et rien ne justifie de la perdre. */
  const v1 = m.decoderCode('CD1-milk-F9SJQNM43A6AA5XVER');
  return { maux, allers,
    champs: m.CHAMPS.length,
    voix: m.VOIX.length,
    champsVoix: Object.fromEntries(m.VOIX.map((v) => [v.cle, m.CHAMPS_PAR_GENRE[v.genre].length])),
    cd1: !!v1 && v1.preset.bpm === 172 && v1.rack.lead.onde === 'carre' };
});
dit(schema.maux.length === 0, `schema et presets sur la grille${schema.maux.length ? ' : ' + schema.maux.join(' | ') : ''}`);
dit(schema.allers.length === 0, `aller-retour reglages -> code -> reglages exact${schema.allers.length ? ' SAUF ' + schema.allers.join(', ') : ''}`);
dit(schema.cd1, 'un code CD1 se relit encore, traduit vers le format a rack');

/* --- la page ----------------------------------------------------------- */
const nb = await pg.locator('#groupes input[type=range]').count();
dit(nb === schema.champs, `les ${schema.champs} champs d ambiance ont tous un curseur (${nb} affiches)`);
dit(await pg.locator('#voix .btn').count() === schema.voix,
  `les ${schema.voix} voix du rack ont toutes un onglet`);

/* Chaque voix doit ouvrir un panneau complet. Une voix dont un champ manque
   se regle « bien » et se code faux — c'est indetectable a l'oreille. */
const manques = [];
for (const [cle, n] of Object.entries(schema.champsVoix)) {
  await pg.evaluate((c) => document.querySelector(`#voix .btn[data-cle="${c}"]`).click(), cle);
  const attendu = n + (cle === 'nappe' ? 1 : 0);   // la nappe a son desaccord
  const vus = await pg.locator('#patch input[type=range]').count();
  if (vus !== attendu) manques.push(`${cle} : ${vus} au lieu de ${attendu}`);
}
dit(manques.length === 0, `chaque voix ouvre un panneau complet${manques.length ? ' SAUF ' + manques.join(', ') : ''}`);

const code0 = await pg.locator('#codeCourant').textContent();
await pg.click('#jouer');
await pg.waitForTimeout(700);
dit((await pg.locator('#jouer').textContent()).trim() === 'Couper', 'le moteur demarre sur un geste');

await pg.locator('#groupes input[type=range]').first().fill('120');
await pg.waitForTimeout(150);
const code1 = await pg.locator('#codeCourant').textContent();
dit(code1 !== code0, 'un curseur d ambiance change le code');
dit(await pg.locator('#groupes .rang.bouge').count() > 0, 'l ecart a l adopte est signale');

/* Le rack. C'est le sujet : un curseur de timbre doit s'entendre ET se coder. */
await pg.evaluate(() => document.querySelector('#voix .btn[data-cle="lead"]').click());
await pg.locator('#patch input[type=range]').first().fill('2');
await pg.waitForTimeout(150);
const code2 = await pg.locator('#codeCourant').textContent();
dit(code2 !== code1, 'un curseur de rack change le code');
dit(await pg.locator('#patch .rang.bouge').count() > 0, 'l ecart au rack adopte est signale');
const onde = await pg.evaluate(async () => {
  const m = await import('../src/data/son-presets.js');
  return m.RACKS.milk.lead.onde;
});
dit(onde === 'scie', `le curseur d onde atteint bien la voix (lead = ${onde})`);

await pg.click('#solo');
await pg.waitForTimeout(150);
const solo = await pg.evaluate(() => {
  const b = [...document.querySelectorAll('#voix .btn')];
  return { actif: document.querySelector('#solo').getAttribute('aria-pressed'),
    eteintes: b.filter((x) => x.style.opacity === '0.35').length };
});
dit(solo.actif === 'true' && solo.eteintes === schema.voix - 1,
  `le solo eteint les ${solo.eteintes} autres voix`);
const codeSolo = await pg.locator('#codeCourant').textContent();
dit(codeSolo === code2, 'le solo ne contamine pas le code : ce n est pas un reglage');
await pg.click('#solo');

await pg.fill('#charger', 'CD3-pipe-FRRH68M8F7PYB6000CD3BBC00J4SMJHG0761J4WT008D36P2N00CH4D069KB0B51204PY8075XVC0');
await pg.click('#btnCharger');
await pg.waitForTimeout(250);
const apresCharge = (await pg.locator('#codeCourant').textContent()).trim();
dit(apresCharge === 'CD3-pipe-FRRH68M8F7PYB6000CD3BBC00J4SMJHG0761J4WT008D36P2N00CH4D069KB0B51204PY8075XVC0', 'un code se recharge tel quel');

await pg.fill('#charger', 'CD3-pipe-FRRH68M8F7PYB6000CD3BBC00J4SMJHG0761J4WT008D36P2N00CH4D069KB0B51204PY8075XVC1');
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

/* Les machines. C'est la reponse a « proposer du choix » : un catalogue de
   timbres tout faits, qui doivent VRAIMENT changer le modele de synthese. */
await pg.evaluate(() => document.querySelector('#voix .btn[data-cle="hat"]').click());
const machines = await pg.locator('#machines .btn').count();
dit(machines >= 4, `la charleston propose ${machines} machines`);
await pg.evaluate(() => [...document.querySelectorAll('#machines .btn')]
  .find((b) => b.textContent.includes('metallique')).click());
await pg.waitForTimeout(200);
/* On ne sait pas quelle ambiance est ouverte a ce stade du banc — un code a
   ete charge entre-temps. On verifie donc qu'EXACTEMENT UNE l'a recu : c'est
   aussi la garantie qu'une machine ne deborde pas sur les autres racks. */
const touches = await pg.evaluate(async () => {
  const m = await import('../src/data/son-presets.js');
  return Object.entries(m.RACKS).filter(([, r]) => r.hat.modele === 'metal').map(([k]) => k);
});
dit(touches.length === 1,
  `choisir une machine change le modele de synthese d une seule ambiance (${touches.join(',') || 'aucune'})`);

/* La graine doit composer une musique, et la page doit le MONTRER : une
   graine dont on ne voit pas l'effet ressemble a un bouton qui ne fait rien. */
const avantMelodie = (await pg.locator('#compose').textContent()).trim();
await pg.click('#tirer');
await pg.waitForTimeout(200);
const apresMelodie = (await pg.locator('#compose').textContent()).trim();
dit(avantMelodie.startsWith('accords') && apresMelodie !== avantMelodie,
  'une nouvelle graine compose une autre musique, et la page l affiche');

await pg.click('#exporter');
await pg.waitForTimeout(150);
const sortie = await pg.locator('#sortie').inputValue();
dit(sortie.includes('export const PRESETS') && sortie.includes('export const RACKS') && sortie.includes('CD3-'),
  `l export rend un bloc reutilisable (${sortie.split('\n').length} lignes)`);

dit(errs.length === 0, errs.length ? errs.join(' | ') : 'aucune erreur de page, aucune ressource manquante');
await b.close(); srv.close();
process.exit(verdicts.every(Boolean) ? 0 : 1);

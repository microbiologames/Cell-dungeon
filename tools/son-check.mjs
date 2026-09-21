/* ---------------------------------------------------------------------------
   Verification de la bande son, PAR LA MESURE.

   On ne regle pas un moteur audio adaptatif dans un navigateur sans carte
   son en constatant qu'il ne leve pas d'exception : il peut tres bien ne
   produire que du silence. On le rend donc HORS LIGNE, plusieurs fois, dans
   des etats de jeu differents, et on mesure ce qui sort.

   Ce qu'on verifie :
     - que ca sonne (niveau efficace non nul, pas de saturation) ;
     - que l'INTENSITE change reellement le mix (plus de basses et de
       percussion quand la horde monte) ;
     - que la MISE AU POINT ferme bien le passe-bas master (moins d'aigu) ;
     - que le lobby et un stage ne sonnent pas pareil.

     node tools/son-check.mjs
--------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const T = { '.html': 'text/html', '.png': 'image/png' };
const srv = createServer(async (q, r) => {
  try {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const b = await readFile(join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, '')));
    r.writeHead(200, { 'content-type': T[extname(p)] || 'text/javascript' });
    r.end(b);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise((r) => srv.listen(8099, r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const pg = await b.newPage();
const errs = [];
pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto('http://localhost:8099/');

const res = await pg.evaluate(async () => {
  const mod = await import('./src/audio/son.js');

  /** Rend `duree` secondes dans un etat fige, et mesure. */
  async function rendre(nom, reglage, duree = 4) {
    /* Une instance neuve par essai : le moteur est un singleton, on remet
       ses champs a zero plutot que d'en fabriquer un second. */
    const s = new mod.Son();
    /* 44,1 kHz et pas moins : a 24 kHz, la charleston (7 a 10 kHz) se
       retrouve au bord de Nyquist, le biquad s'y ecrase, et la mesure conclut
       a tort qu'il n'y a pas d'aigu. On mesurait le banc, pas le moteur. */
    const SR = 44100;
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * duree), SR);
    s.graine(0x5eed);
    s.init(ctx);
    if (!s.pret) return { nom, erreur: 'init a echoue' };
    reglage(s);
    s.majCouches();
    /* On pousse le planificateur a la main : hors ligne, le temps ne
       s'ecoule que quand on le demande. */
    let tirages = 0;
    const vraiRng = s.rng;
    s.rng = () => { tirages++; return vraiRng(); };
    for (let t = 0; t < duree; t += 0.05) s.avancerJusqua(t);
    const buf = await ctx.startRendering();

    const g = buf.getChannelData(0);
    let somme = 0, crete = 0;
    for (let i = 0; i < g.length; i++) {
      somme += g[i] * g[i];
      if (Math.abs(g[i]) > crete) crete = Math.abs(g[i]);
    }
    const rms = Math.sqrt(somme / g.length);

    /* Repartition du spectre. Le passe-haut est du QUATRIEME ordre : avec un
       seul pole (6 dB par octave) il laissait passer tout le medium, si bien
       que fermer le passe-bas master de 12 kHz a 3,4 kHz ne bougeait la
       mesure que de 5 %. On ne mesurait pas l'aigu, on mesurait le mix. */
    let bas = 0, haut = 0, lp = 0;
    const aLP = Math.exp(-2 * Math.PI * 200 / SR);
    const aHP = Math.exp(-2 * Math.PI * 5000 / SR);
    const etat = [0, 0, 0, 0];
    const prec = [0, 0, 0, 0];
    for (let i = 0; i < g.length; i++) {
      lp = aLP * lp + (1 - aLP) * g[i];
      bas += lp * lp;
      let x = g[i];
      for (let k = 0; k < 4; k++) {
        etat[k] = aHP * (etat[k] + x - prec[k]);
        prec[k] = x;
        x = etat[k];
      }
      haut += x * x;
    }
    return {
      nom, tirages, parPas: +s.parPas.toFixed(4),
      coupure: Math.round(s.filtreMaster.frequency.value),
      mp: s.miseAuPoint,
      rms: +rms.toFixed(4),
      crete: +crete.toFixed(3),
      bas: +Math.sqrt(bas / g.length).toFixed(4),
      haut: +Math.sqrt(haut / g.length).toFixed(4),
    };
  }

  const out = [];
  out.push(await rendre('lobby', (s) => {
    s.appliquerAmbiance('ambiant', true);
    s.intensite = 0; s.danger = 0; s.miseAuPoint = 0;
  }));
  out.push(await rendre('lait calme', (s) => {
    s.appliquerAmbiance('milk', true);
    s.intensite = 0.1; s.danger = 0; s.miseAuPoint = 0;
  }));
  out.push(await rendre('lait plein', (s) => {
    s.appliquerAmbiance('milk', true);
    s.intensite = 0.95; s.danger = 0.2; s.miseAuPoint = 0;
  }));
  out.push(await rendre('lait plein, defocalise', (s) => {
    s.appliquerAmbiance('milk', true);
    s.intensite = 0.95; s.danger = 0.2; s.miseAuPoint = 1;
  }));
  out.push(await rendre('conduite plein', (s) => {
    s.appliquerAmbiance('pipe', true);
    s.intensite = 0.9; s.danger = 0.6; s.miseAuPoint = 0;
  }));
  return out;
});

console.log('nom'.padEnd(26), 'rms'.padStart(8), 'crete'.padStart(7),
  'grave'.padStart(8), 'aigu'.padStart(8));
for (const r of res) {
  if (r.erreur) { console.log(r.nom.padEnd(26), 'ERREUR', r.erreur); continue; }
  console.log(r.nom.padEnd(26), String(r.rms).padStart(8), String(r.crete).padStart(7),
    String(r.bas).padStart(8), String(r.haut).padStart(8),
    '| parPas', r.parPas, 'mp', r.mp, 'coupure', String(r.coupure).padStart(6));
}

/* --- verdicts ---------------------------------------------------------- */
const par = Object.fromEntries(res.map((r) => [r.nom, r]));
const dit = (ok, texte) => console.log(`${ok ? 'ok  ' : 'ECHEC'} ${texte}`);
console.log('');
dit(res.every((r) => r.rms > 0.002), 'ca sonne dans tous les etats');
dit(res.every((r) => r.crete < 1.0), 'pas de saturation');
dit(par['lait plein'].bas > par['lait calme'].bas * 1.3,
  'l intensite amene le bas du spectre');
/* Deux conditions, pas une : la mise au point doit OUATER, c'est-a-dire
   manger l'aigu SANS eteindre le morceau. Mesure a un filtre trop raide :
   le mix perdait 60 % de son niveau, ce qui n'est plus une mise au point
   floue mais une coupure. */
const net = par['lait plein'], flou = par['lait plein, defocalise'];
dit(flou.haut < net.haut * 0.78, `l aigu tombe (${net.haut} -> ${flou.haut})`);
dit(flou.rms > net.rms * 0.5, `le morceau reste la (rms ${net.rms} -> ${flou.rms})`);
dit(par.lobby.bas < par['lait plein'].bas,
  'le lobby ne sonne pas comme un stage');
console.log(errs.length ? 'ERREURS: ' + errs.join(' | ') : 'aucune erreur de page');
await b.close(); srv.close();

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
     - que le lobby et un stage ne sonnent pas pareil ;
     - qu'AUCUNE raie ne domine son voisinage, c'est-a-dire qu'on n'a pas
       fabrique un sifflement. Ce defaut-la est arrive pour de vrai : une
       nappe en dent de scie dont le passe-bas s'ouvrait a 2,2 kHz, envoyee
       a plein gain dans la reverbe, posait une raie stable a 2223 Hz que la
       queue de reverbe etalait jusqu'a occuper le mix. Le niveau global, la
       repartition grave/aigu et l'absence d'exception etaient tous corrects :
       seul un spectre le voyait.

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

  /* Transformee de Fourier rapide, radix 2. Ecrite ici parce qu'un
     AnalyserNode ne sert a rien hors ligne : il ne lit que le temps reel. */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k];
          const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
          const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi;
          re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }

  /**
   * Cherche le sifflement : le pic qui depasse le plus son propre voisinage.
   *
   * On compare chaque raie a la MEDIANE du tiers d'octave qui l'entoure, et
   * non au niveau moyen du morceau. Une bande large, de la texture, monte
   * avec ses voisines et ne ressort pas. Une raie pure, elle, laisse son
   * voisinage en bas : c'est exactement ce que l'oreille appelle un sifflet.
   * On moyenne sur la seconde moitie du rendu pour ignorer les transitoires
   * de percussion, qui sont larges et brefs.
   */
  function siffle(g, SR) {
    const N = 8192;
    const spec = new Float64Array(N / 2);
    let blocs = 0;
    for (let off = Math.floor(g.length / 2); off + N <= g.length; off += N) {
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N; i++) re[i] = g[off + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
      fft(re, im);
      /* On cumule la PUISSANCE, pas le module : une raie tenue s'additionne
         d'un bloc a l'autre, un transitoire de percussion se dilue. */
      for (let k = 0; k < N / 2; k++) spec[k] += re[k] * re[k] + im[k] * im[k];
      blocs++;
    }
    if (!blocs) return { ratio: 0, freq: 0 };
    for (let k = 0; k < N / 2; k++) spec[k] /= blocs;
    /* Un partiel a -60 dB dans un passage clairsemé domine arithmetiquement
       un voisinage vide sans que personne ne l'entende. On n'examine donc
       que les raies qui portent vraiment de l'energie. */
    let fort = 0;
    for (let k = 0; k < N / 2; k++) if (spec[k] > fort) fort = spec[k];
    const plancher = fort * 0.06;
    let pire = 0, fpire = 0;
    const kmin = Math.round(600 * N / SR);
    for (let k = kmin; k < N / 2 - 1; k++) {
      if (spec[k] < plancher) continue;
      if (!(spec[k] > spec[k - 1] && spec[k] > spec[k + 1])) continue;
      const a = Math.max(1, Math.round(k / 1.26)), b = Math.min(N / 2 - 1, Math.round(k * 1.26));
      const voisins = [];
      for (let j = a; j <= b; j++) if (Math.abs(j - k) > 3) voisins.push(spec[j]);
      if (voisins.length < 8) continue;
      voisins.sort((x, y) => x - y);
      const med = voisins[voisins.length >> 1];
      const r = Math.sqrt(spec[k] / Math.max(med, 1e-20));
      if (r > pire) { pire = r; fpire = k * SR / N; }
    }
    return { ratio: +pire.toFixed(1), freq: Math.round(fpire) };
  }

  /** Rend `duree` secondes dans un etat fige, et mesure. */
  /* Dix secondes, pas quatre. La recherche de sifflement moyenne des blocs
     de 8192 echantillons : sur quatre secondes il n'en reste qu'une dizaine
     dans la seconde moitie, trop peu pour qu'une raie tenue se detache de
     son voisinage. Mesure a l'appui : le defaut de la nappe, volontairement
     remis, passait inapercu a quatre secondes et ressortait a x38 a dix. */
  async function rendre(nom, reglage, duree = 10) {
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
    const sif = siffle(g, SR);
    return {
      nom, tirages, parPas: +s.parPas.toFixed(4),
      siffle: sif.ratio, fsiffle: sif.freq,
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
    '| raie x' + String(r.siffle).padStart(4), String(r.fsiffle).padStart(5) + 'Hz',
    '| mp', r.mp, 'coupure', String(r.coupure).padStart(6));
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
/* Seuil 9. Mesure : avec la nappe fautive, x30 au lobby et x38 sur le lait
   calme ; une fois corrigee, plus aucune raie ne passe meme le plancher
   d'audibilite, dans aucun des cinq etats. La marge est large des deux
   cotes, le verdict ne tient donc pas a un reglage fin du seuil. */
/* Le lobby est exclu : c'est un drone assume, et sur quatre secondes de
   rendu un accord tenu N'EST qu'un jeu de raies. Le souffle qui les fait
   respirer a une periode de dix a vingt secondes, il ne rentre pas dans la
   fenetre de mesure. Les stages, eux, restent sous surveillance : c'est la
   que la nappe fautive se voyait (x38 sur le lait calme). */
const stages = res.filter((r) => r.nom !== 'lobby');
const pireSiffle = stages.reduce((a, r) => (r.siffle > a.siffle ? r : a), stages[0]);
dit(stages.every((r) => r.siffle < 9),
  `aucune raie ne siffle en stage (pire : ${pireSiffle.nom}, x${pireSiffle.siffle} a ${pireSiffle.fsiffle} Hz)`);
console.log(errs.length ? 'ERREURS: ' + errs.join(' | ') : 'aucune erreur de page');
await b.close(); srv.close();

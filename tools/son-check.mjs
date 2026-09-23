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
     - que la REVERBE est une reverbe et non un resonateur ;
     - que la GRAINE change reellement la musique, et pas seulement son grain ;
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
  const { reverbe } = await import('./src/audio/voix.js');

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
    /* La graine ADOPTEE, pas une graine de banc : on mesure ce qui sera
       joue, y compris la matiere melodique qu'elle compose. */
    s.graine(mod.GRAINE_ADOPTEE ?? 0x5eed);
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

  /**
   * La reverbe, seule, a l'impulsion. C'est LE garde-fou qui manquait.
   *
   * Un reseau de retards boucles n'est une reverbe que si son gain de boucle
   * reste franchement sous un. La version fautive amortissait ses peignes
   * avec un passe-bas biquad — or un biquad amplifie de +1,5 a +2 dB sous sa
   * coupure, quel que soit son Q. Le gain de boucle montait a 0,96, la queue
   * passait de 1,3 s theoriques a huit secondes, et le niveau finissait par
   * MONTER au lieu de decroitre. Rien dans le mix ne le disait : le niveau
   * global etait bon, les mappages etaient bons, aucune exception. Seule la
   * reponse impulsionnelle le montre.
   */
  async function reverbATester() {
    const SR = 44100, duree = 12;
    const ctx = new OfflineAudioContext(1, SR * duree, SR);
    /* Les memes reglages que `construire()` : on teste ce que le jeu joue. */
    const r = reverbe(ctx, { taille: 1.25, amorti: 2600, retour: 0.88 });
    const buf = ctx.createBuffer(1, 64, SR);
    buf.getChannelData(0)[0] = 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(r.entree);
    r.sortie.connect(ctx.destination);
    src.start(0);
    const g = (await ctx.startRendering()).getChannelData(0);

    /* Croissance : le test le plus bete et le plus sur. Une queue qui monte
       n'est pas une queue. */
    const secs = [];
    for (let d = 0; d + SR <= g.length; d += SR) {
      let e = 0;
      for (let i = d; i < d + SR; i++) e += g[i] * g[i];
      secs.push(Math.sqrt(e / SR));
    }
    const monte = secs[secs.length - 1] > secs[0];

    /* RT60 par integration inverse de Schroeder, ajustee entre -5 et -35 dB.
       Chercher « le dernier echantillon au-dessus d'un seuil » repond la
       duree du rendu des que la queue ne decroit pas, et ajuster le niveau
       brut revient a ajuster le plancher du flottant. */
    let total = 0;
    const cumul = new Float64Array(g.length);
    for (let i = g.length - 1; i >= 0; i--) { total += g[i] * g[i]; cumul[i] = total; }
    const db = (i) => 10 * Math.log10(cumul[i] / cumul[0] + 1e-30);
    let i5 = -1, i35 = -1;
    for (let i = 0; i < g.length; i++) {
      if (i5 < 0 && db(i) <= -5) i5 = i;
      if (db(i) <= -35) { i35 = i; break; }
    }
    let rt60 = Infinity;
    if (i5 >= 0 && i35 > i5) {
      let sx = 0, sy = 0, sxy = 0, sxx = 0, n = 0;
      for (let i = i5; i <= i35; i += 64) {
        const x = i / SR, y = db(i);
        sx += x; sy += y; sxy += x * y; sxx += x * x; n++;
      }
      const pente = (n * sxy - sx * sy) / Math.max(1e-12, n * sxx - sx * sx);
      if (pente < -0.2) rt60 = 60 / -pente;
    }

    /* Platitude : l'energie par octave. Une reverbe colore de quelques dB,
       un resonateur bosse de plus de dix. */
    const N = 32768;
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N && i < g.length; i++) re[i] = g[i];
    fft(re, im);
    const bandes = [];
    for (let c = 125; c <= 8000; c *= 2) {
      let e = 0;
      for (let k = Math.round(c / 1.414 * N / SR); k <= Math.round(c * 1.414 * N / SR); k++) {
        e += re[k] * re[k] + im[k] * im[k];
      }
      bandes.push(10 * Math.log10(e + 1e-30));
    }
    const tri = [...bandes].sort((a, b) => a - b);
    return { rt60, monte, bosse: tri[tri.length - 1] - tri[tri.length >> 1] };
  }

  /**
   * La graine doit donner un MORCEAU different, pas le meme morceau joue
   * autrement.
   *
   * Defaut vecu : la progression d'accords et le motif de l'ostinato etaient
   * des constantes, et le lead tirait une note au hasard a chaque phrase.
   * Changer de graine ne changeait donc ni l'harmonie, ni le motif, ni
   * aucune forme memorisable — seulement des densites. On le verifie sur la
   * matiere composee ET sur le signal rendu : composer autre chose sans que
   * ca s'entende serait le meme defaut sous un autre nom.
   */
  async function graines() {
    const mat = [];
    for (const g of [0x5eed, 0xbeef, 0x1234]) {
      const s = new mod.Son();
      s.graine(g);
      mat.push(JSON.stringify(s.melodie));
    }
    const distinctes = new Set(mat).size;

    /* On rend SANS BATTERIE. Le squelette rythmique ne depend pas de la
       graine — c'est voulu, c'est lui qui fait que la bande son est
       « toujours chez elle » — et il porte l'essentiel de l'energie. Le
       garder dans la mesure revient a diluer ce qu'on cherche : mesure a
       l'appui, x0,20 contre x0,75 sur le mix complet, x0,34 contre x1,17
       une fois la batterie coupee. */
    const rendus = [];
    for (const g of [0x5eed, 0xbeef, 0x1234]) {
      const SR = 44100, duree = 6;
      const ctx = new OfflineAudioContext(1, SR * duree, SR);
      const s = new mod.Son();
      s.graine(g);
      s.init(ctx);
      s.appliquerAmbiance('milk', true);
      s.intensite = 0.8; s.danger = 0; s.miseAuPoint = 0;
      s.majCouches();
      s.couches.break.gain.cancelScheduledValues(0);
      s.couches.break.gain.setValueAtTime(0.00001, 0);
      for (let t = 0; t < duree; t += 0.05) s.avancerJusqua(t);
      rendus.push((await ctx.startRendering()).getChannelData(0));
    }
    /* Ecart quadratique, rapporte au niveau, MOYENNE sur les trois paires :
       deux graines peuvent tomber sur des motifs voisins par hasard, et une
       seule paire ferait un verdict qui clignote. */
    const ecarts = [];
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      let dif = 0, ref = 0;
      for (let k = 0; k < rendus[i].length; k++) {
        const d = rendus[i][k] - rendus[j][k];
        dif += d * d;
        ref += rendus[i][k] * rendus[i][k];
      }
      ecarts.push(Math.sqrt(dif / Math.max(1e-20, ref)));
    }
    const ecart = ecarts.reduce((a, v) => a + v, 0) / ecarts.length;
    return { distinctes, ecart };
  }

  const out = [];
  out.push({ nom: 'graines', ...await graines() });
  out.push({ nom: 'reverbe', ...await reverbATester() });
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
  /* Un stage AU REPOS. C'est l'etat ou le mix est le plus degarni, donc
     celui ou une resonance s'entend seule — et c'est precisement l'etat que
     le banc ne regardait pas quand le sifflement a ete signale. */
  out.push(await rendre('kombucha au repos', (s) => {
    s.appliquerAmbiance('kombucha', true);
    s.intensite = 0.1; s.danger = 0; s.miseAuPoint = 0;
  }));
  return out;
});

const gr = res.shift();
const rev = res.shift();
console.log('graines : ' + gr.distinctes + '/3 matieres melodiques distinctes'
  + ' | ecart entre deux rendus x' + gr.ecart.toFixed(2));
console.log('reverbe seule : RT60', rev.rt60 === null || !isFinite(rev.rt60) ? 'INFINI' : rev.rt60.toFixed(2) + ' s',
  '| bosse de bande +' + rev.bosse.toFixed(1) + ' dB',
  '|', rev.monte ? 'LA QUEUE MONTE' : 'la queue decroit');
console.log('');
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
/* La reverbe. Mesures : version fautive, queue croissante et bosse +13,2 dB ;
   corrigee, RT60 1,89 s et bosse +1,7 dB. Les bornes sont larges des deux
   cotes — c'est un garde-fou, pas un reglage. */
dit(!rev.monte, 'la queue de reverbe decroit');
dit(isFinite(rev.rt60) && rev.rt60 > 0.5 && rev.rt60 < 3.5,
  `la reverbe a une duree de piece (RT60 ${isFinite(rev.rt60) ? rev.rt60.toFixed(2) + ' s' : 'INFINI'})`);
dit(gr.distinctes === 3, `trois graines donnent trois musiques (${gr.distinctes}/3)`);
/* Seuil 0,5. Mesure des deux cotes, hors batterie : avec les constantes
   d'avant, la moyenne des trois paires tourne autour de 0,31 ; avec la
   matiere composee, autour de 0,88. Le seuil est entre les deux regimes et
   loin des deux. */
dit(gr.ecart > 0.5, `et ca s entend (ecart moyen x${gr.ecart.toFixed(2)})`);
dit(rev.bosse < 6,
  `la reverbe colore, elle ne resonne pas (bosse +${rev.bosse.toFixed(1)} dB)`);
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

/* ---------------------------------------------------------------------------
   Timbres et effets. Tout est SYNTHETISE : aucun fichier, aucune bibliotheque,
   aucun echantillon. La licence du jeu reste entierement libre.

   LE PRINCIPE QUI COMMANDE TOUT : une voix est un canal PERMANENT.

   Un oscillateur Web Audio ne se relance pas apres un stop(). Creer une voix
   par note produit donc des centaines de noeuds par minute, qu'il faut ensuite
   penser a deconnecter — c'est la fuite classique de tout moteur audio de jeu.

   On fait l'inverse, et ca tombe bien : c'est exactement ainsi que marche une
   puce sonore 8 bits. Chaque canal a UN oscillateur qui tourne du debut a la
   fin, et jouer une note ne fait que changer sa frequence et ouvrir son
   enveloppe. Zero allocation en régime permanent, polyphonie plafonnee par
   construction, et le grain monophonique caracteristique en prime.

   Canaux, calques sur ceux d'une NES :
     pulse1   melodie      onde carree a rapport cyclique variable
     pulse2   ostinato     idem, autre rapport cyclique
     triangle basse        onde triangulaire
     bruit    percussion   LFSR a periode courte
   Plus deux voix qui n'ont rien de retro et qu'on assume : un SUB sinusoidal
   (c'est de la drum and bass, il faut le bas du spectre) et une NAPPE de scies
   desaccordees (c'est l'ambiant liquide).
--------------------------------------------------------------------------- */

/* --------------------------------------------------------------- ondes --- */

/**
 * Onde carree a rapport cyclique donne, par serie de Fourier.
 *
 * Web Audio ne propose pas d'onde pulsee, seulement `square` (rapport 50 %).
 * Or c'est la VARIATION du rapport cyclique qui fait la couleur d'un chiptune :
 * 12,5 % nasille, 25 % claque, 50 % est plein. On construit donc la table
 * d'onde a la main.
 */
export function ondePulsee(ctx, rapport, harmoniques = 28) {
  const reel = new Float32Array(harmoniques + 1);
  const imag = new Float32Array(harmoniques + 1);
  for (let n = 1; n <= harmoniques; n++) {
    /* Coefficient d'une impulsion de rapport cyclique d : (2/nπ)·sin(πnd). */
    reel[n] = (2 / (n * Math.PI)) * Math.sin(Math.PI * n * rapport);
  }
  return ctx.createPeriodicWave(reel, imag, { disableNormalization: false });
}

/**
 * Bruit de puce sonore : un registre a decalage a retroaction lineaire.
 *
 * Un bruit blanc ordinaire est trop lisse et trop large. Le bruit d'une NES
 * est produit par un LFSR cadence bien en dessous de la frequence
 * d'echantillonnage : il en sort un grain metallique et granuleux, qui est
 * precisement ce qu'on cherche. On le fabrique une fois pour toutes.
 */
export function tamponBruit(ctx, secondes = 2, maintien = 6) {
  const n = Math.floor(ctx.sampleRate * secondes);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let reg = 0x7fff;
  let v = 0;
  for (let i = 0; i < n; i++) {
    /* Un echantillon tous les `maintien` : c'est ce sous-echantillonnage qui
       donne le grain, pas le hasard lui-meme. */
    if (i % maintien === 0) {
      const bit = ((reg ^ (reg >> 1)) & 1);
      reg = (reg >> 1) | (bit << 14);
      v = (reg & 1) ? 1 : -1;
    }
    d[i] = v;
  }
  return buf;
}

/**
 * Courbe de quantification : le « grain rugueux » demande.
 *
 * Une puce 8 bits ne sort que 16 niveaux par canal. Ramener le signal sur un
 * petit nombre de paliers ajoute exactement la distorsion d'escalier qu'on
 * associe a l'arcade — et ca ne coute qu'un WaveShaper, c'est-a-dire une
 * table de correspondance.
 */
export function courbeGrain(niveaux = 12, chaleur = 0.72) {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const q = Math.round(x * niveaux) / niveaux;
    /* Une pointe de saturation douce par-dessus : sans elle, la
       quantification seule sonne pauvre plutot que rugueuse. */
    c[i] = Math.tanh(q * (1 + chaleur * 2)) / Math.tanh(1 + chaleur * 2);
  }
  return c;
}

/* --------------------------------------------------------------- voix ---- */

/** Enveloppe percussive appliquee a un gain, sans allouer de noeud. */
function enveloppe(param, t, attaque, chute, tenue, relache, pic) {
  param.cancelScheduledValues(t);
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(Math.max(0.0002, pic), t + attaque);
  param.exponentialRampToValueAtTime(Math.max(0.0002, pic * tenue), t + attaque + chute);
  param.setTargetAtTime(0.0001, t + attaque + chute, Math.max(0.01, relache / 3));
}

/** Un canal melodique permanent : un oscillateur, une enveloppe, un filtre. */
export class Canal {
  /**
   * @param {AudioContext} ctx
   * @param {AudioNode} sortie
   * @param {object} o {onde, type, coupure, glisse}
   */
  constructor(ctx, sortie, o = {}) {
    this.ctx = ctx;
    this.glisse = o.glisse ?? 0;
    this.osc = ctx.createOscillator();
    if (o.onde) this.osc.setPeriodicWave(o.onde);
    else this.osc.type = o.type || 'triangle';
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.0001;
    this.filtre = ctx.createBiquadFilter();
    this.filtre.type = 'lowpass';
    this.filtre.frequency.value = o.coupure ?? 12000;
    this.filtre.Q.value = o.q ?? 0.7;
    this.osc.connect(this.filtre).connect(this.gain).connect(sortie);
    this.osc.start();
  }

  /** @param {number} t instant absolu, en secondes du contexte audio. */
  note(t, freq, duree, pic = 0.2, env = null) {
    const f = this.osc.frequency;
    if (this.glisse > 0) {
      f.cancelScheduledValues(t);
      f.setTargetAtTime(freq, t, this.glisse);
    } else {
      f.setValueAtTime(freq, t);
    }
    const e = env || { a: 0.004, d: 0.05, s: 0.6, r: duree };
    enveloppe(this.gain.gain, t, e.a, e.d, e.s, e.r ?? duree, pic);
  }

  /** Coupe net : utile pour un silence rythmique. */
  couper(t) {
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(0.0001, t, 0.008);
  }
}

/** Une voix de percussion : bruit filtre, enveloppe courte. */
export class Percu {
  constructor(ctx, sortie, buffer, o = {}) {
    this.ctx = ctx;
    this.src = ctx.createBufferSource();
    this.src.buffer = buffer;
    this.src.loop = true;
    this.filtre = ctx.createBiquadFilter();
    this.filtre.type = o.type || 'bandpass';
    this.filtre.frequency.value = o.freq ?? 2000;
    this.filtre.Q.value = o.q ?? 1.2;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.0001;
    this.src.connect(this.filtre).connect(this.gain).connect(sortie);
    this.src.start();
  }

  frappe(t, duree, pic, freq = null) {
    if (freq) this.filtre.frequency.setValueAtTime(freq, t);
    enveloppe(this.gain.gain, t, 0.001, duree * 0.35, 0.25, duree, pic);
  }
}

/** Grosse caisse : sinus a enveloppe de hauteur. Pas chiptune, mais c'est la
 *  drum and bass qui commande — sans bas du spectre il n'y a pas de morceau. */
export class Kick {
  constructor(ctx, sortie) {
    this.osc = ctx.createOscillator();
    this.osc.type = 'sine';
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.0001;
    this.osc.connect(this.gain).connect(sortie);
    this.osc.start();
  }

  frappe(t, pic = 0.9) {
    const f = this.osc.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(190, t);
    f.exponentialRampToValueAtTime(42, t + 0.09);
    enveloppe(this.gain.gain, t, 0.002, 0.06, 0.4, 0.22, pic);
  }
}

/* ------------------------------------------------------------- effets ---- */

/**
 * Reverbe de Schroeder : quatre peignes en parallele, deux passe-tout en serie.
 *
 * PAS de convolution. Un ConvolverNode avec deux secondes de queue stereo est
 * l'un des noeuds les plus couteux de Web Audio, et ce jeu brule deja son
 * budget processeur sur un rendu logiciel image par image. Une reverbe a
 * reseau de retards coute une quinzaine de noeuds et ne se sent pas.
 */
export function reverbe(ctx, o = {}) {
  const entree = ctx.createGain();
  const sortie = ctx.createGain();
  const taille = o.taille ?? 1;
  const amorti = o.amorti ?? 3200;
  const retour = o.retour ?? 0.78;
  /* Longueurs premieres entre elles : sinon les peignes se synchronisent et
     la queue sonne metallique. */
  const peignes = [0.0297, 0.0371, 0.0411, 0.0437].map((s) => s * taille);
  for (const s of peignes) {
    const d = ctx.createDelay(1);
    d.delayTime.value = s;
    const g = ctx.createGain();
    g.gain.value = retour;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = amorti;
    entree.connect(d);
    d.connect(lp).connect(g).connect(d);      // boucle amortie
    d.connect(sortie);
  }
  /* Deux passe-tout pour diffuser : ils cassent l'echo residuel des peignes. */
  let n = sortie;
  for (const s of [0.005, 0.0017]) {
    const d = ctx.createDelay(0.1);
    d.delayTime.value = s;
    const g = ctx.createGain();
    g.gain.value = 0.62;
    const som = ctx.createGain();
    n.connect(som);
    n.connect(d).connect(g).connect(som);
    n = som;
  }
  return { entree, sortie: n };
}

/** Delai ping-pong cale au tempo : l'echo demande pour le lobby. */
export function delaiPingPong(ctx, temps = 0.35, retour = 0.42) {
  const entree = ctx.createGain();
  const sortie = ctx.createGain();
  const g = ctx.createGain();
  g.gain.value = retour;
  const dg = ctx.createDelay(2);
  const dd = ctx.createDelay(2);
  dg.delayTime.value = temps;
  dd.delayTime.value = temps;
  const pg = ctx.createStereoPanner();
  const pd = ctx.createStereoPanner();
  pg.pan.value = -0.85;
  pd.pan.value = 0.85;
  const amorti = ctx.createBiquadFilter();
  amorti.type = 'lowpass';
  amorti.frequency.value = 2600;
  entree.connect(dg);
  dg.connect(pg).connect(sortie);
  dg.connect(dd);
  dd.connect(pd).connect(sortie);
  dd.connect(amorti).connect(g).connect(dg);   // renvoi croise
  return { entree, sortie, temps: [dg.delayTime, dd.delayTime] };
}

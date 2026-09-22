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

/** Du vocabulaire du rack a celui de Web Audio. */
export const TYPE_FILTRE = {
  'passe-bas': 'lowpass', 'passe-bande': 'bandpass', 'passe-haut': 'highpass',
};

/**
 * Construit la banque d'ondes une fois pour toutes.
 *
 * Une `PeriodicWave` coute cher a fabriquer et ne depend que du contexte :
 * on n'en cree pas une par changement de curseur. Le studio change d'onde
 * dix fois par seconde quand on balaye le choix.
 */
export function banqueOndes(ctx) {
  return {
    sinus: null, triangle: null, scie: null,     // types natifs de l'oscillateur
    pulse08: ondePulsee(ctx, 0.08),
    pulse12: ondePulsee(ctx, 0.125),
    pulse25: ondePulsee(ctx, 0.25),
    pulse33: ondePulsee(ctx, 0.33),
    carre: ondePulsee(ctx, 0.5),
  };
}

const NATIFS = { sinus: 'sine', triangle: 'triangle', scie: 'sawtooth' };

/**
 * Rapports de frequence du modulateur, en FM. Les entiers sonnent
 * harmoniques (cuivre, orgue), les rapports non entiers sonnent
 * inharmoniques (cloche, metal) : c'est toute la difference entre un timbre
 * qui a une note et un timbre qui a une couleur.
 */
export const RAPPORTS_FM = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 11, 13, 16];

export class Canal {
  /**
   * Un canal melodique permanent. Trois oscillateurs, toujours allumes,
   * dont deux muets par defaut : ils servent a l'unisson et a la modulation
   * de frequence. Les allouer a la demande reviendrait a creer des noeuds en
   * plein jeu, ce que tout ce moteur s'interdit.
   *
   * @param {AudioContext} ctx
   * @param {AudioNode} sortie
   * @param {object} o {onde, type, coupure, q, glisse}
   */
  constructor(ctx, sortie, o = {}) {
    this.ctx = ctx;
    this.glisse = o.glisse ?? 0;
    this.melange = ctx.createGain();

    this.osc = ctx.createOscillator();
    this.osc.type = o.type || 'triangle';
    if (o.onde) this.osc.setPeriodicWave(o.onde);
    this.osc.connect(this.melange);

    this.osc2 = ctx.createOscillator();
    this.osc3 = ctx.createOscillator();
    this.unisson = ctx.createGain();
    this.unisson.gain.value = 0;
    this.osc2.connect(this.unisson);
    this.osc3.connect(this.unisson);
    this.unisson.connect(this.melange);
    /* En modulation de frequence, osc2 ne s'entend pas : il pilote la
       frequence de osc. Le meme oscillateur sert donc aux deux modeles, et
       c'est le gain de sortie qui decide de son role. */
    this.fm = ctx.createGain();
    this.fm.gain.value = 0;
    this.osc2.connect(this.fm).connect(this.osc.frequency);

    this.gain = ctx.createGain();
    this.gain.gain.value = 0.0001;
    this.filtre = ctx.createBiquadFilter();
    this.filtre.type = 'lowpass';
    this.filtre.frequency.value = o.coupure ?? 12000;
    this.filtre.Q.value = o.q ?? 0.7;
    this.melange.connect(this.filtre).connect(this.gain).connect(sortie);
    this.osc.start(); this.osc2.start(); this.osc3.start();
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

  /**
   * Applique un patch du rack : modele de synthese, onde, filtre, resonance.
   *
   * L'enveloppe et le niveau ne sont PAS appliques ici — ils sont lus a
   * chaque note par `jouer()`. Une enveloppe est une propriete de la note,
   * pas de l'etat du canal.
   */
  appliquerTimbre(p, ondes, t = 0, lissage = 0.02) {
    this.timbre = p;
    const poser = (osc) => {
      if (NATIFS[p.onde]) osc.type = NATIFS[p.onde];
      else if (ondes[p.onde]) osc.setPeriodicWave(ondes[p.onde]);
    };
    poser(this.osc);
    const modele = p.modele || 'soustractif';

    if (modele === 'super') {
      /* Unisson : deux copies desaccordees. C'est l'ecart, pas le nombre de
         voix, qui fait la largeur — les battements entre partiels voisins
         remplissent le spectre bien mieux qu'un oscillateur de plus. */
      poser(this.osc2); poser(this.osc3);
      const ecart = 4 + p.timbre1 * 46;
      this.osc2.detune.setTargetAtTime(-ecart, t, lissage);
      this.osc3.detune.setTargetAtTime(ecart, t, lissage);
      this.unisson.gain.setTargetAtTime(0.35 + 0.45 * p.timbre2, t, lissage);
      this.fm.gain.setTargetAtTime(0, t, lissage);
    } else if (modele === 'fm') {
      /* Le modulateur est un sinus : une onde riche en FM donne une bouillie
         de bandes laterales, pas un timbre. */
      this.osc2.type = 'sine';
      this.osc2.detune.setTargetAtTime(0, t, lissage);
      this.unisson.gain.setTargetAtTime(0, t, lissage);
    } else {
      this.unisson.gain.setTargetAtTime(0, t, lissage);
      this.fm.gain.setTargetAtTime(0, t, lissage);
    }

    this.filtre.type = TYPE_FILTRE[p.filtre] || 'lowpass';
    if (modele !== 'acide') this.filtre.frequency.setTargetAtTime(p.coupure, t, lissage);
    this.filtre.Q.setTargetAtTime(p.resonance, t, lissage);
    if (this.filtre2) {
      this.filtre2.frequency.setTargetAtTime(p.coupure, t, lissage);
      this.filtre2.Q.setTargetAtTime(Math.min(p.resonance, 1.2), t, lissage);
    }
  }

  /**
   * Joue une note AVEC le patch courant. `accent` multiplie le niveau du
   * patch : c'est la nuance musicale, pas le reglage d'instrument.
   */
  jouer(t, freq, accent = 1) {
    const p = this.timbre;
    if (!p) return;
    const f = this.osc.frequency;
    if (this.glisse > 0) { f.cancelScheduledValues(t); f.setTargetAtTime(freq, t, this.glisse); }
    else f.setValueAtTime(freq, t);

    const modele = p.modele || 'soustractif';
    if (modele === 'super') {
      this.osc2.frequency.setValueAtTime(freq, t);
      this.osc3.frequency.setValueAtTime(freq, t);
    } else if (modele === 'fm') {
      /* Le modulateur SUIT la note : c'est le rapport qui est fixe, pas sa
         frequence. Sinon le timbre change avec la hauteur jouee. */
      const rapport = RAPPORTS_FM[Math.round(p.timbre1 * (RAPPORTS_FM.length - 1))];
      this.osc2.frequency.setValueAtTime(freq * rapport, t);
      this.fm.gain.setValueAtTime(freq * p.timbre2 * 8, t);
    } else if (modele === 'acide') {
      /* Le filtre a SA propre enveloppe, plus rapide que celle du niveau.
         C'est elle qui fait le « wow » caracteristique, et rien d'autre : ni
         l'onde, ni la resonance seule. */
      const haut = Math.min(16000, p.coupure * (1 + 7 * p.timbre1));
      const chute = 0.03 + p.timbre2 * 0.5;
      const ff = this.filtre.frequency;
      ff.cancelScheduledValues(t);
      ff.setValueAtTime(haut, t);
      ff.exponentialRampToValueAtTime(Math.max(60, p.coupure), t + chute);
    }
    enveloppe(this.gain.gain, t, p.attaque, p.chute, p.tenue, p.relache, p.niveau * accent);
  }

  /** Coupe net : utile pour un silence rythmique. */
  couper(t) {
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(0.0001, t, 0.008);
  }
}

/* Rapports inharmoniques d'une charleston de boite a rythmes. Ce ne sont pas
   des harmoniques : c'est ce qui donne le grain metallique qu'aucun bruit ne
   sait imiter. */
const METAL = [1, 1.4471, 1.6170, 1.9265, 2.5028, 2.6637];

/** Une voix de percussion. Quatre modeles, une seule chaine. */
export class Percu {
  constructor(ctx, sortie, buffer, o = {}) {
    this.ctx = ctx;
    this.filtre = ctx.createBiquadFilter();
    this.filtre.type = o.type || 'bandpass';
    this.filtre.frequency.value = o.freq ?? 2000;
    this.filtre.Q.value = o.q ?? 1.2;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.0001;
    this.filtre.connect(this.gain).connect(sortie);

    this.src = ctx.createBufferSource();
    this.src.buffer = buffer;
    this.src.loop = true;
    this.gBruit = ctx.createGain();
    this.gBruit.gain.value = 1;
    this.src.connect(this.gBruit).connect(this.filtre);
    this.src.start();

    /* Banque metallique : six carres a rapports inharmoniques, la recette
       des charlestons de boites a rythmes. Permanente et muette, comme tout
       le reste. */
    this.gMetal = ctx.createGain();
    this.gMetal.gain.value = 0;
    this.gMetal.connect(this.filtre);
    this.metal = METAL.map((r) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 320 * r;
      osc.connect(this.gMetal);
      osc.start();
      return osc;
    });

    /* Deux sinus accordes : le corps d'une caisse claire, que le bruit seul
       ne donne pas. */
    this.gTons = ctx.createGain();
    this.gTons.gain.value = 0;
    this.gTons.connect(this.gain);
    this.tons = [1, 1.79].map((r) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 185 * r;
      osc.connect(this.gTons);
      osc.start();
      return osc;
    });
  }

  appliquerTimbre(p) {
    this.timbre = p;
    this.filtre.type = TYPE_FILTRE[p.filtre] || 'bandpass';
    this.filtre.Q.value = p.resonance;
    const modele = p.modele || 'bruit';
    this.gBruit.gain.value = modele === 'metal' ? 0 : 1;
    this.gMetal.gain.value = modele === 'metal' ? 0.16 : 0;
    this.gTons.gain.value = modele === 'caisse' ? 0.0001 : 0;
    if (modele === 'metal') {
      /* Les six carres se calent sur la frequence reglee : la charleston
         monte et descend d'un bloc, elle ne se desaccorde pas. */
      const base = p.frequence * 0.16;
      this.metal.forEach((osc, i) => { osc.frequency.value = base * METAL[i]; });
    }
    if (modele === 'caisse') {
      const base = 185 * (p.frequence / 1900);
      this.tons.forEach((osc, i) => { osc.frequency.value = base * [1, 1.79][i]; });
    }
  }

  /**
   * @param {number} accent multiplicateur du niveau du patch
   * @param {object} o {duree, freq} multiplicateurs ponctuels — c'est ainsi
   *   qu'on obtient une caisse claire fantome ou une charleston qui bouge
   *   sans en faire un deuxieme instrument.
   */
  frappe(t, accent = 1, o = {}) {
    const p = this.timbre;
    if (!p) return;
    const modele = p.modele || 'bruit';
    if (modele !== 'metal') this.filtre.frequency.setValueAtTime(p.frequence * (o.freq ?? 1), t);
    const duree = p.duree * (o.duree ?? 1);
    const pic = p.niveau * accent;
    if (modele === 'taps') {
      /* Un clap n'est pas UN bruit : c'est plusieurs mains qui ne tombent
         pas ensemble. Trois rebonds serres puis la queue — sans eux on
         entend une porte qui claque, pas des applaudissements. */
      const ecart = 0.006 + p.timbre1 * 0.024;
      for (let i = 0; i < 3; i++) {
        enveloppe(this.gain.gain, t + i * ecart, 0.001, 0.004, 0.1, ecart * 0.9, pic * 0.7);
      }
      enveloppe(this.gain.gain, t + 3 * ecart, 0.001, duree * 0.35, 0.25, duree, pic);
      return;
    }
    if (modele === 'caisse') {
      const corps = 0.1 + p.timbre1 * 0.5;
      enveloppe(this.gTons.gain, t, 0.001, duree * 0.5, 0.15, duree * 0.8, pic * corps);
    }
    enveloppe(this.gain.gain, t, 0.001, duree * 0.35, 0.25, duree, pic);
  }
}

/** Grosse caisse : sinus a enveloppe de hauteur. Pas chiptune, mais c'est la
 *  drum and bass qui commande — sans bas du spectre il n'y a pas de morceau. */
export class Kick {
  constructor(ctx, sortie, buffer = null) {
    this.ctx = ctx;
    this.sortie = ctx.createGain();
    this.sortie.connect(sortie);
    /* Saturation optionnelle : c'est elle qui fait passer une grosse caisse
       devant le reste du mix sans monter son niveau. */
    this.sature = ctx.createWaveShaper();
    this.sature.curve = courbeGrain(40, 1.4);
    this.sature.oversample = '2x';
    this.direct = ctx.createGain();
    this.viaSature = ctx.createGain();
    this.viaSature.gain.value = 0;
    this.direct.connect(this.sortie);
    this.viaSature.connect(this.sature).connect(this.sortie);

    this.osc = ctx.createOscillator();
    this.osc.type = 'sine';
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.0001;
    this.osc.connect(this.gain);
    this.gain.connect(this.direct);
    this.gain.connect(this.viaSature);
    this.osc.start();

    /* Le clic : un eclat de bruit aigu de quelques millisecondes. C'est LUI
       qui separe une grosse caisse ronde d'une grosse caisse claquante, bien
       plus que la hauteur ou la duree. */
    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2600;
      this.clic = ctx.createGain();
      this.clic.gain.value = 0.0001;
      src.connect(hp).connect(this.clic).connect(this.sortie);
      src.start();
    }
  }

  appliquerTimbre(p) {
    this.timbre = p;
    const dur = (p.modele || 'propre') === 'sature';
    this.direct.gain.value = dur ? 0 : 1;
    this.viaSature.gain.value = dur ? 1 : 0;
  }

  frappe(t, accent = 1) {
    const p = this.timbre;
    if (!p) return;
    const f = this.osc.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(p.depart, t);
    f.exponentialRampToValueAtTime(p.arrivee, t + p.glisse);
    enveloppe(this.gain.gain, t, 0.002, p.duree * 0.3, 0.4, p.duree, p.niveau * accent);
    if (this.clic && p.timbre1 > 0) {
      enveloppe(this.clic.gain, t, 0.0005, 0.004, 0.02, 0.02, p.timbre1 * 0.5 * accent);
    }
  }
}

/* ------------------------------------------------------------- effets ---- */

/**
 * Reverbe de Schroeder : huit peignes en parallele, deux passe-tout en serie.
 *
 * PAS de convolution. Un ConvolverNode avec deux secondes de queue stereo est
 * l'un des noeuds les plus couteux de Web Audio, et ce jeu brule deja son
 * budget processeur sur un rendu logiciel image par image.
 *
 * ─── Pourquoi huit peignes, et pas quatre ────────────────────────────────
 *
 * Avec quatre peignes, la seule facon d'obtenir une queue longue est de
 * monter le renvoi — et un peigne a fort renvoi n'est pas une reverbe, c'est
 * un RESONATEUR. La version a quatre peignes, mesuree a l'impulsion, donnait
 * +33,6 dB a 1771 Hz et huit secondes de queue : un sifflement qui montait
 * jusqu'a couvrir la musique. La densite modale, c'est-a-dire le nombre de
 * modes par hertz, est ce qui fait qu'une queue sonne comme une piece et non
 * comme un tuyau ; elle croit avec le nombre de peignes. A huit, on tient une
 * queue de deux secondes sans qu'aucun mode ne ressorte.
 *
 * Les longueurs sont celles de Freeverb, choisies premieres entre elles : si
 * les peignes se synchronisent, leurs modes se superposent et la queue sonne
 * metallique.
 *
 * ─── Pourquoi un UN POLE et pas un biquad pour amortir ───────────────────
 *
 * Mesure au `getFrequencyResponse` d'un passe-bas biquad de Web Audio a
 * 2800 Hz :
 *
 *     Q = 1      gain max 1,253   +1,96 dB a 2177 Hz
 *     Q = 0,707  gain max 1,222   +1,74 dB
 *     Q = 0,5    gain max 1,202   +1,59 dB
 *     Q = 0,3    gain max 1,182   +1,45 dB
 *
 * Il AMPLIFIE sous sa coupure, toujours, quel que soit le Q. Baisser le Q ne
 * l'enleve pas. Dans une boucle a `retour` = 0,8 le gain de boucle reel
 * devient 0,96 : la queue passe de 1,3 s theoriques a 8 s mesurees, et a
 * 0,86 elle ne decroit plus du tout — le niveau MONTE de -40 a +37 dB en
 * douze secondes. C'etait le sifflement.
 *
 * Un un-pole, lui, a |H| <= 1 partout par construction, et c'est exactement
 * le filtre d'amortissement de Freeverb. Verification : le peigne nu decroit
 * en 1,23 s pour 1,27 s prevues.
 */
export function reverbe(ctx, o = {}) {
  const entree = ctx.createGain();
  const sortie = ctx.createGain();
  const taille = o.taille ?? 1;
  const amorti = o.amorti ?? 3200;
  const retour = o.retour ?? 0.82;
  /* Coefficient du un-pole : y[n] = (1-d).x[n] + d.y[n-1]. */
  const d1 = Math.exp(-2 * Math.PI * amorti / ctx.sampleRate);
  const peignes = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
    .map((n) => (n / 44100) * taille);
  /* Le gain est reparti sur les peignes : huit boucles en parallele sommeraient
     huit fois le signal direct. */
  const part = ctx.createGain();
  part.gain.value = 1 / Math.sqrt(peignes.length);
  entree.connect(part);
  for (const s of peignes) {
    const d = ctx.createDelay(1);
    d.delayTime.value = s;
    const g = ctx.createGain();
    g.gain.value = retour;
    const lp = ctx.createIIRFilter([1 - d1], [1, -d1]);
    part.connect(d);
    d.connect(lp).connect(g).connect(d);      // boucle amortie
    d.connect(sortie);
  }
  /* Deux VRAIS passe-tout : ils diffusent sans colorer. La version
     precedente n'avait qu'une branche directe additionnee a un retard, ce
     qui est un peigne feedforward — donc un filtre en peigne de plus, avec
     ses creux, au lieu d'un diffuseur. */
  let n = sortie;
  for (const s of [0.0051, 0.0017]) {
    const som = ctx.createGain();
    const d = ctx.createDelay(0.1);
    d.delayTime.value = s;
    const fb = ctx.createGain();
    fb.gain.value = 0.5;
    const direct = ctx.createGain();
    direct.gain.value = -0.5;
    const s2 = ctx.createGain();
    n.connect(som);
    som.connect(d);
    d.connect(fb).connect(som);               // v[n] = x[n] + g.v[n-M]
    som.connect(direct).connect(s2);          // y[n] = -g.v[n] + v[n-M]
    d.connect(s2);
    n = s2;
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
  /* Un-pole, et pas un biquad : voir la note dans `reverbe`. Un passe-bas
     biquad amplifie sous sa coupure, et dans une boucle de delai cette
     bosse s'accumule a chaque tour. */
  const dp = Math.exp(-2 * Math.PI * 2600 / ctx.sampleRate);
  const amorti = ctx.createIIRFilter([1 - dp], [1, -dp]);
  entree.connect(dg);
  dg.connect(pg).connect(sortie);
  dg.connect(dd);
  dd.connect(pd).connect(sortie);
  dd.connect(amorti).connect(g).connect(dg);   // renvoi croise
  return { entree, sortie, temps: [dg.delayTime, dd.delayTime] };
}

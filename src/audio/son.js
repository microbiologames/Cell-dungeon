/* ---------------------------------------------------------------------------
   Bande son generative et adaptative.

   Rien n'est enregistre : tout est synthetise a la volee (voir voix.js) et
   assemble en direct selon l'etat du jeu. Deux ambiances :

     LOBBY et BESTIAIRE  drone lent, nappes longues, reverbe ouverte et echo.
                         On observe, on ne se bat pas.
     MATRICES            drum and bass a grain chiptune. Ondes carrees et
                         triangulaires qui coupent le mix, ostinato hypnotique,
                         melodies courtes. Mais l'ambiance reste LIQUIDE, pas
                         souterraine : nappes mouvantes, echo, glissandos.

   ─── Comment ca se branche ────────────────────────────────────────────────

   Le moteur OBSERVE, on ne lui pousse rien. `observe(scene, game, dt)` est
   appele une fois par image et deduit tout seul l'intensite, la mise au
   point, le danger, le pH, l'arrivee d'un boss, le passage d'un NEP, les
   coups encaisses et les mises a mort. C'est la meme convention que le
   rendu, qui LIT `game` au lieu de se le faire pousser — et la consequence
   est concrete : ajouter une matrice ne demande aucun cablage audio, et le
   code de jeu ne connait pas l'existence du son.

   ─── Timing ───────────────────────────────────────────────────────────────

   Deux horloges. Un `setInterval` grossier reveille le planificateur toutes
   les 25 ms ; celui-ci inscrit les notes a l'avance sur l'horloge d'echantillon
   (`ctx.currentTime`). Une note planifiee est donc a sa place a la
   milliseconde pres, meme si une image du jeu prend 40 ms.

   ─── Garde-fous ───────────────────────────────────────────────────────────

   Avant `init()`, toute la surface publique est un no-op. `init()` ne peut
   etre appele que depuis un geste utilisateur (politique d'autoplay). Si quoi
   que ce soit echoue, le moteur se desactive en silence : le jeu ne doit
   jamais tomber parce que le son n'est pas disponible.
--------------------------------------------------------------------------- */

import { clamp, mulberry32 } from '../core/util.js';
import {
  ondePulsee, tamponBruit, courbeGrain, Canal, Percu, Kick, reverbe, delaiPingPong,
} from './voix.js';

/* ----------------------------------------------------------- musique ----- */

/** Demi-tons d'une gamme mineure naturelle et de ses variantes. */
const GAMMES = {
  mineure: [0, 2, 3, 5, 7, 8, 10],
  dorien: [0, 2, 3, 5, 7, 9, 10],
  phrygien: [0, 1, 3, 5, 7, 8, 10],
  pentamineure: [0, 3, 5, 7, 10],
};

/** Progression d'accords, en degres. Courte et tournante : c'est une boucle
 *  de roguelike, elle doit supporter douze minutes sans lasser. */
const PROGRESSION = [0, 5, 3, 6];

/**
 * Identite sonore par contexte.
 *
 * Le SQUELETTE rythmique ne change pas d'une matrice a l'autre : c'est lui
 * qui fait que la bande son est « toujours chez elle ». Ce qui change, c'est
 * la tonalite, le mode et la couleur des timbres — comme chaque matrice a
 * deja sa palette visuelle.
 */
const AMBIANCES = {
  /* Lobby et bestiaire : pas de batterie du tout, et un tempo qui ne sert
     qu'a cadencer les respirations de la nappe. */
  ambiant: {
    bpm: 58, tonique: 45, gamme: 'dorien',
    rapport1: 0.5, rapport2: 0.25, coupure: 2400,
    reverbe: 0.85, echo: 0.55, grain: 0.15,
  },
  milk: {
    bpm: 172, tonique: 50, gamme: 'dorien',
    rapport1: 0.5, rapport2: 0.25, coupure: 6200,
    reverbe: 0.42, echo: 0.3, grain: 0.55,
  },
  pipe: {
    bpm: 176, tonique: 42, gamme: 'mineure',
    rapport1: 0.125, rapport2: 0.5, coupure: 7400,
    reverbe: 0.3, echo: 0.38, grain: 0.85,
  },
  kombucha: {
    bpm: 168, tonique: 49, gamme: 'phrygien',
    rapport1: 0.25, rapport2: 0.125, coupure: 5600,
    reverbe: 0.58, echo: 0.46, grain: 0.5,
  },
  levain: {
    bpm: 170, tonique: 45, gamme: 'pentamineure',
    rapport1: 0.5, rapport2: 0.5, coupure: 5000,
    reverbe: 0.5, echo: 0.34, grain: 0.42,
  },
};

/** Grille de batterie sur deux mesures, en doubles croches (32 pas).
 *  Motif de drum and bass : grosse caisse sur 1 et sur le « et » de 3,
 *  caisse claire sur 2 et 4, et un deplacement a la deuxieme mesure — c'est
 *  ce decalage qui empeche la boucle de sonner comme une boucle. */
const KICK = [0, 10, 16, 19, 26];
const CLAP = [4, 12, 20, 28];
const CLAP_FANTOME = [7, 15, 23, 30];

/* ------------------------------------------------------------- moteur ---- */

const LOOKAHEAD = 0.12;     // s planifiees a l'avance
const TIC = 25;             // ms entre deux reveils du planificateur

/**
 * Le moteur. Exporte pour que les bancs de mesure puissent en instancier un
 * A EUX : avec le singleton, la boucle de jeu de la page continuait d'appeler
 * `observe()` pendant un rendu hors ligne et remettait l'ambiance a zero en
 * plein milieu. Les mesures n'etaient reproductibles ni d'un essai a l'autre,
 * ni meme d'un etat a l'autre.
 */
export class Son {
  constructor() {
    this.pret = false;
    this.mort = false;       // desactive apres une erreur : on n'insiste pas
    this.muet = false;
    this.volume = 0.7;
    this.ctx = null;
    this.timer = null;
    this.rng = mulberry32(0x5eed);

    /* Etat observe, lisse image par image. */
    this.intensite = 0;
    this.miseAuPoint = 0;
    this.danger = 0;
    this.acidite = 0;
    this.ambiance = 'ambiant';
    this.aBoss = false;

    /* Detection de fronts : c'est ainsi qu'on deduit les evenements sans
       toucher au code de jeu. */
    this.vuFlash = 0;
    this.vuKills = 0;
    this.vuNiveau = 1;
    this.vuNep = 'attente';

    this.pas = 0;
    this.prochain = 0;
    this.accordIdx = 0;
    this.file = [];
  }

  /* ------------------------------------------------------------ cycle --- */

  /**
   * A n'appeler QUE depuis un geste utilisateur. Idempotent.
   *
   * @param {BaseAudioContext} [ctxExterne] Contexte impose. Sert au rendu
   *   HORS LIGNE : on ne verifie pas une bande son adaptative a l'oreille
   *   dans un navigateur sans carte son, on la rend et on la MESURE
   *   (voir tools/son-check.mjs).
   */
  init(ctxExterne = null) {
    if (this.pret || this.mort) return;
    try {
      if (ctxExterne) {
        this.ctx = ctxExterne;
        this.horsLigne = true;
      } else {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { this.mort = true; return; }
        this.ctx = new AC({ latencyHint: 'interactive' });
        this.horsLigne = false;
      }
      this.construire();
      this.prochain = this.ctx.currentTime + 0.1;
      /* Hors ligne, le temps ne s'ecoule pas tout seul : c'est l'appelant qui
         fait avancer le planificateur. */
      if (!this.horsLigne) this.timer = setInterval(() => this.planifier(), TIC);
      this.pret = true;
      this.appliquerAmbiance('ambiant', true);
    } catch (e) {
      this.mort = true;
      this.pret = false;
    }
  }

  construire() {
    const ctx = this.ctx;

    /* --- chaine master -------------------------------------------------- */
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    /* Le passe-bas master est pilote par la MISE AU POINT : regarder loin de
       son propre plan ouate le son exactement comme ca floute l'image. */
    this.filtreMaster = ctx.createBiquadFilter();
    this.filtreMaster.type = 'lowpass';
    this.filtreMaster.frequency.value = 14000;
    this.filtreMaster.Q.value = 0.6;
    this.filtreMaster.connect(this.master).connect(ctx.destination);

    /* Deux bus : ce qui doit etre rugueux passe par le grain, le reste non.
       Quantifier une queue de reverbe sonne sale, pas retro. */
    this.grain = ctx.createWaveShaper();
    this.grain.curve = courbeGrain(14, 0.7);
    this.grain.oversample = '2x';
    this.busChip = ctx.createGain();
    this.busDoux = ctx.createGain();
    /* ETAGE DE GAIN AUTOUR DU QUANTIFICATEUR. Sans lui, la courbe de grain
       est une PORTE et non une saturation : quantifier sur 14 paliers renvoie
       zero pour tout echantillon sous 1/28 d'amplitude, c'est-a-dire pour
       l'essentiel d'un mix qui respire. Mesure : les cinq etats de jeu
       sortaient rigoureusement identiques, la batterie etait avalee.
       On presente donc le signal chaud au quantificateur et on rattrape
       apres — c'est exactement ce que fait une pedale de bitcrush. */
    this.avantGrain = ctx.createGain();
    this.avantGrain.gain.value = 5;
    this.apresGrain = ctx.createGain();
    this.apresGrain.gain.value = 0.2;
    this.busChip.connect(this.avantGrain).connect(this.grain)
      .connect(this.apresGrain).connect(this.filtreMaster);
    this.busDoux.connect(this.filtreMaster);
    /* Dosage du grain : a faible dose on renvoie aussi le signal propre. */
    this.chipPropre = ctx.createGain();
    this.chipPropre.gain.value = 0.5;
    this.busChip.connect(this.chipPropre).connect(this.filtreMaster);

    /* --- effets --------------------------------------------------------- */
    this.rev = reverbe(ctx, { taille: 1.25, amorti: 3000, retour: 0.8 });
    this.revGain = ctx.createGain();
    this.revGain.gain.value = 0.3;
    this.rev.sortie.connect(this.revGain).connect(this.filtreMaster);
    this.envoiRev = ctx.createGain();
    this.envoiRev.connect(this.rev.entree);

    this.echo = delaiPingPong(ctx, 0.34, 0.44);
    this.echoGain = ctx.createGain();
    this.echoGain.gain.value = 0.2;
    this.echo.sortie.connect(this.echoGain).connect(this.filtreMaster);
    this.envoiEcho = ctx.createGain();
    this.envoiEcho.connect(this.echo.entree);

    /* --- couches -------------------------------------------------------- */
    /* Elles tournent TOUTES en permanence ; on ne fait que ramper leurs
       gains. Jamais de coupure : une couche qui s'arrete s'entend, une
       couche qui descend ne s'entend pas. */
    this.couches = {};
    this.envoisRev = {};
    for (const nom of ['nappe', 'sub', 'break', 'ostinato', 'lead', 'tension']) {
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      g.connect(nom === 'nappe' || nom === 'sub' ? this.busDoux : this.busChip);
      /* Tout part aussi vers les effets, en proportion fixe par couche. */
      const r = ctx.createGain();
      r.gain.value = nom === 'nappe' ? 0.4 : (nom === 'lead' ? 0.5 : 0.18);
      g.connect(r).connect(this.envoiRev);
      this.envoisRev[nom] = r;
      const e = ctx.createGain();
      e.gain.value = nom === 'lead' ? 0.6 : (nom === 'nappe' ? 0.5 : 0.1);
      g.connect(e).connect(this.envoiEcho);
      this.couches[nom] = g;
    }

    /* --- voix ----------------------------------------------------------- */
    this.ondes = {
      p125: ondePulsee(ctx, 0.125),
      p25: ondePulsee(ctx, 0.25),
      p50: ondePulsee(ctx, 0.5),
    };
    this.bruit = tamponBruit(ctx, 2, 5);

    this.vLead = new Canal(ctx, this.couches.lead,
      { onde: this.ondes.p50, coupure: 7000, glisse: 0.012 });
    this.vOsti = new Canal(ctx, this.couches.ostinato,
      { onde: this.ondes.p25, coupure: 6000 });
    this.vBasse = new Canal(ctx, this.couches.sub,
      { type: 'triangle', coupure: 1800 });
    this.vSub = new Canal(ctx, this.couches.sub,
      { type: 'sine', coupure: 260 });
    /* La nappe : trois voix legerement desaccordees. C'est le desaccord, pas
       le nombre de voix, qui donne l'impression de liquide. */
    /* Le passe-bas reste BAS et sans coin resonant. Une dent de scie tenue
       dont le filtre s'ouvre vers 2 kHz pose ses harmoniques 13 a 16 pile
       la ou l'oreille cherche un sifflement, et la reverbe les etale en une
       raie continue : c'est exactement le defaut qu'on a mesure. En plus
       sombre, la nappe laisse la place aux carres incisifs qui doivent,
       eux, couper le mix. */
    this.nappe = [0, 1, 2].map((i) => {
      const c = new Canal(ctx, this.couches.nappe,
        { type: 'sawtooth', coupure: 1100, q: 0.7 });
      c.osc.detune.value = (i - 1) * 9;
      /* Deuxieme pole. Un seul biquad, c'est 12 dB par octave : a 2 kHz une
         dent de scie coupee a 1,1 kHz garde encore le quart de ses
         harmoniques, et des que le mix se degarnit elles s'entendent seules.
         Avec 24 dB par octave il n'en reste rien. */
      const f2 = ctx.createBiquadFilter();
      f2.type = 'lowpass';
      f2.frequency.value = 1100;
      f2.Q.value = 0.7;
      c.filtre.disconnect();
      c.filtre.connect(f2).connect(c.gain);
      c.filtre2 = f2;
      /* Un souffle tres lent sur la coupure, une periode differente par
         voix : un partiel parfaitement stable s'entend comme un sifflet,
         le meme partiel qui respire s'entend comme une texture. */
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = [0.047, 0.071, 0.093][i];
      const prof = ctx.createGain();
      prof.gain.value = 220;
      lfo.connect(prof);
      prof.connect(c.filtre.frequency);
      prof.connect(f2.frequency);
      lfo.start();
      c.souffle = prof;
      return c;
    });

    this.kick = new Kick(ctx, this.couches.break);
    this.clap = new Percu(ctx, this.couches.break, this.bruit,
      { type: 'bandpass', freq: 1900, q: 1.1 });
    this.hat = new Percu(ctx, this.couches.break, this.bruit,
      { type: 'highpass', freq: 6200, q: 0.8 });
    this.tension = new Percu(ctx, this.couches.tension, this.bruit,
      { type: 'bandpass', freq: 320, q: 3.5 });

    /* Voix d'evenements : courtes, hors couches, toujours audibles. */
    this.stinger = new Canal(ctx, this.busChip,
      { onde: this.ondes.p125, coupure: 9000, glisse: 0.006 });
    this.stingerGain = ctx.createGain();
  }

  /** Coupe le planificateur et endort le contexte. */
  suspend() {
    if (!this.pret) return;
    try { this.ctx.suspend(); } catch (e) { /* sans consequence */ }
  }

  resume() {
    if (!this.pret) return;
    try { this.ctx.resume(); } catch (e) { /* sans consequence */ }
  }

  setMuted(b) {
    this.muet = !!b;
    if (this.pret) this.rampe(this.master.gain, this.muet ? 0.0001 : this.volume, 0.08);
  }

  /**
   * Reamorce le hasard musical.
   *
   * Le moteur est un singleton : sans ce point d'entree, deux rendus
   * successifs partent d'etats de PRNG differents et ne sont pas
   * comparables. C'est ce qui rendait les mesures de tools/son-check.mjs
   * instables d'un essai a l'autre.
   */
  graine(n) { this.rng = mulberry32(n >>> 0); }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.pret && !this.muet) this.rampe(this.master.gain, this.volume, 0.08);
  }

  /* ---------------------------------------------------------- reglages --- */

  rampe(param, cible, tau = 0.15) {
    try { param.setTargetAtTime(Math.max(0.0001, cible), this.ctx.currentTime, tau); }
    catch (e) { /* sans consequence */ }
  }

  appliquerAmbiance(nom, immediat = false) {
    const a = AMBIANCES[nom] || AMBIANCES.ambiant;
    this.amb = a;
    this.ambiance = nom;
    this.gamme = GAMMES[a.gamme] || GAMMES.mineure;
    this.parPas = 60 / a.bpm / 4;                 // duree d'une double croche
    if (!this.pret) return;
    const t = immediat ? 0.001 : 0.6;
    this.rampe(this.revGain.gain, a.reverbe * 0.42, t);
    this.rampe(this.echoGain.gain, a.echo * 0.34, t);
    this.rampe(this.chipPropre.gain, 1 - a.grain, t);
    /* Le lobby est un drone : la nappe y a droit a toute la reverbe. En
       stage elle n'est qu'un fond harmonique, elle en recoit le tiers. */
    this.rampe(this.envoisRev.nappe.gain, nom === 'ambiant' ? 1 : 0.4, t);
    for (const [i, c] of this.nappe.entries()) {
      const fc = Math.min(a.coupure * 0.35, 1250);
      c.filtre.frequency.setTargetAtTime(fc, this.ctx.currentTime, t);
      c.filtre2.frequency.setTargetAtTime(fc, this.ctx.currentTime, t);
      c.osc.detune.setTargetAtTime((i - 1) * (a.grain > 0.6 ? 14 : 8), this.ctx.currentTime, t);
    }
    this.vLead.osc.setPeriodicWave(
      a.rapport1 === 0.125 ? this.ondes.p125 : (a.rapport1 === 0.25 ? this.ondes.p25 : this.ondes.p50));
    this.vOsti.osc.setPeriodicWave(
      a.rapport2 === 0.125 ? this.ondes.p125 : (a.rapport2 === 0.25 ? this.ondes.p25 : this.ondes.p50));
    for (const d of this.echo.temps) d.setTargetAtTime(this.parPas * 3, this.ctx.currentTime, t);
  }

  /** Frequence d'un degre de la gamme courante, a l'octave donnee. */
  freq(degre, octave = 0) {
    const g = this.gamme;
    const n = ((degre % g.length) + g.length) % g.length;
    const oct = Math.floor(degre / g.length) + octave;
    const midi = this.amb.tonique + g[n] + oct * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* ------------------------------------------------ planificateur ------- */

  planifier() {
    this.avancerJusqua(this.ctx ? this.ctx.currentTime : 0);
  }

  /** Planifie tout ce qui tombe avant `maintenant + LOOKAHEAD`. */
  avancerJusqua(maintenant) {
    if (!this.pret || this.mort) return;
    try {
      const fin = maintenant + LOOKAHEAD;
      let garde = 0;
      while (this.prochain < fin && garde++ < 64) {
        this.jouerPas(this.pas, this.prochain);
        this.prochain += this.parPas;
        this.pas = (this.pas + 1) % 32;
        if (this.pas === 0) this.accordIdx = (this.accordIdx + 1) % PROGRESSION.length;
      }
      /* Si on a pris du retard (onglet en arriere-plan), on se recale au lieu
         de rattraper mille pas d'un coup. */
      if (this.prochain < maintenant) this.prochain = maintenant + 0.05;
      this.viderFile(maintenant);
    } catch (e) {
      /* Une exception dans le planificateur ne doit jamais remonter jusqu'a
         la boucle de jeu : on coupe le son et on continue de jouer. */
      this.mort = true;
      clearInterval(this.timer);
    }
  }

  jouerPas(pas, t) {
    const amb = this.amb;
    const I = this.intensite;
    const degreAccord = PROGRESSION[this.accordIdx];
    const ambiant = this.ambiance === 'ambiant';

    /* --- nappe : toujours la, elle tient l'harmonie -------------------- */
    if (pas % 16 === 0) {
      const accord = [0, 2, 4].map((d) => degreAccord + d);
      this.nappe.forEach((c, i) => {
        c.note(t, this.freq(accord[i], ambiant ? -1 : 0), this.parPas * 20, 0.09,
          { a: 0.9, d: 0.6, s: 0.8, r: this.parPas * 18 });
      });
    }
    if (ambiant) {
      /* Dans le lobby, une note isolee de temps en temps, et c'est tout.
         L'echo et la reverbe font le reste du travail. */
      if (pas % 8 === 0 && this.rng() < 0.4) {
        this.vLead.note(t, this.freq(degreAccord + (this.rng() < 0.5 ? 4 : 2), 1),
          this.parPas * 4, 0.06, { a: 0.02, d: 0.4, s: 0.3, r: this.parPas * 6 });
      }
      return;
    }

    /* --- sub et basse : le bas du spectre, des la premiere montee ------- */
    if (KICK.includes(pas)) {
      this.vSub.note(t, this.freq(degreAccord, -2), this.parPas * 3, 0.5,
        { a: 0.01, d: 0.12, s: 0.7, r: this.parPas * 3 });
    }
    if (pas % 8 === 0 || (pas % 8 === 6 && this.rng() < 0.4)) {
      this.vBasse.note(t, this.freq(degreAccord, -1), this.parPas * 2, 0.16,
        { a: 0.006, d: 0.08, s: 0.5, r: this.parPas * 2 });
    }

    /* --- batterie : le moteur du morceau -------------------------------- */
    if (KICK.includes(pas)) this.kick.frappe(t, 0.9);
    if (CLAP.includes(pas)) this.clap.frappe(t, 0.12, 0.5, 1900);
    if (CLAP_FANTOME.includes(pas) && this.rng() < 0.35 + 0.4 * I) {
      this.clap.frappe(t, 0.05, 0.18, 2600);
    }
    /* Charleston en doubles croches, densite croissante : c'est elle qui
       porte le sentiment d'urgence sans changer le tempo. */
    if (pas % 2 === 1 || this.rng() < 0.25 + 0.5 * I) {
      /* 6 a 8 kHz : c'est la bande d'une charleston, avec un peu de corps.
         Plus haut, il ne reste que de l'air — inaudible sur un haut-parleur
         de telephone, et au bord de Nyquist si le contexte tourne bas. */
      this.hat.frappe(t, 0.035, 0.07 + 0.05 * I, 6200 + this.rng() * 2200);
    }

    /* --- ostinato : hypnotique, il ne change qu'a l'accord -------------- */
    const motif = [0, 4, 2, 4, 0, 5, 2, 4];
    if (pas % 2 === 0) {
      const d = degreAccord + motif[(pas / 2) % motif.length];
      this.vOsti.note(t, this.freq(d, 0), this.parPas * 1.6, 0.1,
        { a: 0.004, d: 0.04, s: 0.35, r: this.parPas * 1.4 });
    }

    /* --- melodie : courte, entetante, elle n'arrive qu'en pression ------ */
    if (I > 0.35 && pas % 4 === 0 && this.rng() < 0.28 + 0.4 * I) {
      const saut = [0, 2, 4, 6, 7][Math.floor(this.rng() * 5)];
      this.vLead.note(t, this.freq(degreAccord + saut, 1), this.parPas * 3, 0.12,
        { a: 0.006, d: 0.09, s: 0.4, r: this.parPas * 3 });
    }

    /* --- tension : un battement sourd quand la vie descend -------------- */
    if (this.danger > 0.3 && pas % 8 === 0) {
      this.tension.frappe(t, 0.5, 0.25 * this.danger, 220 + 160 * this.danger);
    }
  }

  /* ------------------------------------------------- evenements --------- */

  evenement(type) {
    if (!this.pret || this.mort) return;
    this.file.push(type);
    if (this.file.length > 12) this.file.shift();
  }

  viderFile(maintenant = null) {
    if (!this.file.length) return;
    const t = (maintenant ?? this.ctx.currentTime) + 0.01;
    /* Un seul evenement par reveil : deux stingers simultanes sur la meme
       voix monophonique s'annulent, et on n'entend qu'un clic. */
    const type = this.file.shift();
    const d = PROGRESSION[this.accordIdx];
    if (type === 'kill') {
      this.stinger.note(t, this.freq(d + 4, 2), 0.09, 0.07,
        { a: 0.002, d: 0.03, s: 0.2, r: 0.08 });
    } else if (type === 'coup') {
      this.stinger.note(t, this.freq(d + 1, -1), 0.2, 0.16,
        { a: 0.002, d: 0.12, s: 0.3, r: 0.2 });
    } else if (type === 'niveau') {
      this.stinger.note(t, this.freq(d + 7, 2), 0.3, 0.12,
        { a: 0.004, d: 0.2, s: 0.5, r: 0.3 });
    } else if (type === 'boss' || type === 'nep') {
      this.stinger.note(t, this.freq(d, -1), 0.6, 0.2,
        { a: 0.01, d: 0.4, s: 0.6, r: 0.7 });
    }
  }

  /* --------------------------------------------------- observation ------ */

  /**
   * Un appel par image. Le moteur deduit tout : rien a pousser depuis le jeu.
   * @param {string} scene 'lobby' | 'bestiaire' | 'jeu'
   * @param {object|null} game
   * @param {number} dt
   */
  observe(scene, game, dt) {
    if (!this.pret || this.mort) return;
    try {
      const k = Math.min(1, dt * 2.4);

      if (scene !== 'jeu' || !game) {
        if (this.ambiance !== 'ambiant') this.appliquerAmbiance('ambiant');
        this.intensite += (0 - this.intensite) * k;
        this.miseAuPoint += (0 - this.miseAuPoint) * k;
        this.danger += (0 - this.danger) * k;
        this.majCouches();
        return;
      }

      const id = game.matrix.id;
      if (this.ambiance !== id) {
        this.appliquerAmbiance(AMBIANCES[id] ? id : 'milk');
        this.vuKills = game.player.kills;
        this.vuNiveau = game.player.level;
      }

      /* Intensite : la moitie vient de l'avancement du run (l'arc long), la
         moitie de la pression instantanee (la horde). Le budget de menace du
         directeur EST deja la bonne mesure, on ne reinvente rien. */
      const cible = Math.max(1, game.director.targetCredits());
      const pression = clamp(game.director.liveCredits() / cible, 0, 1.4) / 1.4;
      const voulue = clamp(0.5 * game.progress + 0.5 * pression, 0, 1);
      this.intensite += (voulue - this.intensite) * k;

      /* Mise au point : c'est l'ECART a son propre plan qui compte, pas le
         signe. Regarder loin, dans un sens ou dans l'autre, ouate le son. */
      const mp = clamp(Math.abs(game.focus), 0, 1);
      this.miseAuPoint += (mp - this.miseAuPoint) * k;

      const p = game.player;
      const vie = clamp(1 - p.hp / Math.max(1, p.stats.maxHp), 0, 1);
      this.danger += (Math.max(vie, game.flash) - this.danger) * k;

      /* Acidite : -1 quand le milieu est a son pH de depart, +1 au plancher.
         Le joueur est chez lui dans l'acide qu'il produit. */
      const c = game.matrix.chem;
      const etendue = Math.max(0.2, c.phStart - c.phFloor);
      this.acidite = clamp((c.phStart - game.ph) / etendue, 0, 1) * 2 - 1;

      /* --- fronts : les evenements se DEDUISENT ------------------------- */
      if (game.flash > 0.25 && this.vuFlash <= 0.25) this.evenement('coup');
      this.vuFlash = game.flash;
      if (p.kills > this.vuKills) { this.evenement('kill'); this.vuKills = p.kills; }
      if (p.level > this.vuNiveau) { this.evenement('niveau'); this.vuNiveau = p.level; }
      const boss = !!(game.boss && game.boss.alive);
      if (boss !== this.aBoss) { if (boss) this.evenement('boss'); this.aBoss = boss; }
      const nep = game.conduite ? game.conduite.cip.etat : 'attente';
      if (nep !== this.vuNep) { if (nep === 'vague') this.evenement('nep'); this.vuNep = nep; }

      this.majCouches();
    } catch (e) {
      /* L'observation ne doit jamais casser la boucle de jeu. */
      this.mort = true;
    }
  }

  /** Rampes de gain des couches. Jamais de coupure, uniquement des pentes. */
  majCouches() {
    const I = this.intensite;
    const ambiant = this.ambiance === 'ambiant';
    const seuil = (bas, haut) => clamp((I - bas) / Math.max(0.01, haut - bas), 0, 1);
    const g = this.couches;
    const tau = 0.45;
    this.rampe(g.nappe.gain, ambiant ? 0.5 : 0.18 + 0.1 * (1 - I), tau);
    this.rampe(g.sub.gain, ambiant ? 0.0001 : 0.1 + 0.35 * seuil(0.05, 0.4), tau);
    this.rampe(g.break.gain, ambiant ? 0.0001 : 0.5 * seuil(0.12, 0.45), tau);
    this.rampe(g.ostinato.gain, ambiant ? 0.0001 : 0.32 * seuil(0.25, 0.6), tau);
    this.rampe(g.lead.gain, ambiant ? 0.22 : 0.3 * seuil(0.4, 0.8), tau);
    this.rampe(g.tension.gain, this.danger * 0.5, 0.8);

    /* Le passe-bas master suit la mise au point. Une octave et demie de
       course : assez pour s'entendre, pas assez pour etouffer. */
    /* Une octave et demie de course. Mesure a 0,18 : le mix perdait 60 % de
       son niveau a pleine defocalisation, ce n'est plus ouater, c'est
       eteindre. */
    const f = 14000 * Math.pow(0.24, this.miseAuPoint);
    this.rampe(this.filtreMaster.frequency, f, 0.25);
  }

  /** Etat lisible, pour l'overlay de debug. */
  get etat() {
    return {
      pret: this.pret, mort: this.mort, muet: this.muet,
      ambiance: this.ambiance,
      intensite: this.intensite, miseAuPoint: this.miseAuPoint,
      danger: this.danger, acidite: this.acidite,
    };
  }
}

/* Une seule instance : le son est un peripherique, pas un objet de jeu. */
export const son = new Son();

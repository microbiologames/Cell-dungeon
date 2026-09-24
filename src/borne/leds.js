/* ---------------------------------------------------------------------------
   La boite de Petri de la borne.

   Une vraie boite de Petri, avec une fausse gelose en resine, est posee sous
   l'objectif de la borne. Elle est retroeclairee par un anneau de LED
   adressables, et sa couleur suit le stage : le joueur voit de loin dans quel
   milieu il plonge, avant meme de regarder l'ecran.
   Plan d'ensemble : docs/09-borne-microscope.md.

   MEME CONVENTION QUE LE SON : le module OBSERVE, on ne lui pousse rien.
   `observe(scene, game, dt)` est appele une fois par image et deduit tout —
   l'acidification, la pression, l'arrivee d'un boss, le passage d'un NEP.
   Ajouter une matrice ne demande donc aucun cablage ici : il suffit qu'elle
   ait une couleur `led` dans src/data/palette.js.

   POURQUOI CE MODULE NE LIT PAS `son.etat`, qui contient pourtant deja une
   intensite et un danger tout lisses : `son.observe()` sort immediatement
   tant que `pret` est faux — c'est-a-dire tant que le joueur n'a pas fait le
   geste qui debloque l'audio — et definitivement si `mort` passe a vrai. Les
   LED se seraient donc figees sur une borne dont le son n'a pas demarre, ce
   qui est precisement le cas au lancement. Le calcul est refait ici, il coute
   quelques dizaines d'operations par image.

   RIEN ICI NE DOIT CASSER LE JEU. Sans WebSerial — telephone, page hebergee,
   banc hors ligne — le module calcule sa couleur et n'envoie rien. Toute
   erreur de liaison le met en sommeil au lieu de remonter dans la boucle.
--------------------------------------------------------------------------- */

import { clamp } from '../core/util.js';
import { MATRICES_PALETTE, LED_ACIDE } from '../data/palette.js';

const comp = (c) => [c & 255, (c >> 8) & 255, (c >> 16) & 255];

/** Ramene une entree douteuse a un nombre utilisable.
 *
 *  `clamp` de core/util.js laisse passer NaN : `NaN < a` et `NaN > b` sont
 *  tous deux faux, la valeur ressort telle quelle, et la couleur finit en
 *  `rgb(NaN,NaN,NaN)`. Mesure du banc : 810 composantes non finies sur 1152
 *  etats eprouves. Sur la borne, un `game.ph` parti en NaN une seule image
 *  suffirait a eteindre la boite — et rien a l'ecran ne le dirait. */
const sain = (v, defaut = 0) => (Number.isFinite(v) ? v : defaut);

/** Melange lineaire de deux triplets. */
function melange(a, b, t) {
  const k = clamp(t, 0, 1);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/* --- reglages, et ce qui les a fixes ------------------------------------ */

/** Part du virage acide au pH plancher. A 1 la boite devenait franchement
 *  jaune et on ne reconnaissait plus le milieu : le lait et le levain
 *  finissaient identiques. A 0,55 le virage se lit sans effacer la teinte de
 *  depart, ce que tools/leds.mjs verifie en gardant l'ecart entre matrices
 *  AUSSI au pH plancher, et pas seulement au repos. */
const FORCE_ACIDE = 0.55;

/** Amplitude de la respiration portee par l'intensite. Une boite dont la
 *  luminosite suit toute la courbe du directeur pompe sans arret pendant
 *  douze minutes et fatigue l'oeil a un metre. +-12 % se remarque quand on
 *  regarde, et s'oublie quand on joue. */
const RESPIRATION = 0.12;

/** Battement de danger, en hertz, et sa profondeur. Cale sur un pouls rapide
 *  plutot que sur un clignotant : c'est un organisme qu'on regarde. */
const POULS_HZ = 2.2;
const POULS = 0.30;

/** Lissage. Meme constante que le son (dt * 2.4) : les deux peripheriques
 *  doivent reagir ensemble, sinon la boite traine derriere la musique. */
const LISSAGE = 2.4;

/** Debit maximal vers le microcontroleur. Une trame fait 8 octets ; a 30 Hz
 *  cela represente 240 o/s sur une liaison a 115200 bauds, soit 0,2 % de sa
 *  capacite. Inutile d'envoyer plus vite qu'on ne percoit, et une file
 *  d'ecriture qui s'accumule finirait par bloquer la boucle de rendu. */
const HZ_MAX = 30;

/** En deca, on n'envoie pas : le bruit de calcul ferait emettre a chaque
 *  image pour un ecart invisible. Un niveau sur 255 est deja sous le seuil
 *  de perception d'une LED diffusee. */
const SEUIL_ENVOI = 2;

/**
 * La couleur de la boite pour un etat donne.
 *
 * Fonction PURE, exportee a part : c'est elle que le banc mesure, sans
 * navigateur ni liaison serie. Retourne trois composantes 0-255.
 *
 * @param {string} matriceId
 * @param {{acidite:number, intensite:number, danger:number, nep:number, t:number}} e
 */
export function couleurBoite(matriceId, e) {
  const pal = MATRICES_PALETTE[matriceId];
  /* Une matrice sans couleur `led` ne doit pas eteindre la borne : on se
     rabat sur un blanc neutre, et le banc signale l'oubli. */
  const base = pal && pal.led ? comp(pal.led) : [255, 255, 255];

  /* 1. Le milieu s'acidifie : virage vers le jaune des indicateurs colores
        (voir LED_ACIDE dans palette.js). */
  let c = melange(base, comp(LED_ACIDE), clamp(sain(e.acidite), 0, 1) * FORCE_ACIDE);

  /* 2. Respiration de fond, portee par la pression du directeur. */
  let gain = 1 + RESPIRATION * (clamp(sain(e.intensite), 0, 1) * 2 - 1);

  /* 3. Pouls du danger. Choix ASSUME : ce battement ne represente rien de
        reel, contrairement au virage acide. C'est une boite d'arcade, pas une
        preparation a observer, et le joueur doit sentir le boss sans quitter
        l'ecran des yeux. */
  const d = clamp(sain(e.danger), 0, 1);
  if (d > 0.02) gain *= 1 + POULS * d * Math.sin(sain(e.t) * POULS_HZ * Math.PI * 2);

  c = [c[0] * gain, c[1] * gain, c[2] * gain];

  /* 4. Nettoyage En Place : la conduite est noyee de soude ou d'acide chaud.
        La boite vire au blanc froid, et ecrase tout le reste — c'est bref,
        c'est violent, et ca doit se voir de l'autre bout de la piece. */
  const nep = clamp(sain(e.nep), 0, 1);
  if (nep > 0) c = melange(c, [236, 248, 255], nep);

  return [
    Math.round(clamp(c[0], 0, 255)),
    Math.round(clamp(c[1], 0, 255)),
    Math.round(clamp(c[2], 0, 255)),
  ];
}

export class Leds {
  constructor() {
    this.actif = false;      // une liaison est ouverte
    this.mort = false;       // liaison perdue : on n'essaie plus
    this.couleur = [0, 0, 0];
    this.matrice = null;
    /* Etat observe, lisse, exactement comme le son. */
    this.acidite = 0;
    this.intensite = 0;
    this.danger = 0;
    this.nep = 0;
    this.t = 0;
    this._port = null;
    this._writer = null;
    this._envoiT = 0;
    this._dernier = null;
    this._reprisTentee = false;
  }

  get dispo() {
    return typeof navigator !== 'undefined' && !!navigator.serial;
  }

  /**
   * Ouvre la liaison vers le microcontroleur.
   *
   * `requestPort()` EXIGE un geste de l'utilisateur : on ne peut donc pas
   * l'appeler au chargement. Mais le navigateur retient l'autorisation, et
   * `getPorts()` rend au demarrage suivant les ports deja accordes — sans
   * geste. La borne n'a donc besoin de ce geste QU'UNE FOIS, a la premiere
   * mise en service ; ensuite elle se rebranche seule a chaque allumage.
   * C'est ce qui la rend autonome, et c'est la raison d'etre de `reprendre()`.
   */
  async connecter() {
    if (!this.dispo) return false;
    try {
      const port = await navigator.serial.requestPort();
      return await this._ouvrir(port);
    } catch { return false; }   // l'utilisateur a ferme le selecteur
  }

  /** Rebranche un port deja autorise, sans geste. Appele une fois, au premier
   *  `observe()`. */
  async reprendre() {
    if (!this.dispo || this._reprisTentee) return false;
    this._reprisTentee = true;
    try {
      const ports = await navigator.serial.getPorts();
      if (!ports.length) return false;
      return await this._ouvrir(ports[0]);
    } catch { return false; }
  }

  async _ouvrir(port) {
    try {
      await port.open({ baudRate: 115200 });
      this._port = port;
      this._writer = port.writable.getWriter();
      this.actif = true;
      this.mort = false;
      return true;
    } catch { this.actif = false; return false; }
  }

  async deconnecter() {
    try {
      /* Eteindre AVANT de fermer : une boite laissee allumee apres l'arret du
         jeu fait croire que la borne tourne encore. */
      await this._ecrire('#000000\n');
      this._writer?.releaseLock();
      await this._port?.close();
    } catch { /* on ferme au mieux */ }
    this._writer = null; this._port = null; this.actif = false;
  }

  /**
   * Un appel par image. Tout se deduit de l'etat du jeu.
   * @param {string} scene 'lobby' | 'bestiaire' | 'jeu'
   * @param {object|null} game
   * @param {number} dt
   */
  observe(scene, game, dt) {
    try {
      if (this.dispo && !this._reprisTentee) this.reprendre();
      this.t += dt;
      const k = Math.min(1, dt * LISSAGE);

      if (scene !== 'jeu' || !game) {
        /* Hors partie, la boite revient au repos sans s'eteindre : une borne
           en attente doit rester allumee, c'est elle qui attire. */
        this.matrice = null;
        this.acidite += (0 - this.acidite) * k;
        this.intensite += (0 - this.intensite) * k;
        this.danger += (0 - this.danger) * k;
        this.nep += (0 - this.nep) * k;
        this.couleur = couleurBoite('milk', this);
        this._pousser();
        return;
      }

      this.matrice = game.matrix.id;

      /* Acidite : 0 au pH de depart, 1 au plancher. Meme lecture que le son,
         mais ramenee sur [0,1] — une LED n'a pas de signe. */
      const c = game.matrix.chem;
      if (c) {
        const etendue = Math.max(0.2, c.phStart - c.phFloor);
        const voulue = clamp((c.phStart - game.ph) / etendue, 0, 1);
        this.acidite += (voulue - this.acidite) * k;
      }

      /* Intensite : le budget de menace du directeur EST deja la bonne
         mesure, on ne reinvente rien (meme raisonnement que le son). */
      const cible = Math.max(1, game.director.targetCredits());
      const pression = clamp(game.director.liveCredits() / cible, 0, 1.4) / 1.4;
      const voulue = clamp(0.5 * game.progress + 0.5 * pression, 0, 1);
      this.intensite += (voulue - this.intensite) * k;

      /* Danger : le pouls bat quand le joueur est bas, ou quand un boss vit. */
      const p = game.player;
      const vie = clamp(1 - p.hp / Math.max(1, p.stats.maxHp), 0, 1);
      const boss = game.boss && game.boss.alive ? 0.6 : 0;
      this.danger += (Math.max(vie, boss, game.flash || 0) - this.danger) * k;

      const nep = game.conduite && game.conduite.cip.etat === 'vague' ? 1 : 0;
      this.nep += (nep - this.nep) * k;

      this.couleur = couleurBoite(this.matrice, this);
      this._pousser();
    } catch {
      /* L'observation ne doit jamais casser la boucle de jeu. Meme regle que
         le son : on se met en sommeil, le jeu continue. */
      this.mort = true;
    }
  }

  /** Envoie la couleur si elle a bouge et si le debit le permet. */
  _pousser() {
    if (!this.actif || this.mort) return;
    if (this.t - this._envoiT < 1 / HZ_MAX) return;
    const c = this.couleur;
    const d = this._dernier;
    if (d && Math.abs(c[0] - d[0]) < SEUIL_ENVOI
         && Math.abs(c[1] - d[1]) < SEUIL_ENVOI
         && Math.abs(c[2] - d[2]) < SEUIL_ENVOI) return;
    this._envoiT = this.t;
    this._dernier = c.slice();
    this._ecrire('#' + c.map((v) => v.toString(16).padStart(2, '0')).join('') + '\n');
  }

  _ecrire(txt) {
    if (!this._writer) return Promise.resolve();
    /* On n'ATTEND jamais l'ecriture : un microcontroleur qui ne lit plus
       bloquerait la boucle de rendu a la premiere trame en attente. On perd
       une couleur, on ne perd pas une image. */
    return this._writer.write(new TextEncoder().encode(txt))
      .catch(() => { this.actif = false; this.mort = true; });
  }

  /** Etat lisible, pour l'overlay de verification et les bancs. */
  get etat() {
    return {
      dispo: this.dispo, actif: this.actif, mort: this.mort,
      matrice: this.matrice, couleur: this.couleur,
      acidite: this.acidite, intensite: this.intensite,
      danger: this.danger, nep: this.nep,
    };
  }
}

/* Une seule instance : la boite est un peripherique, pas un objet de jeu. */
export const leds = new Leds();

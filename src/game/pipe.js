/* ---------------------------------------------------------------------------
   Conduite industrielle : ecoulement, plaques de biofilm, Nettoyage En Place.

   Ce n'est pas une arene, c'est un COULOIR. Trois regles portent la matrice,
   et toutes les trois viennent de l'atelier reel :

     1. L'ECOULEMENT. Laminaire : maximal au centre, nul contre la paroi. La
        couche limite est donc un vrai refuge, et remonter le courant coute
        cher. Le courant emporte aussi vos gouttes d'acide et les acides
        amines libres — rien ne reste ou on l'a laisse.

     2. LES PLAQUES DE BIOFILM. Elles sont accrochees en haut et en bas, elles
        emettent des cellules indefiniment, et elles se REFORMENT tant qu'un
        P. aeruginosa survit a proximite : c'est lui qui secrete l'alginate.
        Detruire la source ou survivre a ce qu'elle produit, c'est exactement
        l'arbitrage d'un atelier.

     3. LE NEP. Toutes les 150 s, un cycle traverse la conduite de bout en
        bout. Les biocides TOURNENT et chacun a un contre different, donc le
        build monte dans le lait cru se revele bon ou mauvais ici. Les mobs y
        meurent aussi : bien place, le NEP est une arme.
--------------------------------------------------------------------------- */

import { clamp } from '../core/util.js';
import { makeEnemy } from './entities.js';
import { PIPE_PLAQUE } from '../data/bestiary.js';

/** Les quatre biocides du cycle, dans l'ordre reel d'un NEP alterne. */
export const BIOCIDES = [
  {
    id: 'soude', label: 'SOUDE 2 %', couleur: 'alcalin',
    /* La soude saponifie les lipides membranaires : c'est une attaque de
       surface, s'en abriter physiquement suffit. */
    abri: true, flags: [],
    contre: 'S ABRITER',
  },
  {
    id: 'nitrique', label: 'ACIDE NITRIQUE', couleur: 'acide',
    /* Choc de pH et demineralisation : c'est une attaque chimique, l'abri
       ne sert a rien, il faut la tolerance a l'acide. */
    abri: false, flags: ['atr'],
    contre: 'TOLERANCE A L ACIDE',
  },
  {
    id: 'hypochlorite', label: 'HYPOCHLORITE', couleur: 'oxydant',
    abri: true, flags: ['catalase'],
    contre: 'CATALASE',
  },
  {
    id: 'peracetique', label: 'ACIDE PERACETIQUE', couleur: 'oxydant',
    /* Le seul que l'abri ne sauve pas : l'acide peracetique traverse l'EPS,
       et c'est precisement sa qualite industrielle. */
    abri: false, flags: ['catalase', 'efflux'],
    contre: 'CATALASE + EFFLUX',
  },
];

const PERIODE = 150;      // s entre deux cycles
const TELEGRAPHE = 8;     // s d'avertissement avant que le front parte
const VITESSE_NEP = 230;  // px/s du front
const DEMI_FRONT = 64;    // px : demi-epaisseur de la lame de biocide

/** Espacement des plaques le long du tube, et decalage haut/bas alterne. */
const PAS_PLAQUE = 230;
const REPOUSSE = 45;      // s, si un producteur d'alginate a survecu
const RAYON_ALGINATE = 150;

export class Conduite {
  constructor(game) {
    this.game = game;
    this.arena = game.arena;
    const cfg = game.matrix.pipe || {};
    this.flow = cfg.flow ?? 34;           // px/s au centre du tube
    this.slots = [];
    for (let x = -this.arena.halfX + PAS_PLAQUE; x < this.arena.halfX; x += PAS_PLAQUE) {
      const haut = this.slots.length % 2 === 0;
      this.slots.push({
        x,
        y: haut ? -this.arena.halfY + 9 : this.arena.halfY - 9,
        entite: null,
        repousse: 0,
      });
    }
    this.cip = { etat: 'attente', t: PERIODE - TELEGRAPHE, index: 0, frontX: 0 };
    this.annonce = 0;
  }

  /** Biocide du prochain cycle (ou du cycle en cours). */
  get biocide() { return BIOCIDES[this.cip.index % BIOCIDES.length]; }

  /** Vitesse de l'ecoulement a une ordonnee donnee. */
  flowAt(y) { return this.flow * this.arena.flowProfile(y); }

  /** Le point est-il dans une plaque de biofilm vivante ? */
  dansPlaque(x, y) {
    for (const s of this.slots) {
      const e = s.entite;
      if (!e || !e.alive) continue;
      const dx = x - e.x, dy = y - e.y;
      if (dx * dx + dy * dy < e.radius * e.radius) return e;
    }
    return null;
  }

  /** A l'abri du NEP : dans une plaque, ou tapi dans une rayure de la paroi. */
  aLAbri(x, y) {
    if (this.dansPlaque(x, y)) return true;
    return Math.abs(y) > this.arena.halfY - 11;
  }

  /** Le joueur encaisse-t-il le biocide en cours ? */
  protegeContre(biocide) {
    const p = this.game.player;
    if (!biocide.flags.length) return false;
    return biocide.flags.every((f) => p.flags.has(f));
  }

  update(dt) {
    this.entretienPlaques(dt);
    this.majCip(dt);
    this.emporte(dt);
  }

  /* --------------------------------------------------------- plaques --- */

  entretienPlaques(dt) {
    const g = this.game;
    for (const s of this.slots) {
      if (s.entite && !s.entite.alive) {
        s.entite = null;
        /* Elle ne repousse que si un secreteur d'alginate a survecu tout
           pres : tuer la plaque ne suffit pas, il faut tuer la cause. */
        s.repousse = this.alginateProche(s.x, s.y) ? REPOUSSE : Infinity;
      }
      if (s.entite) continue;
      if (s.repousse === Infinity) {
        if (this.alginateProche(s.x, s.y)) s.repousse = REPOUSSE;
        continue;
      }
      if (s.repousse > 0) { s.repousse -= dt; continue; }
      /* On ne fait exister que les plaques que le joueur peut voir arriver :
         le tube fait 2800 px, le champ en fait 250. */
      if (Math.abs(s.x - g.player.x) > 420) continue;
      const e = makeEnemy(PIPE_PLAQUE, s.x, s.y, 0.55, g.director.scale());
      e.plaqueSlot = s;
      e.emitCd = 3;
      g.enemies.push(e);
      s.entite = e;
    }
  }

  alginateProche(x, y) {
    for (const e of this.game.enemies) {
      if (!e.alive || e.ally > 0) continue;
      if (e.spec.ability !== 'alginate') continue;
      if (Math.hypot(e.x - x, e.y - y) < RAYON_ALGINATE) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------- NEP --- */

  majCip(dt) {
    const c = this.cip;
    const g = this.game;
    if (c.etat === 'attente') {
      c.t -= dt;
      if (c.t <= 0) {
        c.etat = 'telegraphe';
        c.t = TELEGRAPHE;
        g.announce(`NEP : ${this.biocide.label}`);
      }
      return;
    }
    if (c.etat === 'telegraphe') {
      c.t -= dt;
      /* Le courant s'emballe avant le passage : le champ previent. */
      if (c.t <= 0) {
        c.etat = 'vague';
        c.frontX = -this.arena.halfX - DEMI_FRONT;
      }
      return;
    }
    /* Vague : une lame de biocide traverse la conduite d'un bout a l'autre. */
    c.frontX += VITESSE_NEP * dt;
    this.brule(dt);
    if (c.frontX > this.arena.halfX + DEMI_FRONT) {
      c.etat = 'attente';
      c.index += 1;
      c.t = PERIODE - TELEGRAPHE;
    }
  }

  /** Intensite du biocide en un point, de 0 a 1. */
  intensite(x) {
    if (this.cip.etat !== 'vague') return 0;
    const d = Math.abs(x - this.cip.frontX);
    return d > DEMI_FRONT ? 0 : 1 - d / DEMI_FRONT;
  }

  brule(dt) {
    const g = this.game;
    const bio = this.biocide;

    const kJ = this.intensite(g.player.x);
    if (kJ > 0) {
      const abrite = bio.abri && this.aLAbri(g.player.x, g.player.y);
      if (!abrite && !this.protegeContre(bio)) {
        g.damagePlayer(26 * kJ * dt, null);
        g.flash = Math.max(g.flash, 0.35 * kJ);
      }
    }

    /* La flore y passe aussi. C'est ce qui fait du NEP une arme : il suffit
       de ne pas etre la ou elle est. */
    for (const e of g.enemies) {
      if (!e.alive || e.spec.neutral) continue;
      const k = this.intensite(e.x);
      if (k <= 0) continue;
      if (e.spec.cipImmune) continue;
      if (e.spec.cipShelter && bio.abri && this.aLAbri(e.x, e.y)) continue;
      /* Le boss est le seul a ne pas mourir du NEP : il s'y expose. C'est sa
         fenetre de degats, pas sa mise a mort. */
      const dmg = e.spec.boss ? 26 : 95;
      e.hp -= dmg * k * dt;
      e.cipTint = 0.4;
    }
  }

  /* ------------------------------------------------------- ecoulement --- */

  /** Le courant emporte tout ce qui flotte. */
  emporte(dt) {
    const g = this.game;
    const boost = this.cip.etat === 'telegraphe' ? 1.9 : 1;

    /* Le joueur : sauf s'il est dans une plaque, qui le met a l'abri du flux. */
    if (!this.dansPlaque(g.player.x, g.player.y)) {
      g.player.x += this.flowAt(g.player.y) * boost * dt;
    }
    for (const e of g.enemies) {
      if (!e.alive) continue;
      if (e.spec.immobile || e.plaqueSlot) continue;
      if (this.dansPlaque(e.x, e.y)) continue;
      e.x += this.flowAt(e.y) * boost * dt * (e.spec.mot === 'none' ? 0.35 : 1);
    }
    /* Une goutte d'acide lactique est emportee comme le reste : viser en
       amont, c'est arroser large ; viser en aval, c'est tirer court. */
    for (const b of g.bullets) if (b.alive) b.x += this.flowAt(b.y) * boost * dt * 0.6;
    /* Un acide amine libre est petit et dense : il suit le courant, mais pas
       a la vitesse du fluide. A vitesse pleine, la recolte s'effondrait et le
       joueur finissait quatre niveaux sous celui du lait cru. */
    for (const k of g.pickups) if (k.alive) k.x += this.flowAt(k.y) * boost * dt * 0.45;

    g.arena.confine(g.player, 6, -0.25);
  }

  /** Ce que le HUD doit afficher : etat du cycle, en une ligne. */
  get hud() {
    const c = this.cip;
    const bio = this.biocide;
    if (c.etat === 'vague') return { urgence: 2, texte: `NEP ${bio.label}`, sous: bio.contre };
    if (c.etat === 'telegraphe') {
      return { urgence: 1, texte: `NEP DANS ${Math.ceil(c.t)}`, sous: bio.label };
    }
    return { urgence: 0, texte: `NEP ${Math.ceil(c.t)}`, sous: bio.label };
  }
}

export { PERIODE as NEP_PERIODE };

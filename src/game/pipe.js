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
import { PERIODE } from './pipe-geo.js';

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

const PERIODE_NEP = 150;  // s entre deux cycles
const TELEGRAPHE = 8;     // s d'avertissement avant que le front parte
const VITESSE_NEP = 230;  // px/s du front
const DEMI_FRONT = 64;    // px : demi-epaisseur de la lame de biocide

/** Espacement des plaques le long du tube, et decalage haut/bas alterne. */
const PAS_PLAQUE = 330;
const REPOUSSE = 45;      // s, si un producteur d'alginate a survecu
const REPOUSSE_LENTE = 210;  // s, par recolonisation depuis le flux
const RAYON_ALGINATE = 150;

export class Conduite {
  constructor(game) {
    this.game = game;
    this.arena = game.arena;
    const cfg = game.matrix.pipe || {};
    this.flow = cfg.flow ?? 34;           // px/s au centre du tube
    this.slots = [];
    for (let x = -PERIODE / 2 + PAS_PLAQUE; x < PERIODE / 2; x += PAS_PLAQUE) {
      /* `x0` est l'abscisse CANONIQUE de l'emplacement, dans un tour. On ne
         la decale jamais : c'est la position du joueur qui se replie dessus.
         Les avoir decalees avec le tapis roulant cassait leur periodicite et
         le couloir se vidait de ses plaques au bout d'un tour. */
      this.slots.push({
        x0: x, haut: this.slots.length % 2 === 0, entite: null, repousse: 0,
      });
    }
    this.cip = { etat: 'attente', t: PERIODE_NEP - TELEGRAPHE, index: 0, frontX: 0 };
    this.annonce = 0;
  }

  /** Biocide du prochain cycle (ou du cycle en cours). */
  get biocide() { return BIOCIDES[this.cip.index % BIOCIDES.length]; }

  /** Vitesse de l'ecoulement en un point.
   *
   *  Elle depend de l'ABSCISSE autant que de l'ordonnee : par conservation du
   *  debit, la ou la conduite se pince le courant accelere. C'est la seule
   *  loi du stage, et elle suffit a rendre la geometrie lisible sans un mot. */
  flowAt(y, x = 0) { return this.flow * this.arena.flowProfile(y, x); }

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
    const c = this.arena.geo.canal(x, y);
    return (y - c.bas) < 11 || (c.haut - y) < 11;
  }

  /** Le joueur encaisse-t-il le biocide en cours ? */
  protegeContre(biocide) {
    const p = this.game.player;
    if (!biocide.flags.length) return false;
    return biocide.flags.every((f) => p.flags.has(f));
  }

  update(dt) {
    this.tapisRoulant();
    this.entretienPlaques(dt);
    this.majCip(dt);
    this.emporte(dt);
  }

  /**
   * Tapis roulant : le couloir n'a pas de bout.
   *
   * Quand le joueur a parcouru un tour, on recentre TOUT LE MONDE d'un coup.
   * Personne ne se retrouve de l'autre cote d'une couture, donc aucune
   * distance relative n'est faussee. Et comme la geometrie et le decor sont
   * periodiques de cette meme longueur, l'image ne bouge pas.
   *
   * C'est ce qui repare le vrai defaut du stage : avec des extremites
   * fermees, le courant finissait toujours par vous plaquer contre un mur
   * invisible, sans retour possible.
   */
  tapisRoulant() {
    const g = this.game;
    const d = -Math.round(g.player.x / PERIODE) * PERIODE;
    if (d === 0) return;
    g.player.x += d;
    for (const e of g.enemies) e.x += d;
    for (const b of g.bullets) b.x += d;
    for (const k of g.pickups) k.x += d;
    for (const z of g.zones) z.x += d;
    for (const q of g.particles) q.x += d;
    if (this.cip.etat === 'vague') { this.cip.frontX += d; this.cip.finX += d; }
    /* Le decor se regenere tout seul (il est hache sur les coordonnees, et
       periodique), et la grille de pH couvre exactement un tour : une poche
       d'acide reste donc a sa place dans le monde. */
  }

  /* --------------------------------------------------------- plaques --- */

  /** Abscisse de l'instance de cet emplacement la plus proche du joueur. */
  posSlot(s) {
    const px = this.game.player.x;
    return s.x0 + Math.round((px - s.x0) / PERIODE) * PERIODE;
  }

  entretienPlaques(dt) {
    const g = this.game;
    for (const s of this.slots) {
      const sx = this.posSlot(s);
      /* 1. Hors de portee : on la range, sans que ca compte comme une
         destruction. Le joueur fait une vingtaine de tours sur un run ;
         sans ca, TOUS les emplacements finissaient occupes a demeure. */
      if (s.entite && s.entite.alive && Math.abs(s.entite.x - g.player.x) > 700) {
        s.entite.alive = false;
        s.entite = null;
        continue;
      }

      /* 2. Detruite par le joueur : elle ne repousse vite que si un
         secreteur d'alginate a survecu tout pres. Sinon elle finit par
         revenir quand meme, par recolonisation depuis le flux — beaucoup
         plus tard. Un couloir sans fin ne peut pas s'appauvrir
         definitivement a chaque plaque abattue. */
      if (s.entite && !s.entite.alive) {
        s.entite = null;
        s.repousse = this.alginateProche(sx) ? REPOUSSE : REPOUSSE_LENTE;
      }
      if (s.entite) continue;

      if (s.repousse > 0) {
        /* Un producteur d'alginate qui passe par la accelere la reprise. */
        if (s.repousse > REPOUSSE && this.alginateProche(sx)) s.repousse = REPOUSSE;
        s.repousse -= dt;
        continue;
      }

      /* 3. On ne fait exister que ce que le joueur peut voir arriver : le
         tour fait 2816 px, le champ en fait 250. */
      if (Math.abs(sx - g.player.x) > 420) continue;
      /* La plaque se colle a la paroi LA OU ELLE EST : la section varie, une
         ordonnee figee l'aurait laissee flotter au milieu d'une chambre. */
      const c = g.arena.geo.canal(sx, s.haut ? -1 : 1);
      const sy = s.haut ? c.bas + 9 : c.haut - 9;
      const e = makeEnemy(PIPE_PLAQUE, sx, sy, 0.55, g.director.scale());
      /* Dans une chambre, la plaque a la place de devenir une MASSE : c'est
         elle qui referme la section. Dans un pincement, elle reste mince,
         sinon elle bouchait le passage. */
      const place = (c.haut - c.bas) / 2;
      e.radius = clamp(place * 0.42, 8, 26);
      e.plaqueSlot = s;
      e.emitCd = 3;
      g.enemies.push(e);
      s.entite = e;
    }
  }

  /** Un secreteur d'alginate vit-il pres de cette abscisse ? */
  alginateProche(x) {
    for (const e of this.game.enemies) {
      if (!e.alive || e.ally > 0) continue;
      if (e.spec.ability !== 'alginate') continue;
      if (Math.abs(e.x - x) < RAYON_ALGINATE) return true;
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
        /* Le front part EN AMONT DU JOUEUR et balaie jusqu'en aval. Le
           couloir n'ayant plus de bout, le faire partir d'une extremite
           n'aurait aucun sens : le NEP est un evenement qu'on voit arriver,
           pas un bord de carte. */
        c.frontX = g.player.x - 620;
        c.finX = c.frontX + 1560;
      }
      return;
    }
    /* Vague : une lame de biocide traverse la conduite d'un bout a l'autre. */
    c.frontX += VITESSE_NEP * dt;
    this.brule(dt);
    if (c.frontX > c.finX) {
      c.etat = 'attente';
      c.index += 1;
      c.t = PERIODE_NEP - TELEGRAPHE;
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
      g.player.x += this.flowAt(g.player.y, g.player.x) * boost * dt;
    }
    for (const e of g.enemies) {
      if (!e.alive) continue;
      if (e.spec.immobile || e.plaqueSlot) continue;
      if (this.dansPlaque(e.x, e.y)) continue;
      e.x += this.flowAt(e.y, e.x) * boost * dt * (e.spec.mot === 'none' ? 0.35 : 1);
    }
    /* Une goutte d'acide lactique est emportee comme le reste : viser en
       amont, c'est arroser large ; viser en aval, c'est tirer court. */
    for (const b of g.bullets) if (b.alive) b.x += this.flowAt(b.y, b.x) * boost * dt * 0.6;
    /* Un acide amine libre est petit et dense : il suit le courant, mais pas
       a la vitesse du fluide. A vitesse pleine, la recolte s'effondrait et le
       joueur finissait quatre niveaux sous celui du lait cru. */
    for (const k of g.pickups) if (k.alive) k.x += this.flowAt(k.y, k.x) * boost * dt * 0.45;

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

export { PERIODE_NEP as NEP_PERIODE };

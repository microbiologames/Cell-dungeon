/* ---------------------------------------------------------------------------
   Le joueur : une bacterie lactique qui vole des genes a tout le monde.
   Le transfert horizontal (plasmides, phages, ilots) est la justification
   diegetique du fait qu'en fin de run elle ne ressemble plus a rien de connu.
--------------------------------------------------------------------------- */

import { computeStats } from './stats.js';
import { EVOLUTIONS, EVO_BY_ID, rarityWeight } from '../data/evolutions.js';
import { XP_FOR_LEVEL } from '../data/matrices.js';
import { clamp, weightedPick, girer, TAU } from '../core/util.js';
import { Sillage } from '../render/flagella.js';

/**
 * Reglages de NAGE, regroupes pour pouvoir les balayer.
 *
 * Ils sont exportes et mutables parce qu'ils se choisissent en REGARDANT des
 * trajectoires, pas en raisonnant : `node tools/trajectoire.mjs` rejoue la
 * meme sequence de touches pour plusieurs valeurs et trace les chemins.
 *
 * `alignement` — part du cap du corps dans la direction de poussee.
 *   A zero, la cellule glisse instantanement ou on demande et l'orientation
 *   n'est qu'une decoration : la trajectoire tourne au carre, ca se lit comme
 *   une patinoire. A un, on ne pousse que selon l'axe du corps — juste pour
 *   un flagelle, mais on perd l'esquive et une cellule peu agile s'ENROULE au
 *   lieu de suivre l'intention. Mesure a 0,5 : la flagellation polaire
 *   bouclait sur elle-meme.
 *
 * `traineeRotation` — le temps de giration vaut ce nombre DIVISE PAR
 *   L'AGILITE. L'agilite seule, pas `vitesse / agilite` comme pour la
 *   translation : la flagellation polaire monte la vitesse ET baisse
 *   l'agilite, si bien que le temps de translation s'etale d'un facteur six.
 *   Reporte tel quel sur la giration, ca donnait 4,75 s pour un demi-tour.
 *
 * `tauAngMax` — plafond du temps de giration. Virer mal est un caractere,
 *   perdre le controle est un defaut.
 */
export const NAGE = {
  alignement: 0.34,
  traineeRotation: 80,
  tauAngMax: 0.34,
  tauAngMin: 0.07,
};

export class Player {
  constructor(game) {
    this.game = game;
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.ang = -Math.PI / 2;
    this.angCible = this.ang;
    this.omega = 0;
    this.phase = 0;
    this.taken = new Map();
    this.level = 1;
    this.aa = 0;
    this.recompute();
    this.hp = this.stats.maxHp;
    this.fireCd = 0;
    this.dashCd = 0;
    this.dashTtl = 0;
    this.invuln = 0;
    this.dot = 0; this.dotTtl = 0;
    this.dormancyUsed = false;
    this.stillTime = 0;
    this.shield = 0;
    this.sideroStacks = 0; this.sideroTtl = 0;
    this.crisprBonus = 0;
    this.phageCd = 0;
    this.conjugationCd = 30;
    this.epsCd = 0;
    this.hypermutTimer = 45;
    this.rerollUsed = false;
    this.phagocytosedBy = null;
    this.phagoTimer = 0;
    this.satellites = [];
    this.kills = 0;
    /* Deux grandeurs qui ne servent qu'au rendu, mais qui viennent de la
       simulation : l'effort de nage (battement des flagelles, dandinement)
       et la cambrure (vitesse de la mise au point). Les lisser evite qu'un
       a-coup d'entree fasse claquer l'animation. */
    this.drive = 0;
    this.bend = 0;
    /* Inclinaison de virage : la queue chasse vers l'exterieur du tournant,
       comme chez un poisson. Derivee de la vitesse angulaire. */
    this.lean = 0;
    /* Memoire de cap : les flagelles suivent le chemin de la cellule. */
    this.sillage = new Sillage();
    /* Desordre du faisceau, apres un arret brutal ou un virage sec. */
    this.trouble = 0;
  }

  recompute() {
    const r = computeStats(this.taken);
    this.stats = r.stats;
    this.flags = r.flags;
    this.rankOf = r.rank;
    this.radius = this.stats.hitbox;
    if (this.hp !== undefined) this.hp = Math.min(this.hp, this.stats.maxHp);
  }

  /**
   * Flagellation visible. Les deux evolutions de DISPOSITION comptent aussi :
   * sans ca, prendre 'Flagellation polaire en touffe' ne faisait apparaitre
   * aucun flagelle, alors que ses effets de stats s'appliquaient bien.
   */
  get flagellation() {
    const base = this.rankOf('flagelle');
    const peri = this.rankOf('peritriche');
    const pole = this.rankOf('polaire');
    let mode = 'bundle';
    if (peri > pole) mode = 'peritriche';
    else if (pole > 0) mode = 'polaire';
    return { count: base + peri * 2 + pole * 2, mode };
  }

  /** Cadence effective : siderophores, plus le confort acide.
   *  Une bacterie lactique fonctionne mieux dans l'acide qu'elle produit. */
  get fireRate() {
    const sid = this.sideroTtl > 0 ? 1 + 0.02 * this.sideroStacks : 1;
    const acid = 1 + 0.14 * (this.game.acidComfort || 0);
    return this.stats.fireRate * sid * acid;
  }

  /** Degats effectifs : quorum sensing et CRISPR s'ajoutent ici. */
  damageAgainst(enemy, sharpFactor) {
    let d = this.stats.dmg * sharpFactor;
    if (this.flags.has('quorum')) {
      d *= 1 + Math.min(0.60, 0.06 * this.game.sharpEnemyCount);
    }
    if (this.crisprBonus) d *= 1 + this.crisprBonus;
    if (enemy) {
      if (enemy.spec.gram === '+' && this.stats.gramPierce) {
        d *= 1 + this.stats.gramPierce;
      }
      if (enemy.spec.gram === 'fungi' && this.stats.fungiDmg) {
        d *= 1 + this.stats.fungiDmg;
      }
    }
    return d;
  }

  gainAa(amount) {
    let a = amount * this.stats.aaGain;
    /* Transformation naturelle : la competence monte sous stress. */
    if (this.flags.has('transformation') && this.hp < this.stats.maxHp * 0.4) a *= 2;
    this.aa += a;
    let levels = 0;
    while (this.aa >= XP_FOR_LEVEL(this.level) && levels < 5) {
      this.aa -= XP_FOR_LEVEL(this.level);
      this.level++;
      levels++;
    }
    return levels;
  }

  /* -------------------------------------------------------- evolutions -- */

  handSize() { return this.flags.has('hypermutateur') ? 4 : 3; }

  /** Tire une main sans doublon, hors evolutions deja au rang maximal. */
  draw(minRarity = null) {
    const hyper = this.flags.has('hypermutateur');
    const order = ['commune', 'peucommune', 'rare', 'epique', 'legendaire'];
    const minIdx = minRarity ? order.indexOf(minRarity) : 0;
    const pool = EVOLUTIONS.filter((e) => (this.taken.get(e.id) || 0) < e.ranks
      && order.indexOf(e.rarity) >= minIdx);
    const hand = [];
    const used = new Set();
    const n = minRarity ? 1 : this.handSize();
    for (let i = 0; i < n; i++) {
      const cands = pool.filter((e) => !used.has(e.id));
      if (!cands.length) break;
      const pick = weightedPick(this.game.rng, cands, (e) => rarityWeight(e.rarity, hyper));
      if (!pick) break;
      used.add(pick.id);
      hand.push(pick);
    }
    return hand;
  }

  take(id) {
    const evo = EVO_BY_ID[id];
    if (!evo) return;
    const cur = this.taken.get(id) || 0;
    if (cur >= evo.ranks) return;
    this.taken.set(id, cur + 1);
    const before = this.stats.maxHp;
    this.recompute();
    /* Un gain de PV max soigne d'autant : sinon prendre du PV punit. */
    if (this.stats.maxHp > before) this.hp += this.stats.maxHp - before;
    this.hp = clamp(this.hp, 1, this.stats.maxHp);
    if (id === 'transposon') this.rerollUsed = false;
  }

  /** Liste triee pour le HUD. */
  summary() {
    return [...this.taken.entries()]
      .map(([id, rank]) => ({ evo: EVO_BY_ID[id], rank }))
      .filter((e) => e.evo)
      .sort((a, b) => a.evo.label.localeCompare(b.evo.label));
  }

  /* ------------------------------------------------------------ update -- */

  update(dt, move, game) {
    this.phase += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.dashTtl > 0) this.dashTtl -= dt;
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.sideroTtl > 0) { this.sideroTtl -= dt; if (this.sideroTtl <= 0) this.sideroStacks = 0; }
    if (this.phageCd > 0) this.phageCd -= dt;
    if (this.epsCd > 0) this.epsCd -= dt;
    if (this.conjugationCd > 0) this.conjugationCd -= dt;
    if (this.dotTtl > 0) { this.dotTtl -= dt; this.hp -= this.dot * dt; }
    if (this.stats.regen) this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen * dt);

    /* Hypermutateur : une stat derive toutes les 45 s. Instable par nature. */
    if (this.flags.has('hypermutateur')) {
      this.hypermutTimer -= dt;
      if (this.hypermutTimer <= 0) {
        this.hypermutTimer = 45;
        game.hypermutate();
      }
    }

    /* Phagocyte : sans endolysine, on ne peut rien faire. */
    if (this.phagocytosedBy) {
      this.phagoTimer -= dt;
      if (this.flags.has('endolysine') && this.phagoTimer <= 2.5) {
        const host = this.phagocytosedBy;
        host.hp = 0;
        game.announce('ENDOLYSINE');
        this.phagocytosedBy = null;
      } else if (this.phagoTimer <= 0) {
        this.phagocytosedBy = null;
      }
      return;
    }

    /* --- deplacement a inertie ------------------------------------------
       A l'echelle reelle un procaryote n'a AUCUNE inertie : a nombre de
       Reynolds tres bas, il s'arrete en une fraction de diametre des qu'il
       cesse de pousser. C'est une deviation assumee, pour le toucher.

       Le modele est un moteur a saturation : on vise une vitesse cible et
       on l'approche avec une constante de temps tau = vitesse / agilite.
       La flagellation pilote donc directement le feel :
         peritriche  tau ~ 0.10 s  -> vif, tourne sec
         polaire     tau ~ 0.59 s  -> lance fort, vire mal
    */
    const maxSpeed = this.stats.speed * game.playerSlowFactor;
    const tau = maxSpeed / Math.max(1, this.stats.accel);
    const k = 1 - Math.exp(-dt / Math.max(tau, 0.016));

    /* --- giration ------------------------------------------------------ */
    /* Le cap suit l'intention avec la meme AGILITE que la translation : une
       cellule vive vire sec, une cellule lancee vire large. Les evolutions
       de flagellation pilotent donc les deux d'un coup, ce qui est la bonne
       place pour ce reglage — c'est deja la stat qui dit comment on nage.
       Le cas qui rend le clavier brusque est celui-la : huit directions
       seulement, donc une cible qui saute de 45 degres d'un coup. Au
       joystick l'angle balaie en continu et le probleme ne se pose pas.

       Tourner coute PLUS cher qu'accelerer : la trainee de rotation d'un
       corps allonge dans un fluide visqueux est bien superieure a sa trainee
       de translation, et une bacterie se reoriente d'ailleurs surtout en
       culbutant, pas en braquant. D'ou un temps de giration multiple du
       temps de mise en train, et non egal. */
    const intention = Math.hypot(move.x, move.y);
    if (intention > 0.02) this.angCible = Math.atan2(move.y, move.x);
    /* Le plafond n'est pas cosmetique : mesure a 0,75 s, la flagellation
       polaire faisait BOUCLER la trajectoire — la cellule ne suivait plus
       l'intention du tout, elle tournait en rond. Virer mal est un caractere,
       perdre le controle est un defaut. */
    const tauAng = clamp(NAGE.traineeRotation / Math.max(60, this.stats.accel),
      NAGE.tauAngMin, NAGE.tauAngMax);
    const omegaMax = clamp(1.15 / tauAng, 1.8, 11);
    girer(this, dt, this.angCible, tauAng, omegaMax);
    /* Ce qui sert au rendu : la queue chasse d'autant plus que ca tourne. */
    const leanCible = clamp(this.omega / omegaMax, -1, 1);
    this.lean += (leanCible - this.lean) * Math.min(1, dt * 12);

    /* --- poussee ------------------------------------------------------- */
    /* Un flagelle pousse selon l'AXE DU CORPS. On melange donc la direction
       demandee et celle du corps : la trajectoire s'incurve au lieu de
       tourner au carre, et pousser de travers coute de la vitesse. */
    let tvx = 0, tvy = 0;
    if (intention > 0.02) {
      const dx = move.x / intention, dy = move.y / intention;
      const bx = Math.cos(this.ang), by = Math.sin(this.ang);
      const A = NAGE.alignement;
      let px = dx * (1 - A) + bx * A;
      let py = dy * (1 - A) + by * A;
      const pl = Math.hypot(px, py);
      if (pl > 1e-4) { px /= pl; py /= pl; }
      /* On ne pousse pas de travers : le rendement tombe quand le corps
         n'est pas encore aligne sur l'intention. */
      const rendement = 0.5 + 0.5 * Math.max(0, dx * bx + dy * by);
      const v = maxSpeed * Math.min(1, intention) * rendement;
      tvx = px * v; tvy = py * v;
    }
    this.vx += (tvx - this.vx) * k;
    this.vy += (tvy - this.vy) * k;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const moving = Math.hypot(this.vx, this.vy) > maxSpeed * 0.12;

    /* Effort de nage : l'ENTREE, pas la vitesse. Une cellule qui pousse
       contre un globule bat des flagelles sans avancer, et c'est ce qu'on
       veut voir. */
    const effort = Math.min(1, Math.hypot(move.x, move.y));
    const avant = this.drive;
    this.drive += (effort - this.drive) * Math.min(1, dt * 9);

    /* Desordre du faisceau. Deux causes, toutes deux physiques : un ARRET
       BRUTAL (les filaments continuent sur leur lancee et se dephasent avant
       de se recaler) et un VIRAGE SEC (le faisceau s'ouvre — c'est le
       mecanisme meme de la culbute). Il retombe en une demi-seconde. */
    const freinage = Math.max(0, (avant - this.drive) / Math.max(dt, 1e-3)) * 0.22;
    const vrille = Math.abs(this.omega) / Math.max(omegaMax, 1e-3) * 0.9;
    this.trouble = clamp(Math.max(this.trouble * Math.exp(-dt / 0.45), freinage, vrille), 0, 1);
    this.sillage.pousser(this.ang, dt);
    /* Cambrure : la VITESSE de la mise au point, pas sa valeur. On ne se
       cambre que pendant qu'on change de plan. */
    const vFocus = clamp((game.focusTarget - game.focus) * 3.2, -1, 1);
    this.bend += (vFocus - this.bend) * Math.min(1, dt * 7);

    if (moving) {
      this.stillTime = 0;
      this.shield = 0;
      /* EPS : la trainee visqueuse ne se depose qu'en mouvement. */
      if (this.flags.has('eps') && this.epsCd <= 0) {
        this.epsCd = 0.35;
        game.dropEps(this.x, this.y);
      }
    } else {
      this.stillTime += dt;
      /* Biofilm inductible : passage planctonique -> sessile sous stress. */
      if (this.flags.has('biofilm') && this.stillTime > 1.5) {
        this.shield = Math.min(60, this.shield + 30 * dt);
      }
    }

    /* On rebondit mollement sur la paroi au lieu d'y coller. La forme de
       la paroi appartient a la matrice : menisque ou acier. */
    game.arena.confine(this, 6, -0.25);
  }

  /** Twitching : une impulsion breve, pas un multiplicateur de vitesse.
   *  Avec l'inertie, l'impulsion est le seul moyen de sortir d'un piege. */
  dash() {
    if (!this.flags.has('dash') || this.dashCd > 0) return false;
    this.dashCd = 6;
    this.dashTtl = 0.16;
    this.invuln = Math.max(this.invuln, 0.2);
    const a = this.ang;
    this.vx += Math.cos(a) * this.stats.speed * 2.8;
    this.vy += Math.sin(a) * this.stats.speed * 2.8;
    return true;
  }
}

export { TAU };

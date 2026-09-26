/* ---------------------------------------------------------------------------
   Orchestration : etat, boucle de simulation, regles.
--------------------------------------------------------------------------- */

import { clamp, mulberry32, TAU } from '../core/util.js';
import { MATRICES, aaScale } from '../data/matrices.js';
import { BESTIARY } from '../data/bestiary.js';
import { Player } from './player.js';
import { ESPECE_BY_ID, ESPECE_DEFAUT } from '../data/especes.js';
import { makeArena } from './arena.js';
import { PhField } from './phfield.js';
import { collectDecor, applyDecor, decorBlocksBullet, convection } from './decor.js';
import { Director } from './director.js';
import { Conduite } from './pipe.js';
import { Bulles } from './bulles.js';
import {
  makeEnemy, makeBullet, makePickup, makeZone, updateEnemy, pickTarget,
  sharpness, damageFalloff, compact, IN_PLANE, nearestEnemy,
} from './entities.js';

/* Coefficient de trainee des gouttes d'acide, en 1/s. La distance parcourue
   plafonne a vitesse / ce coefficient : le changer change la portee reelle. */
export const BULLET_DRAG = 0.6;

/* Filet de securite : aucune capacite d'engendrement ne peut faire depasser
   ce nombre d'ennemis. Le directeur, lui, se regule par son budget. */
export const MAX_ENEMIES = 150;

/* RECYCLAGE. Le champ visible fait 124 px de rayon ; a 240 px le mob est hors
   de l'ecran depuis longtemps, meme en paysage, et le recycler ne se voit
   donc jamais se produire. C'est la condition pour que ce soit honnete. */
const OUBLI = 240;
/* Il revient a portee d'engagement mais pas dans les jambes : 118 px est
   au-dela du rayon de captation (34) et de la portee de tir de depart (96),
   donc on le voit venir et on a le temps d'en decider. */
const RECYCLE_MIN = 118;
const RECYCLE_MAX = 172;

export const STATE = {
  MENU: 'menu', PLAYING: 'playing', LEVELUP: 'levelup',
  PAUSED: 'paused', DEAD: 'dead', WON: 'won',
};

export class Game {
  constructor(matrixId = 'milk', seed = Date.now(), especeId = ESPECE_DEFAUT) {
    this.matrix = MATRICES[matrixId];
    this.rng = mulberry32(seed >>> 0);
    this.seed = seed >>> 0;
    /* La souche est choisie dans le lobby et ne change pas en cours de
       partie : elle est donc portee par la partie, pas par le joueur, sinon
       un reset la perdrait. */
    this.especeId = ESPECE_BY_ID[especeId] ? especeId : ESPECE_DEFAUT;
    this.reset();
  }

  reset() {
    this.time = 0;
    /* La forme de l'arene est une donnee de la matrice : goutte pour le lait,
       couloir pour la conduite. Tout le monde interroge cet objet. */
    this.arena = makeArena(this.matrix, this.seed);
    this.state = STATE.MENU;
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.zones = [];
    this.particles = [];
    this.removedDecor = new Set();
    this.player = new Player(this, this.especeId);
    this.director = new Director(this);
    /* Le SCORE pese la menace abattue, la ou `kills` ne compte que des
       tetes. Voir `killEnemy` pour la formule et ce qu'elle corrige. */
    this.score = 0;
    /* Couture de banc : `tools/fuite.mjs` remet ce drapeau a faux pour
       verifier que son verdict attrape bien le defaut qu'il garde. Rien
       d'autre n'y touche, et le jeu ne l'expose nulle part. */
    this.recyclage = true;
    this.recycles = 0;
    /* Mecaniques propres a la matrice. Seule la conduite en a pour l'instant :
       courant, plaques de biofilm et Nettoyage En Place. */
    this.conduite = this.matrix.id === 'pipe' ? new Conduite(this) : null;
    /* Les milieux en fermentation ouverte degagent du CO2 en permanence :
       les bulles remontent vers l'observateur et bousculent tout. */
    this.bulles = this.matrix.bulles ? new Bulles(this) : null;
    this.focus = 0;
    this.focusTarget = 0;
    this.boss = null;
    this.banner = null;
    this.bannerTtl = 0;
    this.hand = null;
    this.pendingLevels = 0;
    this.phField = new PhField(this.matrix, this.arena);
    this.ph = this.matrix.chem.phStart;
    this.shots = 0;
    this.sharpEnemyCount = 0;
    this.playerSlowFactor = 1;
    this.acidComfort = 0;
    this.decorNear = [];
    this.flash = 0;
    this.shake = 0;
  }

  get scale() { return this.director.scale(); }
  get progress() { return clamp(this.time / this.matrix.duration, 0, 1); }

  announce(text) {
    this.banner = text;
    this.bannerTtl = 2.4;
  }

  /* -------------------------------------------------------------- focus - */

  updateFocus(dt, axis, impulse) {
    /* La molette d'un navigateur arrive par crans discrets ; l'appliquer
       directement a la mise au point faisait sauter l'image d'un cran a
       l'autre. Une vraie vis micrometrique n'a pas de crans.

       On accumule donc les crans dans une CIBLE, et le plan focal la
       rejoint de facon continue. Un cran isole devient un glissement doux,
       et une rotation soutenue reste parfaitement lineaire. */
    this.focusTarget = clamp(this.focusTarget + impulse + axis * 1.5 * dt, -1.05, 1.05);
    const k = 1 - Math.exp(-dt / 0.085);
    this.focus += (this.focusTarget - this.focus) * k;
  }

  sharpnessOf(z) {
    return sharpness(z, this.focus, this.player.stats.dof);
  }

  /* ------------------------------------------------------------ boucle -- */

  update(dt, input) {
    if (this.state !== STATE.PLAYING) return;
    this.time += dt;
    if (this.bannerTtl > 0) this.bannerTtl -= dt;
    if (this.flash > 0) this.flash -= dt * 3;
    if (this.shake > 0) this.shake -= dt * 6;

    this.updateFocus(dt, input.focusAxis, input.takeFocusImpulse());
    if (input.takeDash()) this.player.dash();

    /* Decor proche, recalcule une fois par image et partage par tout le
       monde : joueur, mobs et projectiles interrogent la meme liste. */
    this.decorNear = collectDecor(this.matrix, this.player.x, this.player.y,
      240, this.removedDecor, this.time);

    this.computeZoneEffects();
    const solide = !!this.matrix.decor.solide;
    const decorSlow = applyDecor(this.player, this.player.radius, this.decorNear, dt, solide, this.matrix.decor);
    this.playerSlowFactor = Math.min(this.playerSlowFactor, decorSlow);
    this.player.update(dt, input.move, this);

    this.director.update(dt);
    /* Apres le directeur (les plaques posent leurs entites) et avant les
       mobs : le courant deplace ce que la trame vient de creer. */
    if (this.conduite) this.conduite.update(dt);
    if (this.bulles) this.bulles.update(dt);

    for (const e of this.enemies) {
      if (!e.alive) continue;
      /* Les mobs collent aux globules et rebondissent sur les bulles comme
         le joueur : le decor n'est pas un privilege. */
      if (e.spec.mot !== 'none') {
        const s = applyDecor(e, e.radius, this.decorNear, dt, solide, this.matrix.decor);
        if (s < 1) { e.slow = Math.max(e.slow, 1 - s); e.slowTtl = Math.max(e.slowTtl, 0.12); }
      }
      updateEnemy(e, dt, this);
    }

    /* Apres tous les deplacements, avant la chimie : les gros corps
       neutres sont des obstacles, pas du decor peint. */
    this.resolveEncombrement();

    this.updateBullets(dt);
    this.phField.update(dt, this.player.x, this.player.y);
    this.applyChemistry(dt);
    this.updateZones(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.autoFire(dt);
    this.applyAuras(dt);
    this.updateAllies(dt);

    /* Comptage des mobs nets, utilise par le quorum sensing et le HUD. */
    let sharpCount = 0;
    for (const e of this.enemies) {
      if (e.alive && e.ally <= 0 && this.sharpnessOf(e.z) > 0.5) sharpCount++;
    }
    this.sharpEnemyCount = sharpCount;

    this.recyclerLoin();

    for (const e of this.enemies) {
      if (e.alive && e.hp <= 0) this.killEnemy(e);
    }

    compact(this.enemies); compact(this.bullets);
    compact(this.pickups); compact(this.zones); compact(this.particles);

    if (this.boss && !this.boss.alive) this.boss = null;
    this.director.bossActive = !!this.boss;

    if (this.player.hp <= 0) this.onPlayerDeath();
    if (this.time >= this.matrix.duration && !this.boss
      && this.director.fired.size >= this.matrix.events.length) {
      this.state = STATE.WON;
    }
  }

  /* -------------------------------------------------------------- tir --- */

  autoFire(dt) {
    const p = this.player;
    if (p.phagocytosedBy) return;
    /* Une spore ne tire pas : elle est deshydratee et son metabolisme est a
       l'arret. C'est la moitie du cout de la sporulation. */
    if (p.dormance > 0) return;
    if (p.fireCd > 0) return;
    const target = pickTarget(this);
    if (!target) return;

    p.fireCd = 1 / p.fireRate;
    const dx = target.x - p.x, dy = target.y - p.y;
    const base = Math.atan2(dy, dx);
    const n = Math.max(1, Math.round(p.stats.projectiles));
    const spread = p.stats.spread;

    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * spread;
      const a = base + off;
      const b = makeBullet(
        p.x, p.y, 0,
        Math.cos(a) * p.stats.bulletSpeed, Math.sin(a) * p.stats.bulletSpeed,
        0, p.stats.bulletRadius, p.stats.pierce, 'player',
        {
          t3ss: p.flags.has('t3ss'),
          coagulase: p.flags.has('coagulase'),
          protease: p.flags.has('protease'),
        },
      );
      /* La TOXINE voyage avec le projectile : un tir deja en vol garde la
         chimie de la souche qui l'a lache, meme si le joueur change d'etat
         entre-temps. C'est aussi ce que lit le rendu pour le dessiner. */
      b.tir = p.tir;
      b.hits = new Set();
      /* Duree de vie calculee pour que la goutte atteigne REELLEMENT la
         portee de ciblage. Avec une trainee exponentielle, la distance
         parcourue plafonne a v0/k : une valeur de k trop forte rendait une
         part des cibles designees physiquement inatteignables, et le tir
         automatique visait dans le vide. */
      const k = BULLET_DRAG;
      const reach = p.stats.bulletSpeed / k;              // portee asymptotique
      const want = Math.min(p.stats.range, reach * 0.92);
      b.life = -Math.log(1 - (want * k) / p.stats.bulletSpeed) / k;
      b.ttl = b.life;
      b.r0 = p.stats.bulletRadius;
      b.age = 0;
      this.bullets.push(b);
    }

    this.shots++;
  }

  updateBullets(dt) {
    const p = this.player;
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.ttl -= dt;
      if (b.ttl <= 0) {
        /* Fin de course : la goutte acheve de se diffuser et laisse sa
           charge acide sur place. C'est le lien entre le tir et le pH — et
           il n'existe que pour l'acide lactique. Un depsipeptide, une
           proteine et un alcool sont neutres : ils ne changent pas le pH,
           donc ces souches-la ne preparent pas leur terrain. */
        const acidifie = b.tir ? b.tir.acidifie : 1;
        if (!b.hostile && acidifie > 0) {
          this.phField.acidify(b.x, b.y, this.matrix.chem.phDeposit * acidifie, b.radius * 4.5);
        }
        b.alive = false;
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      /* Une goutte d'acide lactique n'est pas une balle : ejectee bien
         formee, elle s'etale et ralentit. Elle touche donc de plus en plus
         large et de moins en moins fort, et acidifie derriere elle.

         C'est vrai de l'ACIDE. Un cristal de cereulide, thermostable et
         insoluble, ne se dilue pas du tout ; l'ethanol, lui, se disperse
         deux fois plus vite. La diffusion est donc une propriete de la
         TOXINE, pas du moteur. */
      if (!b.hostile && b.life) {
        const tir = b.tir || null;
        b.age += dt;
        const t = clamp(b.age / b.life, 0, 1);
        b.diffuse = t;
        b.radius = b.r0 * (1 + (tir ? tir.diffusion : 1.6) * t);
        const drag = Math.exp(-BULLET_DRAG * dt);
        b.vx *= drag; b.vy *= drag;
        const chem = this.matrix.chem;
        const acidifie = tir ? tir.acidifie : 1;
        if (acidifie > 0) {
          this.phField.acidify(b.x, b.y, chem.phTrail * (0.3 + t) * dt * acidifie, b.radius);
        }
      }
      if (b.zDrift) b.z -= Math.sign(b.z) * Math.min(Math.abs(b.z), b.zDrift * dt);

      if (!this.arena.contains(b.x, b.y)) { b.alive = false; continue; }

      /* Un globule gras arrete la goutte : l'acide lactique est
         hydrosoluble et ne penetre pas la phase grasse. C'est donc un abri,
         pour le joueur comme pour les mobs.

         Il ne l'est PAS pour tout le monde : la cereulide et l'ethanol sont
         lipophiles, la phase grasse est leur solvant et non leur mur. Deux
         souches traversent donc un decor qui abrite les autres, et c'est un
         vrai avantage de terrain dans le lait cru. */
      if (!b.hostile && (!b.tir || b.tir.grasArrete)
        && decorBlocksBullet(b.x, b.y, b.radius, this.decorNear)) {
        this.phField.acidify(b.x, b.y, this.matrix.chem.phDeposit * 0.5, b.radius * 3);
        this.spark(b.x, b.y, 2);
        b.alive = false;
        continue;
      }

      if (b.hostile) {
        if (Math.abs(b.z) < IN_PLANE) {
          const dx = b.x - p.x, dy = b.y - p.y;
          const rr = b.radius + p.radius;
          if (dx * dx + dy * dy < rr * rr) {
            /* CRISPR : immunite aux phages ennemis. */
            if (p.flags.has('crispr')) {
              p.crisprBonus += 0.01;
              this.spark(b.x, b.y, 3);
            } else {
              this.damagePlayer(b.dmg, null);
            }
            b.alive = false;
          }
        }
        continue;
      }

      for (const e of this.enemies) {
        if (!e.alive || e.ally > 0) continue;
        if (b.hits && b.hits.has(e.uid)) continue;
        const dx = e.x - b.x, dy = e.y - b.y;
        const rr = e.radius + b.radius;
        if (dx * dx + dy * dy > rr * rr) continue;

        const sh = this.sharpnessOf(e.z);
        /* Un injectisome traverse la profondeur : il ignore la nettete. */
        const fall = b.t3ss ? 1 : damageFalloff(sh, p.stats.focusPenalty);
        /* Hors du plan, un tir ne porte pas du tout : sinon la mise au point
           ne serait qu'un bonus, pas une mecanique. */
        if (!b.t3ss && sh <= 0.02) continue;

        /* Plus la goutte s'est diffusee, moins elle concentre. Une toxine
           qui ne se dilue pas ne perd rien : c'est ce qui fait la portee
           utile de la cereulide malgre sa cadence lente. */
        const perte = b.tir ? b.tir.perteDiffus : 0.5;
        const spent = 1 - perte * (b.diffuse || 0);
        /* Le kyste encaisse : trois quarts des degats passent a la trappe
           tant qu'il tient. */
        const blindage = (e.spec.resist ? 1 - e.spec.resist : 1) * (e.cyst > 0 ? 0.25 : 1);
        e.hp -= p.damageAgainst(e, fall * spent) * blindage;
        this.spark(b.x, b.y, 2);
        /* La goutte creve sur la cellule : elle y laisse sa charge. Sans ca,
           presque aucune goutte n'atteignait sa fin de course et le pH ne
           bougeait jamais la ou l'on se bat. */
        if (!b.hostile) {
          this.phField.acidify(b.x, b.y, this.matrix.chem.phDeposit * 0.8, b.radius * 3);
        }
        if (b.hits) b.hits.add(e.uid);

        if (b.protease) { e.dot = Math.max(e.dot, 4); e.dotTtl = 4; }
        /* Effets propres a la toxine. L'alpha-hemolysine perce un pore qui
           continue de fuir ; l'ethanol fluidifie la membrane et ralentit. */
        if (b.tir && b.tir.pore) {
          e.dot = Math.max(e.dot, b.tir.pore.dps);
          e.dotTtl = Math.max(e.dotTtl, b.tir.pore.duree);
        }
        if (b.tir && b.tir.ralentit && e.spec.mot !== 'none') {
          e.slow = Math.max(e.slow, b.tir.ralentit.part);
          e.slowTtl = Math.max(e.slowTtl, b.tir.ralentit.duree);
        }
        if (b.coagulase && this.rng() < 0.22) {
          this.zones.push(makeZone(e.x, e.y, 16, 'gel', 3, { slow: 0.45, friendly: true }));
        }

        if (b.pierce > 0) { b.pierce--; } else { b.alive = false; break; }
      }
    }
  }

  /* ------------------------------------------------------------ zones --- */

  computeZoneEffects() {
    const p = this.player;
    let slow = 1;
    for (const z of this.zones) {
      if (!z.alive || z.friendly) continue;
      const dx = z.x - p.x, dy = z.y - p.y;
      if (dx * dx + dy * dy > z.r * z.r) continue;
      if (z.slow) {
        /* La gelatinase annule toute coagulation. */
        if ((z.type === 'coagulum' || z.type === 'gel') && p.flags.has('gelatinase')) continue;
        slow = Math.min(slow, 1 - z.slow);
      }
    }
    this.playerSlowFactor = slow;
  }

  updateZones(dt) {
    const p = this.player;
    for (const z of this.zones) {
      if (!z.alive) continue;
      z.ttl -= dt;
      if (z.ttl <= 0) { z.alive = false; continue; }

      if (z.dps) {
        const dx = z.x - p.x, dy = z.y - p.y;
        if (dx * dx + dy * dy < z.r * z.r) {
          let d = z.dps * dt;
          d *= 1 - p.stats.envResist;
          if (z.type === 'llo' || z.type === 'hemolysine') d *= 1 - p.stats.rosResist * 0.5;
          this.damagePlayer(d, null, true);
        }
      }
      if (z.slow && (z.friendly || z.type === 'eps' || z.type === 'gel')) {
        for (const e of this.enemies) {
          if (!e.alive || e.spec.mot === 'none') continue;
          const dx = z.x - e.x, dy = z.y - e.y;
          if (dx * dx + dy * dy < z.r * z.r) { e.slow = z.slow; e.slowTtl = 0.2; }
        }
      }
    }
  }

  /**
   * Encombrement : les gros corps sont des OBSTACLES.
   *
   * Un organisme neutre qu'on traverse n'est pas du decor, c'est un decor
   * peint. Une cellule somatique fait dix-huit pixels et pese, a cette
   * echelle, des milliers de fois une bacterie : elle ne doit pas s'ecarter
   * poliment, elle doit bloquer.
   *
   * La separation est donc ponderee par la MASSE, prise en volume (r^3) :
   *   - le joueur contre une cellule somatique : le joueur encaisse tout ;
   *   - deux petits corps : ils se repoussent a parts egales.
   * Et on ne pousse que DANS LE PLAN : un neutre defocalise est devant ou
   * derriere, pas sur le chemin. La mise au point devient ainsi une facon
   * de choisir si un obstacle existe, ce qui est exactement la bonne
   * mecanique pour ce jeu.
   */
  resolveEncombrement() {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const structure = !!e.spec.obstacle;
      if (!structure && !e.spec.neutral) continue;
      /* Une STRUCTURE accrochee a la paroi est la quelle que soit la mise au
         point : la profondeur decide si on peut la toucher, pas si elle
         existe. Un organisme qui flotte, lui, n'encombre que dans le plan. */
      if (!structure && Math.abs(e.z) >= IN_PLANE) continue;

      const me = structure ? 1e9 : Math.pow(Math.max(e.radius, 0.5), 3);
      /* --- le joueur ---------------------------------------------------- */
      {
        const dx = p.x - e.x, dy = p.y - e.y;
        const rr = e.radius + p.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr) {
          const d = Math.sqrt(d2) || 0.001;
          const nx = dx / d, ny = dy / d;
          const chev = rr - d;
          const mp = Math.pow(p.radius, 3);
          const part = me / (me + mp);          // ce que le joueur encaisse
          p.x += nx * chev * part;
          p.y += ny * chev * part;
          e.x -= nx * chev * (1 - part);
          e.y -= ny * chev * (1 - part);
          /* On glisse le long de l'obstacle au lieu de s'y ecraser : la
             composante normale de la vitesse part, la tangentielle reste.
             Sans ca, longer une grosse cellule collait le joueur net. */
          const vn = p.vx * nx + p.vy * ny;
          if (vn < 0) { p.vx -= nx * vn * 1.6; p.vy -= ny * vn * 1.6; }
        }
      }

      /* --- les autres organismes ---------------------------------------- */
      for (const o of this.enemies) {
        if (o === e || !o.alive || o.spec.neutral || o.spec.obstacle) continue;
        if (Math.abs(o.z) >= IN_PLANE) continue;
        const dx = o.x - e.x, dy = o.y - e.y;
        const rr = e.radius + o.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.001;
        const nx = dx / d, ny = dy / d;
        const chev = rr - d;
        const mo = Math.pow(Math.max(o.radius, 0.5), 3);
        const part = me / (me + mo);
        o.x += nx * chev * part;
        o.y += ny * chev * part;
        e.x -= nx * chev * (1 - part);
        e.y -= ny * chev * (1 - part);
        const vn = o.vx * nx + o.vy * ny;
        if (vn < 0) { o.vx -= nx * vn * 1.4; o.vy -= ny * vn * 1.4; }
      }
    }
  }

  /** Trainee d'EPS. Chaque bouffee a un rayon, une duree et un decalage
   *  differents : des lobes identiques alignes se lisent comme une chaine
   *  de perles, pas comme une trainee qui se dilue. */
  dropEps(x, y) {
    const r = 8 + this.rng() * 7;
    const a = this.rng() * TAU;
    const d = this.rng() * 4;
    this.zones.push(makeZone(x + Math.cos(a) * d, y + Math.sin(a) * d, r, 'eps',
      1.8 + this.rng() * 1.6, { slow: 0.3, friendly: true }));
  }

  /* ----------------------------------------------------------- chimie --- */

  /**
   * Effets du pH local. Chaque espece porte ses propres seuils dans le
   * bestiaire, donc ajouter une matrice n'oblige pas a toucher a ce code.
   */
  applyChemistry(dt) {
    const p = this.player;
    this.ph = this.phField.at(p.x, p.y);

    /* Une bacterie lactique est chez elle dans l'acide qu'elle fabrique :
       acidifier son terrain, c'est se donner un avantage de terrain. */
    this.acidComfort = clamp((5.7 - this.ph) / 0.9, 0, 1);

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const spec = e.spec;
      if (!spec.phSlow && !spec.phBurn) continue;
      const ph = this.phField.at(e.x, e.y);
      if (spec.phSlow && ph < spec.phSlow) {
        e.slow = Math.max(e.slow, 0.25);
        e.slowTtl = Math.max(e.slowTtl, 0.15);
      }
      if (spec.phBurn && ph < spec.phBurn) e.hp -= (spec.phBurnDps || 3) * dt;
    }
  }

  /* ------------------------------------------------------------ auras --- */

  applyAuras(dt) {
    const p = this.player;
    const aura = p.stats.aura;
    if (aura.dps > 0) {
      const r2 = aura.radius * aura.radius;
      for (const e of this.enemies) {
        if (!e.alive || e.ally > 0 || e.spec.kind === 'spore') continue;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < r2) e.hp -= aura.dps * dt;
      }
    }
    if (p.flags.has('nanotubes')) {
      const rank = p.rankOf('nanotubes');
      for (const e of this.enemies) {
        if (!e.alive || e.ally > 0 || e.spec.kind === 'spore') continue;
        if (this.sharpnessOf(e.z) < 0.5) continue;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < 90 * 90) e.hp -= 1.5 * rank * dt;
      }
    }
  }

  updateAllies(dt) {
    const p = this.player;
    /* Phage tempere : lysogenie, le mob travaille pour vous un moment. */
    if (p.flags.has('temperate') && p.phageCd <= 0) {
      const t = nearestEnemy(this, p.x, p.y, 150, null);
      if (t) {
        t.ally = 8;
        p.phageCd = 14;
        this.spark(t.x, t.y, 6);
      }
    }
    /* Conjugaison : transfert du plasmide F, allie definitif. */
    if (p.flags.has('conjugaison') && p.conjugationCd <= 0) {
      const t = nearestEnemy(this, p.x, p.y, 170, null);
      if (t) {
        t.ally = 1e9;
        p.conjugationCd = 30;
        this.announce('CONJUGAISON');
      }
    }
  }

  /* ------------------------------------------------------------ degats -- */

  damagePlayer(amount, source, environmental = false) {
    const p = this.player;
    if (p.invuln > 0 || p.phagocytosedBy) return;
    let d = amount * (1 - p.stats.resist);
    if (environmental) d *= 1 - p.stats.envResist;
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, d);
      p.shield -= absorbed;
      d -= absorbed;
    }
    if (d <= 0) return;
    p.hp -= d;
    this.flash = Math.min(1, this.flash + d / 60);
    this.shake = Math.min(1, this.shake + d / 90);
  }

  applyPlayerDot(dps, seconds) {
    this.player.dot = Math.max(this.player.dot, dps);
    this.player.dotTtl = Math.max(this.player.dotTtl, seconds);
  }

  /** Predation periplasmique : absorbe les mobs nettement plus petits. */
  tryPredation(e) {
    const p = this.player;
    if (!p.flags.has('predation')) return false;
    if (e.spec.boss) return false;
    if (e.radius > p.radius * 0.6) return false;
    e.hp = 0;
    p.hp = Math.min(p.stats.maxHp, p.hp + 3 * p.rankOf('predation'));
    this.killEnemy(e, true);
    return true;
  }

  /**
   * RECYCLAGE : un mob distance ne disparait pas, il revient DEVANT.
   *
   * Le defaut corrige : dans une goutte sans obstacle, la bonne reponse a
   * n'importe quelle vague etait de partir en ligne droite. On gagnait a
   * tous les coups, la poursuite ne se terminait jamais, et le budget de
   * menace devenait un chiffre sans effet puisque la menace restait derriere.
   *
   * Ce n'est pas une apparition : le budget ne bouge pas, c'est le MEME
   * individu qu'on repose ailleurs. Et ce n'est pas non plus une invention —
   * le champ contient des millions de cellules dont on n'en dessine que
   * quelques dizaines ; celles qu'on distance sont remplacees, dans la
   * fiction, par d'autres du meme clone deja en avant. C'est un
   * echantillonnage, pas une teleportation.
   *
   * Trois exclusions, et chacune protege quelque chose :
   *   le BOSS        on doit pouvoir le semer, c'est une option tactique ;
   *   les NEUTRES    ils sont le decor vivant, pas la menace ;
   *   les SESSILES   une plaque de biofilm ou une spore posee EST du terrain,
   *                  et la voir reapparaitre devant soi detruirait la seule
   *                  chose que le decor apporte.
   */
  recyclerLoin() {
    if (!this.recyclage) return;
    const p = this.player;
    /* Le cap de fuite : la vitesse du joueur, ou son orientation s'il est a
       l'arret — sinon un joueur immobile verrait les mobs revenir dans une
       direction arbitraire, ce qui se lit comme un bug. */
    let dx = p.vx, dy = p.vy;
    const v = Math.hypot(dx, dy);
    if (v < 8) { dx = Math.cos(p.ang); dy = Math.sin(p.ang); }
    else { dx /= v; dy /= v; }
    const cap = Math.atan2(dy, dx);

    for (const e of this.enemies) {
      if (!e.alive || e.ally > 0) continue;
      if (e.spec.boss || e.spec.neutral || !e.speed) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < OUBLI) continue;

      /* Devant, mais pas pile devant : un cone de +/-55 degres. Pile sur le
         cap, les mobs recycles arrivaient en file indienne et se lisaient
         comme un tir de barrage. */
      let pose = null;
      for (let i = 0; i < 8 && !pose; i++) {
        const a = cap + (this.rng() * 2 - 1) * 0.96;
        const d = RECYCLE_MIN + this.rng() * (RECYCLE_MAX - RECYCLE_MIN);
        const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
        if (this.arena.contains(x, y, 6)) pose = { x, y };
      }
      /* Dans un couloir, le cone peut tomber entierement dans la paroi :
         on retombe alors sur l'apparition ordinaire plutot que de renoncer,
         sinon le recyclage ne marcherait pas la ou il sert le plus. */
      if (!pose) pose = this.arena.spawnNear(this.rng, p.x, p.y, RECYCLE_MIN, RECYCLE_MAX);
      e.x = pose.x; e.y = pose.y;
      e.vx = 0; e.vy = 0;
      /* Il revient HORS DU PLAN, comme une apparition : la mise au point
         reste le telegraphe, et un mob qui se materialise net a portee de
         contact n'est pas une menace, c'est une gifle. */
      e.z = (this.rng() < 0.5 ? -1 : 1) * (0.55 + this.rng() * 0.45);
      this.recycles = (this.recycles || 0) + 1;
    }
  }

  killEnemy(e, silent = false) {
    if (!e.alive) return;
    e.alive = false;
    const p = this.player;
    p.kills++;

    if (p.flags.has('sidero')) {
      p.sideroStacks = Math.min(10, p.sideroStacks + 1);
      p.sideroTtl = 8;
    }

    if (!silent) this.lyse(e);

    /* Butin : acides amines liberes par la lyse. Les bacteries lactiques
       sont auxotrophes pour la plupart d'entre eux : c'est litteralement
       ce dont elles ont besoin pour croitre.

       Ils PARTENT AVEC L'EXPLOSION : leur vitesse initiale est celle de la
       gerbe. Un butin qui tombe sur place trahit l'idee meme de lyse. */
    /* SCORE. Il pese la MENACE abattue et non le nombre de tetes : un tank a
       3,2 credits vaut trois fois un coccus a 1,0, ce qui est exactement le
       rapport que le directeur paie pour les poser. Le facteur (1 + p) dit
       le reste — le meme mob a la douzieme minute porte trois fois les PV
       qu'il avait a la premiere, le tuer vaut davantage.
       `kills` reste affiche a cote : les deux ne disent pas la meme chose,
       et un joueur qui farme du coccus doit pouvoir le voir. */
    this.score += Math.round(e.spec.cost * 10 * (1 + this.progress)
      * (e.spec.boss ? 5 : 1) * (e.elite ? 2 : 1));

    const n = Math.max(1, Math.round(e.spec.aa * (e.aaBonus || 1) * aaScale(this.progress)));
    const parts = Math.min(n, 6);
    for (let i = 0; i < parts; i++) {
      const a = this.rng() * TAU;
      const d = this.rng() * 6;
      const sp = silent ? 0 : (25 + this.rng() * 65) * (e.spec.boss ? 1.8 : 1);
      this.pickups.push(makePickup(
        e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 0, n / parts, 'aa',
        Math.cos(a) * sp, Math.sin(a) * sp,
      ));
    }
    /* Le porteur lache son plasmide exactement comme un boss : c'est le meme
       butin, et c'est voulu — ce qu'on gagne a rester vaut ce qu'on gagne a
       survivre a un boss, sinon rester ne se decide pas. */
    if (e.spec.dropsPlasmid || e.elite) {
      this.pickups.push(makePickup(e.x, e.y, 0, 0, 'plasmid'));
    }

    /* Capacites a la mort, cote mob. Bornees par la generation ET par un
       plafond global : une chaine de divisions doit s'eteindre, jamais
       diverger. */
    const room = this.enemies.length < MAX_ENEMIES;
    if (e.spec.ability === 'bourgeonnement' && e.gen < 1 && room) {
      for (let i = 0; i < 2; i++) {
        const a = this.rng() * TAU;
        const child = this.spawnSpecific(e.spec.id,
          e.x + Math.cos(a) * 9, e.y + Math.sin(a) * 9, 0, 0.35, true);
        if (child) child.gen = e.gen + 1;
      }
    }
    if (e.spec.ability === 'sporulation' && e.gen < 1 && room) {
      const spore = this.spawnSpecific('spore', e.x, e.y, 0, 1);
      if (spore) spore.gen = e.gen;
    }

    /* Capacites a la mort, cote joueur. */
    if (p.flags.has('lytique')) {
      const count = 6;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU + this.rng();
        const b = makeBullet(e.x, e.y, 0, Math.cos(a) * 150, Math.sin(a) * 150,
          0, 1.8, 0, 'player', {});
        b.hits = new Set();
        b.ttl = 0.9;
        this.bullets.push(b);
      }
    }
    if (p.flags.has('crispr') && e.spec.kind === 'phage') p.crisprBonus += 0.01;

    /* Holine : la cellule lysee projette son contenu. Payant en foule,
       puisque chaque mort peut en declencher une autre. */
    if (p.flags.has('holine') && this.rng() < 0.18 * p.rankOf('holine')) {
      const foe = nearestEnemy(this, e.x, e.y, 120, e);
      const a = foe ? Math.atan2(foe.y - e.y, foe.x - e.x) : this.rng() * TAU;
      const b = makeBullet(e.x, e.y, 0, Math.cos(a) * 140, Math.sin(a) * 140,
        0, 2.4, 0, 'player', {});
      b.hits = new Set();
      b.life = 0.85; b.ttl = 0.85; b.r0 = 2.4; b.age = 0;
      this.bullets.push(b);
    }
  }

  /**
   * Fin de partie — ou pas.
   *
   * Trois filets peuvent se declencher, dans cet ordre : la dormance VBNC
   * (une evolution, donc accessible a tous), puis la CARACTERISTIQUE UNIQUE
   * de la souche. L'ordre compte : le VBNC est a usage unique et gratuit, la
   * spore coute un credit et le bourgeonnement coute la moitie du genome. On
   * depense donc toujours le moins cher d'abord.
   */
  onPlayerDeath() {
    const p = this.player;
    /* Dormance VBNC : une bacterie lactique ne sporule pas, mais elle sait
       passer en etat viable non cultivable et repartir. */
    if (p.flags.has('vbnc') && !p.dormancyUsed) {
      p.dormancyUsed = true;
      p.hp = p.stats.maxHp * 0.4;
      p.invuln = 6;
      this.announce('REPRISE VBNC');
      return;
    }
    /* B. cereus : le sporange se lyse en liberant la spore. La cellule
       disparait vraiment — ce qui reste a l'ecran est la spore. */
    if (p.trait === 'sporulation' && p.sporuler()) {
      this.lyseJoueur();
      this.announce(p.spores > 0 ? `SPORULATION — ${p.spores} EN RESERVE` : 'DERNIERE SPORE');
      return;
    }
    /* S. cerevisiae : la fille prend la place de la mere, qui se lyse. */
    if (p.trait === 'bourgeonnement') {
      const perdues = p.diviser();
      if (perdues !== false) {
        this.lyseJoueur();
        this.announce(perdues > 0 ? `DIVISION — ${perdues} RANGS PERDUS` : 'DIVISION');
        return;
      }
    }
    this.state = STATE.DEAD;
  }

  /**
   * Lyse de la cellule du joueur.
   *
   * Meme grammaire que la lyse d'un mob — anneau, fragments de paroi,
   * gouttelettes — mais marquee `joueur` pour que le rendu y mette la
   * couleur de la souche. Sans ces particules, sporuler ou bourgeonner se
   * voyait seulement dans le HUD, et l'evenement le plus important de la
   * partie passait inapercu.
   */
  lyseJoueur() {
    const p = this.player;
    const r = p.radius;
    const P = this.particles;
    P.push({
      kind: 'ring', x: p.x, y: p.y, vx: 0, vy: 0,
      r: r * 0.6, r1: r * 4.2, spec: null, joueur: true,
      ttl: 0.34, maxTtl: 0.34, alive: true,
    });
    const shards = Math.round(5 + r * 1.2);
    for (let i = 0; i < shards; i++) {
      const a = this.rng() * TAU;
      const sp = 40 + this.rng() * 120;
      P.push({
        kind: 'shard', x: p.x, y: p.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 0.9 + this.rng() * (0.8 + r * 0.12), ang: a,
        spin: (this.rng() - 0.5) * 16, drag: 0.90, spec: null, joueur: true,
        ttl: 0.35 + this.rng() * 0.5, maxTtl: 0.85, alive: true,
      });
    }
    this.shake = Math.min(1, this.shake + 0.7);
    this.flash = Math.min(1, this.flash + 0.5);
  }

  /* ---------------------------------------------------------- ramassage - */

  updatePickups(dt) {
    const p = this.player;
    const r = p.stats.pickup;
    for (const k of this.pickups) {
      if (!k.alive) continue;
      k.ttl -= dt;
      k.phase += dt * 3;
      if (k.ttl <= 0) { k.alive = false; continue; }

      /* Derive : l'elan de la gerbe s'amortit, puis le courant du milieu
         prend le relais, avec un peu d'agitation brownienne. Rien ne reste
         pose sur place dans un bouillon. */
      k.x += k.vx * dt; k.y += k.vy * dt;
      const fr = Math.exp(-2.6 * dt);
      k.vx *= fr; k.vy *= fr;
      const cur = convection(this.time);
      k.x += (cur.x - (k.cx || 0)) * 0.04;
      k.y += (cur.y - (k.cy || 0)) * 0.04;
      k.cx = cur.x; k.cy = cur.y;
      k.x += (this.rng() * 2 - 1) * 5 * dt;
      k.y += (this.rng() * 2 - 1) * 5 * dt;

      const dx = p.x - k.x, dy = p.y - k.y;
      const d = Math.hypot(dx, dy);
      if (d < r) {
        /* Chimiotactisme : on remonte le gradient vers les peptides. */
        const pull = (200 * (1 - d / r) + 50) * p.stats.pull;
        k.x += (dx / (d || 1)) * pull * dt;
        k.y += (dy / (d || 1)) * pull * dt;
      }
      if (d < p.radius + 3) {
        k.alive = false;
        if (k.kind === 'plasmid') {
          this.grantPlasmid();
        } else {
          const levels = p.gainAa(k.amount);
          if (levels > 0) {
            this.pendingLevels += levels;
            this.openLevelUp();
          }
        }
      }
    }
  }

  /** Un plasmide court-circuite le niveau : competence immediate, rare ou mieux. */
  grantPlasmid() {
    const hand = this.player.draw('rare');
    if (!hand.length) return;
    this.player.take(hand[0].id);
    this.announce(`PLASMIDE : ${hand[0].label.toUpperCase()}`);
  }

  openLevelUp() {
    if (this.state !== STATE.PLAYING) return;
    this.hand = this.player.draw();
    if (!this.hand.length) { this.pendingLevels = 0; return; }
    this.state = STATE.LEVELUP;
  }

  chooseEvolution(id) {
    if (this.state !== STATE.LEVELUP) return;
    this.player.take(id);
    this.pendingLevels--;
    this.hand = null;
    this.state = STATE.PLAYING;
    if (this.pendingLevels > 0) this.openLevelUp();
  }

  /** Transposon : une relance par niveau. */
  reroll() {
    if (this.state !== STATE.LEVELUP) return false;
    if (!this.player.flags.has('transposon') || this.player.rerollUsed) return false;
    this.player.rerollUsed = true;
    this.hand = this.player.draw();
    return true;
  }

  /** Hypermutateur : derive d'une stat au hasard, dans les deux sens. */
  hypermutate() {
    const keys = ['dmg', 'speed', 'fireRate', 'maxHp', 'bulletSpeed', 'pickup'];
    const k = keys[Math.floor(this.rng() * keys.length)];
    const up = this.rng() < 0.5;
    this.player.stats[k] *= up ? 1.1 : 0.9;
    this.announce(`MUTATION ${up ? '+' : '-'}`);
  }

  /* ------------------------------------------------------------ divers -- */

  hasRoom() { return this.enemies.length < MAX_ENEMIES; }

  spawnSpecific(id, x, y, z, scaleMul = 1, weak = false) {
    const spec = BESTIARY[id];
    if (!spec) return null;
    const s = this.scale;
    const e = makeEnemy(spec, x, y, z, {
      hp: s.hp * (weak ? 0.35 : scaleMul === 1 ? 1 : scaleMul),
      dmg: s.dmg, speed: s.speed,
    });
    this.enemies.push(e);
    return e;
  }

  /** La listeriolysine O detruit les globules gras : plus d'abris. */
  clearDecor(x, y, radius) {
    this.pendingDecorClear = { x, y, radius };
  }

  spark(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * TAU, s = 20 + this.rng() * 60;
      this.particles.push({
        kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: 0.9, drag: 0.92, ttl: 0.25 + this.rng() * 0.3, maxTtl: 0.55,
        spec: null, alive: true,
      });
    }
  }

  /**
   * Lyse d'une cellule. Trois couches, et c'est leur superposition qui rend
   * la mort lisible sans la rendre grandiloquente :
   *   - une onde de choc breve, qui donne le coup ;
   *   - des fragments de PAROI, allonges et tournoyants, qui portent la
   *     couleur de l'espece et disent QUI vient de mourir ;
   *   - des gouttelettes de cytoplasme, plus rapides et plus nombreuses.
   * Tout est dimensionne sur le rayon du mob : un coque fait un petit
   * nuage, un boss fait un evenement.
   */
  lyse(e) {
    const r = e.radius;
    const big = e.spec.boss ? 2.3 : 1;
    const P = this.particles;

    P.push({
      kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0,
      r: r * 0.6, r1: r * 3.0 * big, spec: e.spec,
      ttl: 0.26 * big, maxTtl: 0.26 * big, alive: true,
    });

    const shards = Math.round((3 + r * 0.8) * big);
    for (let i = 0; i < shards; i++) {
      const a = this.rng() * TAU;
      const sp = (30 + this.rng() * 90) * big;
      P.push({
        kind: 'shard', x: e.x, y: e.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 0.9 + this.rng() * (0.7 + r * 0.12), ang: a,
        spin: (this.rng() - 0.5) * 16, drag: 0.90, spec: e.spec,
        ttl: 0.30 + this.rng() * 0.45 * big, maxTtl: 0.75 * big, alive: true,
      });
    }

    const dots = Math.round((5 + r * 1.5) * big);
    for (let i = 0; i < dots; i++) {
      const a = this.rng() * TAU;
      const sp = (50 + this.rng() * 150) * big;
      P.push({
        kind: 'dot', x: e.x, y: e.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 0.7 + this.rng() * 0.8, drag: 0.88, spec: null,
        ttl: 0.18 + this.rng() * 0.32, maxTtl: 0.5, alive: true,
      });
    }

    if (e.spec.boss) this.shake = Math.min(1, this.shake + 0.8);
  }

  updateParticles(dt) {
    for (const q of this.particles) {
      if (!q.alive) continue;
      q.ttl -= dt;
      if (q.ttl <= 0) { q.alive = false; continue; }
      if (q.kind === 'ring') continue;      // l'anneau ne fait que grandir
      q.x += q.vx * dt; q.y += q.vy * dt;
      const k = q.drag ?? 0.92;
      q.vx *= k; q.vy *= k;
      if (q.spin) q.ang += q.spin * dt;
    }
  }

  start() {
    this.reset();
    this.state = STATE.PLAYING;
  }
}

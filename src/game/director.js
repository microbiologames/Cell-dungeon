/* ---------------------------------------------------------------------------
   Directeur de vagues. Il maintient une POPULATION de credits de menace
   presente dans le champ (pas un debit) et remplace les morts.
   Constantes et invariants : docs/04-vagues-equilibrage.md, verifies par
   tools/balance-sim.mjs.
--------------------------------------------------------------------------- */

import {
  threatBudget, hpScale, dmgScale, speedScale, TIER_WEIGHTS, ROLE_CAPS, tierAt,
} from '../data/matrices.js';
import { weightedPick, TAU, clamp } from '../core/util.js';
import { makeEnemy } from './entities.js';

export class Director {
  constructor(game) {
    this.game = game;
    this.matrix = game.matrix;
    this.spawnAcc = 0;
    this.lullUntil = -1;
    this.lullFactor = 1;
    this.fired = new Set();
    this.bossActive = false;
    this.announcedTier = -1;
  }

  get p() { return clamp(this.game.time / this.matrix.duration, 0, 1); }

  scale() {
    const p = this.p;
    return { hp: hpScale(p), dmg: dmgScale(p), speed: speedScale(p) };
  }

  /** Credits de menace actuellement vivants. */
  liveCredits() {
    let c = 0;
    for (const e of this.game.enemies) {
      if (e.alive && e.ally <= 0 && !e.spec.boss && !e.spec.neutral) c += e.spec.cost;
    }
    return c;
  }

  update(dt) {
    const g = this.game;
    const t = g.time;
    const p = this.p;

    for (const ev of this.matrix.events) {
      if (t >= ev.t && !this.fired.has(ev)) {
        this.fired.add(ev);
        this.runEvent(ev);
      }
    }

    if (t < this.lullUntil) {
      /* Accalmie : le contraste porte l'intensite, pas le niveau absolu. */
    } else {
      this.lullFactor = 1;
    }

    const tier = tierAt(p);
    if (tier !== this.announcedTier) {
      this.announcedTier = tier;
    }

    this.keepAmbient();

    const target = this.targetCredits();
    const deficit = target - this.liveCredits();
    if (deficit <= 0) return;

    /* Le remplissage est progressif : jamais une vague qui tombe d'un coup. */
    this.spawnAcc += dt * (4 + 10 * p);
    while (this.spawnAcc >= 1 && this.liveCredits() < target) {
      this.spawnAcc -= 1;
      if (!this.spawnOne(tier)) break;
    }
  }

  /** Entretient la faune neutre : elle donne au champ sa vie et sa
   *  profondeur, et ne compte pas dans le budget de menace. */
  keepAmbient() {
    const g = this.game;
    const pool = this.matrix.neutrals;
    if (!pool || !pool.length) return;
    let n = 0;
    for (const e of g.enemies) if (e.alive && e.spec.neutral) n++;
    if (n >= (this.matrix.ambient || 0)) return;
    const spec = pool[Math.floor(g.rng() * pool.length)];
    const q = g.arena.spawnNear(g.rng, g.player.x, g.player.y, 120, 280);
    const e = makeEnemy(spec, q.x, q.y, (g.rng() * 2 - 1) * 0.85, this.scale());
    e.zPhase = g.rng() * TAU;
    g.enemies.push(e);
  }

  /** Population de menace VISEE a cet instant.
   *
   *  Expose parce que la matrice peut engendrer en dehors du directeur : une
   *  plaque de biofilm emet indefiniment, et sans ce garde-fou elle double la
   *  population sans que personne ne l'ait decide. Toute source d'ennemis
   *  doit interroger le meme budget, sinon il ne veut plus rien dire. */
  targetCredits() {
    /* Pendant un boss, la pietaille est reduite au quart. */
    const bossFactor = this.bossActive ? 0.25 : 1;
    /* Un couloir concentre : a budget egal, la pression au metre carre visible
       y est bien plus forte que dans une goutte. Le facteur est une propriete
       de la FORME de l'arene, pas un reglage de difficulte. */
    const forme = this.matrix.budgetScale ?? 1;
    return threatBudget(this.p) * this.lullFactor * bossFactor * forme;
  }

  /** Reste-t-il de la place dans le budget de menace ? */
  hasBudget() { return this.liveCredits() < this.targetCredits(); }

  /** Nombre de mobs vivants pour un role donne. */
  countRole(role) {
    let n = 0;
    for (const e of this.game.enemies) {
      if (e.alive && e.ally <= 0 && e.spec.role === role) n++;
    }
    return n;
  }

  spawnOne(tier) {
    const g = this.game;
    const weights = TIER_WEIGHTS[tier];
    const unlocks = this.matrix.unlocks;

    const candidates = [];
    for (const spec of this.matrix.pool) {
      const role = spec.role;
      const w = weights[role];
      if (!w) continue;
      if (unlocks[role] !== undefined && g.time < unlocks[role]) continue;
      const cap = (this.matrix.roleCaps || ROLE_CAPS)[role];
      if (cap !== undefined && this.countRole(role) >= cap) continue;
      /* Les spores ne s'achetent pas : elles naissent d'un Bacillus. */
      if (spec.cost === 0) continue;
      candidates.push({ spec, w });
    }
    if (!candidates.length) return false;

    const pick = weightedPick(g.rng, candidates);
    if (!pick) return false;
    this.spawnAt(pick.spec);
    return true;
  }

  /** Apparition hors du plan focal, pour que la mise au point serve de
   *  telegraphe : le joueur voit la vague se former avant qu'elle n'existe. */
  spawnAt(spec) {
    const g = this.game;
    /* Deux contraintes a la fois :
         - dans le champ visible (rayon ~124 px), sinon la mise au point ne
           telegraphie plus rien ;
         - a portee d'engagement, sinon les especes IMMOBILES apparaissent
           trop loin et n'arrivent jamais : mesure a 125-140 px du joueur
           pour une portee de 96, le joueur ne tirait plus du tout. */
    const { x, y } = g.arena.spawnNear(g.rng, g.player.x, g.player.y, 54, 124);

    const sign = g.rng() < 0.5 ? -1 : 1;
    const z = spec.zHold !== undefined
      ? spec.zHold * sign
      : sign * (0.55 + g.rng() * 0.45);
    g.enemies.push(makeEnemy(spec, x, y, z, this.scale()));
  }

  runEvent(ev) {
    const g = this.game;
    switch (ev.type) {
      case 'lull':
        this.lullUntil = g.time + ev.dur;
        this.lullFactor = ev.budget ?? 0.1;
        g.announce('ACCALMIE');
        break;
      case 'boss': {
        const spec = this.matrix.bosses[ev.id];
        if (!spec) break;
        this.bossActive = true;
        /* Dans le champ visible (rayon 104 px) : a 130 px on ne voyait
           que la barre de vie du boss depasser du bord. */
        const q = g.arena.spawnNear(g.rng, g.player.x, g.player.y, 80, 92);
        const e = makeEnemy(spec, q.x, q.y, 0.8, this.scale());
        e.isBoss = true;
        g.enemies.push(e);
        g.boss = e;
        g.announce(spec.label);
        break;
      }
      case 'sporewave':
        g.announce('SPORULATION');
        for (let i = 0; i < 6; i++) {
          const q = g.arena.spawnNear(g.rng, g.player.x, g.player.y, 130, 150);
          g.spawnSpecific('bacillus', q.x, q.y, 0.7, 1);
        }
        break;
      default:
        break;
    }
  }
}

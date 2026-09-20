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

    /* Pendant un boss, la piétaille est reduite au quart. */
    const bossFactor = this.bossActive ? 0.25 : 1;
    const target = threatBudget(p) * this.lullFactor * bossFactor;
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
    const a = g.rng() * TAU;
    const d = 120 + g.rng() * 160;
    const e = makeEnemy(spec, g.player.x + Math.cos(a) * d, g.player.y + Math.sin(a) * d,
      (g.rng() * 2 - 1) * 0.85, this.scale());
    e.zPhase = g.rng() * TAU;
    g.enemies.push(e);
  }

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
      const cap = ROLE_CAPS[role];
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
    const a = g.rng() * TAU;
    /* Deux contraintes a la fois :
         - dans le champ visible (rayon ~124 px), sinon la mise au point ne
           telegraphie plus rien ;
         - a portee d'engagement, sinon les especes IMMOBILES apparaissent
           trop loin et n'arrivent jamais : mesure a 125-140 px du joueur
           pour une portee de 96, le joueur ne tirait plus du tout. */
    const d = 54 + g.rng() * 70;
    let x = g.player.x + Math.cos(a) * d;
    let y = g.player.y + Math.sin(a) * d;
    const R = this.matrix.arenaRadius;
    const dist = Math.hypot(x, y);
    if (dist > R) { const k = (R - 8) / dist; x *= k; y *= k; }

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
        const a = g.rng() * TAU;
        /* Dans le champ visible (rayon 104 px) : a 130 px on ne voyait
           que la barre de vie du boss depasser du bord. */
        const e = makeEnemy(spec, g.player.x + Math.cos(a) * 86,
          g.player.y + Math.sin(a) * 86, 0.8, this.scale());
        e.isBoss = true;
        g.enemies.push(e);
        g.boss = e;
        g.announce(spec.label);
        break;
      }
      case 'sporewave':
        g.announce('SPORULATION');
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          g.spawnSpecific('bacillus', g.player.x + Math.cos(a) * 140,
            g.player.y + Math.sin(a) * 140, 0.7, 1);
        }
        break;
      default:
        break;
    }
  }
}

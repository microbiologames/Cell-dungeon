/* ---------------------------------------------------------------------------
   Orchestration : etat, boucle de simulation, regles.
--------------------------------------------------------------------------- */

import { clamp, mulberry32, TAU } from '../core/util.js';
import { MATRICES } from '../data/matrices.js';
import { BESTIARY } from '../data/bestiary.js';
import { Player } from './player.js';
import { Director } from './director.js';
import {
  makeEnemy, makeBullet, makePickup, makeZone, updateEnemy, pickTarget,
  sharpness, damageFalloff, compact, IN_PLANE, nearestEnemy,
} from './entities.js';

export const STATE = {
  MENU: 'menu', PLAYING: 'playing', LEVELUP: 'levelup',
  PAUSED: 'paused', DEAD: 'dead', WON: 'won',
};

export class Game {
  constructor(matrixId = 'milk', seed = Date.now()) {
    this.matrix = MATRICES[matrixId];
    this.rng = mulberry32(seed >>> 0);
    this.seed = seed >>> 0;
    this.reset();
  }

  reset() {
    this.time = 0;
    this.state = STATE.MENU;
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.zones = [];
    this.particles = [];
    this.removedDecor = new Set();
    this.player = new Player(this);
    this.director = new Director(this);
    this.focus = 0;
    this.focusVel = 0;
    this.boss = null;
    this.banner = null;
    this.bannerTtl = 0;
    this.hand = null;
    this.pendingLevels = 0;
    this.ph = this.matrix.chem.phStart;
    this.shots = 0;
    this.sharpEnemyCount = 0;
    this.playerSlowFactor = 1;
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
    /* Inertie douce : la molette d'un microscope a du repondant. */
    this.focusVel += axis * 2.6 * dt;
    this.focusVel *= Math.exp(-7 * dt);
    this.focus = clamp(this.focus + this.focusVel * dt + impulse, -1.1, 1.1);
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

    this.computeZoneEffects();
    this.player.update(dt, input.move, this);

    this.director.update(dt);

    for (const e of this.enemies) if (e.alive) updateEnemy(e, dt, this);

    this.updateBullets(dt);
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
      b.hits = new Set();
      this.bullets.push(b);
    }

    /* Chaque tir acidifie un peu le milieu : la matrice change au fil du run. */
    this.shots++;
    const chem = this.matrix.chem;
    this.ph = Math.max(chem.phFloor, this.ph - chem.phPerShot * n);
  }

  updateBullets(dt) {
    const p = this.player;
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.ttl -= dt;
      if (b.ttl <= 0) { b.alive = false; continue; }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.zDrift) b.z -= Math.sign(b.z) * Math.min(Math.abs(b.z), b.zDrift * dt);

      if (Math.hypot(b.x, b.y) > this.matrix.arenaRadius) { b.alive = false; continue; }

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

        e.hp -= p.damageAgainst(e, fall);
        this.spark(b.x, b.y, 2);
        if (b.hits) b.hits.add(e.uid);

        if (b.protease) { e.dot = Math.max(e.dot, 4); e.dotTtl = 4; }
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
          if (!e.alive) continue;
          const dx = z.x - e.x, dy = z.y - e.y;
          if (dx * dx + dy * dy < z.r * z.r) { e.slow = z.slow; e.slowTtl = 0.2; }
        }
      }
    }
  }

  dropEps(x, y) {
    this.zones.push(makeZone(x, y, 11, 'eps', 2.5, { slow: 0.3, friendly: true }));
  }

  /* ------------------------------------------------------------ auras --- */

  applyAuras(dt) {
    const p = this.player;
    const aura = p.stats.aura;
    if (aura.dps > 0) {
      const r2 = aura.radius * aura.radius;
      for (const e of this.enemies) {
        if (!e.alive || e.ally > 0) continue;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < r2) e.hp -= aura.dps * dt;
      }
    }
    if (p.flags.has('nanotubes')) {
      const rank = p.rankOf('nanotubes');
      for (const e of this.enemies) {
        if (!e.alive || e.ally > 0) continue;
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

  killEnemy(e, silent = false) {
    if (!e.alive) return;
    e.alive = false;
    const p = this.player;
    p.kills++;

    if (p.flags.has('sidero')) {
      p.sideroStacks = Math.min(10, p.sideroStacks + 1);
      p.sideroTtl = 8;
    }

    if (!silent) this.spark(e.x, e.y, 5);

    /* Butin : ADN libre, marque a l'orange d'acridine. */
    const n = Math.max(1, Math.round(e.spec.dna));
    for (let i = 0; i < Math.min(n, 6); i++) {
      const a = this.rng() * TAU, d = this.rng() * 8;
      this.pickups.push(makePickup(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d,
        0, n / Math.min(n, 6)));
    }
    if (e.spec.dropsPlasmid) {
      this.pickups.push(makePickup(e.x, e.y, 0, 0, 'plasmid'));
    }

    /* Capacites a la mort, cote mob. */
    if (e.spec.ability === 'bourgeonnement') {
      for (let i = 0; i < 2; i++) {
        const a = this.rng() * TAU;
        this.spawnSpecific(e.spec.id, e.x + Math.cos(a) * 9, e.y + Math.sin(a) * 9, 0, 0.35, true);
      }
    }
    if (e.spec.ability === 'sporulation') {
      this.spawnSpecific('spore', e.x, e.y, 0, 1);
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
  }

  onPlayerDeath() {
    const p = this.player;
    /* Endospore : on survit a tout, une fois. */
    if (p.flags.has('spore') && !p.sporeUsed) {
      p.sporeUsed = true;
      p.hp = p.stats.maxHp * 0.4;
      p.invuln = 6;
      this.announce('GERMINATION');
      return;
    }
    this.state = STATE.DEAD;
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
      const dx = p.x - k.x, dy = p.y - k.y;
      const d = Math.hypot(dx, dy);
      if (d < r) {
        /* Chimiotactisme : l'ADN migre le long du gradient. */
        const pull = 240 * (1 - d / r) + 60;
        k.x += (dx / (d || 1)) * pull * dt;
        k.y += (dy / (d || 1)) * pull * dt;
      }
      if (d < p.radius + 3) {
        k.alive = false;
        if (k.kind === 'plasmid') {
          this.grantPlasmid();
        } else {
          const levels = p.gainDna(k.amount);
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
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        ttl: 0.25 + this.rng() * 0.3, alive: true,
      });
    }
  }

  updateParticles(dt) {
    for (const q of this.particles) {
      if (!q.alive) continue;
      q.ttl -= dt;
      if (q.ttl <= 0) { q.alive = false; continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 0.92; q.vy *= 0.92;
    }
  }

  start() {
    this.reset();
    this.state = STATE.PLAYING;
  }
}

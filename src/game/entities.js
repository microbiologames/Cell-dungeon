/* ---------------------------------------------------------------------------
   Entites et comportements. La mise au point est ici : c'est elle qui decide
   des degats infliges, du ciblage automatique et de qui peut vous toucher.
--------------------------------------------------------------------------- */

import { clamp, TAU, hash2 } from '../core/util.js';

/* ------------------------------------------------------------- optique -- */

/** Nettete d'un objet a la profondeur z, vu avec le plan focal `focus`. */
export function sharpness(z, focus, dof) {
  const d = Math.abs(z - focus) / dof;
  return d >= 1 ? 0 : 1 - d * d;
}

/** Multiplicateur de degats : l'acide diffuse mal hors du plan focal. */
export function damageFalloff(sharp, focusPenalty) {
  const floor = 1 - 0.85 * focusPenalty;
  return floor + (1 - floor) * sharp;
}

/** Un mob ne peut toucher le joueur que s'il est dans son plan. */
export const IN_PLANE = 0.18;

/* ------------------------------------------------------------ fabrique -- */

let uid = 1;

export function makeEnemy(spec, x, y, z, scale) {
  return {
    uid: uid++, spec, x, y, z,
    vx: 0, vy: 0,
    hp: spec.hp * scale.hp, maxHp: spec.hp * scale.hp,
    speed: spec.speed * scale.speed,
    contact: spec.contact * scale.dmg,
    radius: spec.radius,
    ang: Math.random() * TAU,
    phase: Math.random() * TAU,
    heading: Math.random() * TAU,
    timer: Math.random() * 1.2,
    touchCd: 0,
    slow: 0, slowTtl: 0,
    dot: 0, dotTtl: 0,
    ally: 0,             // > 0 : converti par un phage tempere
    charge: 0,
    alive: true,
    phaseIndex: 0,
  };
}

export function makeBullet(x, y, z, vx, vy, dmg, radius, pierce, owner, flags) {
  return {
    uid: uid++, x, y, z, vx, vy, dmg, radius,
    pierce, owner, ttl: 2.2, alive: true,
    hits: null, t3ss: !!(flags && flags.t3ss),
    coagulase: !!(flags && flags.coagulase),
    protease: !!(flags && flags.protease),
    hostile: !!(flags && flags.hostile),
  };
}

export function makePickup(x, y, z, amount, kind = 'dna') {
  return { uid: uid++, x, y, z, amount, kind, alive: true, phase: Math.random() * TAU, ttl: 90 };
}

export function makeZone(x, y, r, type, ttl, opts = {}) {
  return { uid: uid++, x, y, r, type, ttl, maxTtl: ttl, alive: true, ...opts };
}

/* ---------------------------------------------------------- motilite ---- */

const SEEK = { brown: 0.55, swim: 0.85, tumble: 0.40, drift: 0.25, glide: 0.6, none: 0 };

function motility(e, dt, px, py, rng) {
  const spec = e.spec;
  const mot = spec.mot || 'brown';
  const seek = SEEK[mot] ?? 0.5;
  let dx = px - e.x, dy = py - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  dx /= dist; dy /= dist;

  e.phase += dt * 1.7;

  switch (mot) {
    case 'brown': {
      /* Amplitude en 1/sqrt(taille) : les petits objets s'agitent plus.
         C'est physiquement juste (Stokes-Einstein). */
      const amp = 34 / Math.sqrt(Math.max(spec.radius, 0.6));
      e.vx += (rng() * 2 - 1) * amp * dt;
      e.vy += (rng() * 2 - 1) * amp * dt;
      break;
    }
    case 'swim': {
      /* Nage en run and tumble : lignes droites, reorientations brusques. */
      e.timer -= dt;
      if (e.timer <= 0) {
        e.heading += (rng() - 0.5) * 2.6;
        e.timer = 0.4 + rng() * 1.3;
      }
      e.heading += Math.sin(e.phase * 1.6) * dt * 0.6;
      const hx = Math.cos(e.heading), hy = Math.sin(e.heading);
      e.vx += (hx * (1 - seek) + dx * seek) * e.speed * 5 * dt;
      e.vy += (hy * (1 - seek) + dy * seek) * e.speed * 5 * dt;
      e.ang = Math.atan2(e.vy, e.vx);
      break;
    }
    case 'tumble': {
      /* Culbute en roue : cap tire au sort par bouffees courtes. */
      e.timer -= dt;
      if (e.timer <= 0) {
        e.heading = rng() * TAU;
        e.timer = 0.16 + rng() * 0.42;
      }
      const hx = Math.cos(e.heading), hy = Math.sin(e.heading);
      e.vx += (hx * (1 - seek) + dx * seek) * e.speed * 6 * dt;
      e.vy += (hy * (1 - seek) + dy * seek) * e.speed * 6 * dt;
      e.ang += dt * 7.5;
      break;
    }
    case 'drift':
      e.vx += dx * e.speed * 2 * dt;
      e.vy += dy * e.speed * 2 * dt;
      e.ang = Math.atan2(dy, dx);
      break;
    case 'none':
      /* Ancrees : ni le courant ni les collisions ne les deplacent. */
      e.vx = 0; e.vy = 0;
      break;
    default:
      e.vx += dx * e.speed * 3 * dt;
      e.vy += dy * e.speed * 3 * dt;
  }

  if (mot === 'brown' || mot === 'drift') {
    e.vx += dx * e.speed * seek * 3 * dt;
    e.vy += dy * e.speed * seek * 3 * dt;
    if (mot === 'brown') e.ang += (rng() - 0.5) * dt * 2;
  }

  /* Frottement visqueux : a cette echelle, l'inertie n'existe pas.
     Un micro-organisme qui cesse de pousser s'arrete immediatement. */
  const drag = Math.exp(-6 * dt);
  e.vx *= drag; e.vy *= drag;

  /* Plafond de vitesse, ralentissements compris. */
  const slowK = e.slowTtl > 0 ? 1 - e.slow : 1;
  const vmax = e.speed * slowK;
  const v = Math.hypot(e.vx, e.vy);
  if (v > vmax) { e.vx = (e.vx / v) * vmax; e.vy = (e.vy / v) * vmax; }
}

/* ----------------------------------------------------- mise a jour ------ */

export function updateEnemy(e, dt, game) {
  const p = game.player;
  const spec = e.spec;

  if (e.slowTtl > 0) e.slowTtl -= dt;
  if (e.dotTtl > 0) { e.dotTtl -= dt; e.hp -= e.dot * dt; }
  if (e.touchCd > 0) e.touchCd -= dt;
  if (e.ally > 0) e.ally -= dt;

  /* Derive vers le plan du joueur : c'est le telegraphe de la vague. */
  const hold = spec.zHold;
  if (hold !== undefined) {
    e.z += (hold * Math.sign(e.z || 1) - e.z) * Math.min(1, dt * 0.6);
  } else if (spec.zSpeed) {
    e.z -= Math.sign(e.z) * Math.min(Math.abs(e.z), spec.zSpeed * dt);
  }

  /* Un allie converti prend les autres mobs pour cible. */
  let tx = p.x, ty = p.y;
  if (e.ally > 0) {
    const foe = nearestEnemy(game, e.x, e.y, 160, e);
    if (foe) { tx = foe.x; ty = foe.y; }
  }
  motility(e, dt, tx, ty, game.rng);

  e.x += e.vx * dt;
  e.y += e.vy * dt;

  /* Ménisque de la goutte : rappel elastique, on peut etre accule. */
  const d = Math.hypot(e.x, e.y);
  const R = game.matrix.arenaRadius;
  if (d > R) {
    const k = R / d;
    e.x *= k; e.y *= k;
    e.vx *= -0.3; e.vy *= -0.3;
  }

  applyAbility(e, dt, game);

  /* Contact : seulement dans le plan du joueur. */
  if (e.ally <= 0 && Math.abs(e.z) < IN_PLANE && e.touchCd <= 0) {
    const dx = e.x - p.x, dy = e.y - p.y;
    const rr = e.radius + p.radius;
    if (dx * dx + dy * dy < rr * rr) {
      if (game.tryPredation(e)) return;
      game.damagePlayer(e.contact, e);
      e.touchCd = 0.6;
      if (spec.ability === 'lipase') game.applyPlayerDot(4, 3);
    }
  }
}

function applyAbility(e, dt, game) {
  switch (e.spec.ability) {
    case 'dextrane':
      /* Trainee visqueuse : ralentit le JOUEUR, pas les mobs. */
      e.charge -= dt;
      if (e.charge <= 0 && Math.abs(e.z) < IN_PLANE) {
        /* Cadence volontairement basse : a 1,4 s d'intervalle, cinq
           Leuconostoc suffisaient a tapisser le champ entier de zones
           lentes. Injouable, et illisible. */
        e.charge = 3.4;
        game.zones.push(makeZone(e.x, e.y, 12, 'dextrane', 3, { slow: 0.35 }));
      }
      break;
    case 'injection': {
      /* Le phage tire depuis son plan : injoignable sans changer la mise au point. */
      e.charge -= dt;
      if (e.charge <= 0) {
        e.charge = 2.4;
        const dx = game.player.x - e.x, dy = game.player.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 240) {
          const b = makeBullet(e.x, e.y, e.z, (dx / d) * 95, (dy / d) * 95,
            6 * game.scale.dmg, 1.8, 0, 'enemy', { hostile: true });
          b.ttl = 4;
          /* La capside descend vers le plan du joueur en vol. */
          b.zDrift = 0.32;
          game.bullets.push(b);
        }
      }
      break;
    }
    case 'germination':
      /* Laisser une spore en vie, c'est rendre le Bacillus. */
      e.charge += dt;
      if (e.charge > 14) {
        e.alive = false;
        game.spawnSpecific('bacillus', e.x, e.y, 0, 0.6);
        game.spark(e.x, e.y, 6);
      }
      break;
    case 'hyphes':
      /* Geotrichum ne bouge pas : ses hyphes bloquent les tirs. */
      e.vx = 0; e.vy = 0;
      break;
    default:
      break;
  }

  if (e.spec.boss) updateBossPhases(e, dt, game);
}

function updateBossPhases(e, dt, game) {
  const phases = e.spec.phases || [];
  const frac = e.hp / e.maxHp;
  let idx = 0;
  for (let i = 0; i < phases.length; i++) if (frac <= phases[i].at) idx = i;
  if (idx !== e.phaseIndex) {
    e.phaseIndex = idx;
    game.announce(phases[idx].label);
  }
  e.charge -= dt;
  if (e.charge > 0) return;

  switch (phases[e.phaseIndex]?.ability) {
    case 'coagulase':
      e.charge = 4.5;
      for (let i = 0; i < 3; i++) {
        const a = game.rng() * TAU, d = 40 + game.rng() * 70;
        game.zones.push(makeZone(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 26,
          'coagulum', 6, { slow: 0.55 }));
      }
      break;
    case 'dispersion': {
      e.charge = 7;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        game.spawnSpecific('lactococcus', e.x + Math.cos(a) * 18, e.y + Math.sin(a) * 18, 0, 2.2);
      }
      break;
    }
    case 'hemolysine':
      e.charge = 4;
      game.zones.push(makeZone(e.x, e.y, 58, 'hemolysine', 1.2, { dps: 26 }));
      break;
    case 'comete':
      e.charge = 3.2;
      e.vx += Math.cos(e.ang) * e.speed * 4;
      e.vy += Math.sin(e.ang) * e.speed * 4;
      break;
    case 'llo':
      e.charge = 5;
      game.zones.push(makeZone(e.x, e.y, 74, 'llo', 2.4, { dps: 14 }));
      game.clearDecor(e.x, e.y, 120);
      break;
    default:
      e.charge = 3;
  }
}

/* ------------------------------------------------------------ ciblage --- */

export function nearestEnemy(game, x, y, range, exclude) {
  let best = null, bestD = range * range;
  for (const e of game.enemies) {
    if (!e.alive || e === exclude || e.ally > 0) continue;
    const dx = e.x - x, dy = e.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/**
 * Cible du tir automatique. Le score melange nettete et proximite :
 * bien regler la mise au point, c'est choisir sur qui on tire.
 */
export function pickTarget(game) {
  const p = game.player;
  const { stats } = p;
  let best = null, bestScore = 0;
  for (const e of game.enemies) {
    if (!e.alive || e.ally > 0) continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > stats.range) continue;
    const sh = sharpness(e.z, game.focus, stats.dof);
    /* Un injectisome traverse la profondeur : la nettete ne compte plus. */
    const sharpTerm = p.flags.has('t3ss') ? 1 : sh;
    const score = 0.62 * sharpTerm + 0.38 * (1 - dist / stats.range)
      + (e.spec.boss ? 0.25 : 0);
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

/* ------------------------------------------------------------- decor ---- */

/** Globules gras generes par hachage : densite infinie, memoire nulle. */
export function forEachDecor(matrix, cx, cy, radius, removed, fn) {
  const cell = 64;
  const x0 = Math.floor((cx - radius) / cell), x1 = Math.floor((cx + radius) / cell);
  const y0 = Math.floor((cy - radius) / cell), y1 = Math.floor((cy + radius) / cell);
  const d = matrix.decor;
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const n = 1 + Math.floor(hash2(gx, gy) * 2);
      for (let i = 0; i < n; i++) {
        const h1 = hash2(gx * 31 + i, gy * 17);
        const h2 = hash2(gx * 13, gy * 29 + i);
        const h3 = hash2(gx + i * 101, gy - i * 57);
        const key = `${gx},${gy},${i}`;
        if (removed.has(key)) continue;
        const px = gx * cell + h1 * cell;
        const py = gy * cell + h2 * cell;
        const dx = px - cx, dy = py - cy;
        if (dx * dx + dy * dy > radius * radius) continue;
        const r = d.minR + h3 * (d.maxR - d.minR);
        /* Profondeur figee : les globules peuplent toute l'epaisseur. */
        const z = (hash2(gx - i, gy + i) * 2 - 1) * 0.9;
        fn(px, py, z, r, key);
      }
    }
  }
}

export function compact(list) {
  let w = 0;
  for (let i = 0; i < list.length; i++) if (list[i].alive) list[w++] = list[i];
  list.length = w;
}

export { clamp };

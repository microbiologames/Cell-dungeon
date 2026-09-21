/* ---------------------------------------------------------------------------
   Entites et comportements. La mise au point est ici : c'est elle qui decide
   des degats infliges, du ciblage automatique et de qui peut vous toucher.
--------------------------------------------------------------------------- */

import { clamp, TAU, hash2, angDelta, girer } from '../core/util.js';
import { Sillage } from '../render/flagella.js';

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
    angCible: 0, omega: 0, trouble: 0,
    /* Memoire de cap, uniquement pour les especes qui portent un flagelle :
       inutile d'entretenir un sillage pour une spore. */
    sillage: spec.flagella ? new Sillage(22) : null,
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
    /* Generation de descendance. Sans ce compteur, les capacites qui
       engendrent (bourgeonnement, sporulation puis germination) bouclent
       sans fin : un Bacillus meurt en spore, la spore germe en Bacillus,
       qui meurt en spore. Mesure a 123 mobs pour un budget de 21. */
    gen: 0,
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

export function makePickup(x, y, z, amount, kind = 'aa', vx = 0, vy = 0) {
  return {
    uid: uid++, x, y, z, vx, vy, amount, kind,
    alive: true, phase: Math.random() * TAU, ttl: 90,
  };
}

/**
 * Zone d'effet. Elle porte des BOUFFEES : une poignee de lobes decales,
 * figes par l'identifiant de la zone. Un disque net se lit comme un cercle
 * geometrique ; des lobes qui s'etendent et se diluent se lisent comme de
 * la fumee pour l'EPS, et comme une masse irreguliere pour un gel.
 */
export function makeZone(x, y, r, type, ttl, opts = {}) {
  const z = {
    uid: uid++, x, y, r, type, ttl, maxTtl: ttl, alive: true, ...opts,
  };
  const gel = type === 'gel' || type === 'coagulum';
  const n = opts.puffCount ?? (gel ? 7 : 5);
  z.puffs = [];
  for (let i = 0; i < n; i++) {
    const h1 = hash2(z.uid * 13 + i, i * 7 + 3);
    const h2 = hash2(i * 31 + 5, z.uid * 17 + i);
    const h3 = hash2(z.uid + i * 101, i - z.uid * 3);
    const a = h1 * TAU;
    const d = (gel ? 0.10 + 0.52 * h2 : 0.12 + 0.58 * h2) * r;
    z.puffs.push({
      ox: Math.cos(a) * d, oy: Math.sin(a) * d,
      r: r * (gel ? 0.40 + 0.34 * h3 : 0.32 + 0.40 * h3),
      ph: h1 * TAU, sp: 0.5 + h2,
    });
  }
  return z;
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
      /* Nage en run and tumble : courses droites, reorientations breves. La
         culbute reste brusque — c'est elle, le mecanisme — mais le CORPS ne
         se telepote plus d'un cap a l'autre, il vire. */
      e.timer -= dt;
      if (e.timer <= 0) {
        e.heading += (rng() - 0.5) * 2.6;
        e.timer = 0.4 + rng() * 1.3;
        /* Une culbute ouvre le faisceau : c'est ce qui la rend visible. */
        e.trouble = 1;
      }
      e.heading += Math.sin(e.phase * 1.6) * dt * 0.6;
      const hx = Math.cos(e.heading), hy = Math.sin(e.heading);
      e.vx += (hx * (1 - seek) + dx * seek) * e.speed * 5 * dt;
      e.vy += (hy * (1 - seek) + dy * seek) * e.speed * 5 * dt;
      if (Math.hypot(e.vx, e.vy) > 1) e.angCible = Math.atan2(e.vy, e.vx);
      girer(e, dt, e.angCible, 0.16, 7);
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
      /* Culbute en roue : Listeria tourne reellement sur elle-meme en se
         deplacant. C'est sa signature, on la garde — simplement un peu moins
         vite depuis qu'elle porte des flagelles visibles. */
      e.ang += dt * 5.2;
      e.trouble = 1;
      break;
    }
    case 'drift':
      /* Un virion ne nage pas : il diffuse. Il s'oriente donc avec une
         paresse assumee. */
      e.vx += dx * e.speed * 2 * dt;
      e.vy += dy * e.speed * 2 * dt;
      e.angCible = Math.atan2(dy, dx);
      girer(e, dt, e.angCible, 0.5, 2.4);
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
    if (mot === 'brown') {
      /* Pas de cap a tenir : la cellule s'aligne mollement sur sa derive. */
      if (Math.hypot(e.vx, e.vy) > 2) e.angCible = Math.atan2(e.vy, e.vx);
      girer(e, dt, e.angCible + (rng() - 0.5) * 0.6, 0.55, 2.2);
    }
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

  /* Les organismes neutres vagabondent en profondeur au lieu de converger :
     ils entrent et sortent du plan net tout seuls. */
  if (spec.zWander) {
    e.zPhase = (e.zPhase || 0) + dt * 0.19;
    /* Amplitude par espece : une baleine doit rester PRESENTE. A 0,85 elle
       passe l'essentiel de son temps floue, et floue elle ressemble a une
       bulle — contresens complet dans une matrice qui en est pleine. */
    e.z = clamp(Math.sin(e.zPhase + e.uid) * (spec.zAmp ?? 0.85), -1, 1);
  }

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
  /* Enkystement : la forme de resistance est immobile et encaisse. C'est
     une vraie etape du cycle de l'amibe, pas une invulnerabilite gratuite —
     elle dure, elle se voit, et elle finit. */
  if (e.cyst > 0) {
    e.cyst -= dt;
    e.vx *= 0.02; e.vy *= 0.02;
  } else {
    motility(e, dt, tx, ty, game.rng);
  }

  e.x += e.vx * dt;
  e.y += e.vy * dt;

  /* Bord de l'arene : rappel elastique, on peut etre accule. */
  game.arena.confine(e, 0, -0.3, 1);

  /* Sillage et desordre : le flagelle suit le chemin de sa base, et le
     faisceau se recale une demi-seconde apres une culbute. */
  if (e.sillage) e.sillage.pousser(e.ang, dt);
  if (e.trouble > 0) e.trouble = Math.max(0, e.trouble * Math.exp(-dt / 0.4) - dt * 0.1);

  applyAbility(e, dt, game);

  /* Contact : seulement dans le plan du joueur, et jamais pour un neutre. */
  if (!spec.neutral && e.ally <= 0 && Math.abs(e.z) < IN_PLANE && e.touchCd <= 0) {
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
      /* Laisser une spore en vie, c'est rendre le Bacillus.
         La germination demande un milieu favorable : quand le champ est deja
         sature, la spore attend. C'est aussi le garde-fou qui empeche une
         spore achetee 0,8 credit de rendre gratuitement un tank a 3,2. */
      e.charge += dt;
      if (e.charge > 14 && game.director.hasBudget()) {
        e.alive = false;
        const born = game.spawnSpecific(e.spec.germinatesInto || 'bacillus', e.x, e.y, 0, 0.6);
        /* Le Bacillus issu d'une germination ne sporulera plus : la boucle
           s'arrete a une generation. */
        if (born) born.gen = e.gen + 1;
        game.spark(e.x, e.y, 6);
      }
      break;
    case 'hyphes':
      /* Geotrichum ne bouge pas : ses hyphes bloquent les tirs. */
      e.vx = 0; e.vy = 0;
      break;
    case 'emission': {
      /* Plaque de biofilm : elle disperse. La dispersion est la derniere
         etape reelle du cycle du biofilm, et elle est active — la plaque
         ne perd pas des cellules, elle en lache. */
      e.vx = 0; e.vy = 0;
      e.emitCd = (e.emitCd ?? 3) - dt;
      if (e.emitCd > 0) break;
      const p = game.progress;
      e.emitCd = 7.5 - 3.5 * p;
      if (Math.hypot(e.x - game.player.x, e.y - game.player.y) > 300) break;
      if (!game.hasRoom()) break;
      /* Une plaque emet DANS le budget de menace, pas a cote : sans ca, trois
         plaques doublaient la population et le budget ne voulait plus rien
         dire. Mesure : 113 mobs vivants pour un budget de 38. */
      if (!game.director.hasBudget()) break;
      const id = game.rng() < 0.62 ? 'swarmer' : 'sphingomonas';
      const a = game.rng() * TAU;
      game.spawnSpecific(id, e.x + Math.cos(a) * 12, e.y + Math.sin(a) * 12, 0.35, 1);
      break;
    }
    case 'adhesion':
      /* Sphingomonas tient la paroi : elle rampe vers le mur le plus proche
         plutot que de nager au centre. */
      e.vy += Math.sign(e.y || 1) * 12 * dt;
      break;
    case 'alginate':
      /* L'alginate est rendu par la Conduite (il fait repousser les plaques) :
         rien a simuler ici, la capacite est un ETAT, pas une action. */
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
      /* Ce que le boss disperse depend de l'espece : un staphylocoque lache
         des cocci, un biofilm lache des cellules en swarming. */
      const petit = e.spec.disperseInto || 'lactococcus';
      for (let i = 0; i < 4; i++) {
        /* Dans le budget, comme toute source d'ennemis. C'etait la derniere
           capacite de boss a y echapper : mesure a 40 credits vivants pour
           une cible de 5,6 en fin de run. */
        if (!game.hasRoom() || !game.director.hasBudget()) break;
        const a = (i / 4) * TAU;
        game.spawnSpecific(petit, e.x + Math.cos(a) * 18, e.y + Math.sin(a) * 18, 0, 2.2);
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
    case 'alginate':
      /* Le mucoide tapisse le sol d'EPS : on y ralentit, et les gouttes s'y
         perdent. C'est exactement ce que fait une souche mucA mutee. */
      e.charge = 5;
      for (let i = 0; i < 3; i++) {
        const a = game.rng() * TAU, d = 30 + game.rng() * 60;
        game.zones.push(makeZone(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 24,
          'eps', 7, { slow: 0.45 }));
      }
      break;
    case 'quorumboss':
      /* Quorum sensing las/rhl : au-dela d'un seuil de densite, la population
         passe en mode virulent. Ici, elle appelle du renfort — DANS le budget
         de menace. Sans ce garde-fou, le boss pompait une cinquantaine de
         renforts par run et faisait a lui seul 93 % des degats subis. */
      e.charge = 6;
      for (let i = 0; i < 3; i++) {
        if (!game.hasRoom() || !game.director.hasBudget()) break;
        const a = (i / 3) * TAU;
        game.spawnSpecific('aeruginosa', e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20, 0, 1.6);
      }
      break;
    case 'phagocytose':
      /* L'amibe broute : elle happe ce qui passe a portee. Le joueur s'en
         sort par l'endolysine, sinon il subit. */
      e.charge = 5.5;
      game.zones.push(makeZone(e.x, e.y, 46, 'phagocytose', 1.6, { dps: 11, slow: 0.4 }));
      break;
    case 'broutage':
      /* Elle mange le biofilm : elle se soigne sur les plaques. */
      e.charge = 3;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.015);
      e.vx += (game.player.x - e.x) * 0.4;
      e.vy += (game.player.y - e.y) * 0.4;
      break;
    case 'enkystement':
      /* Le kyste est une vraie forme de resistance : elle s'immobilise et
         encaisse, puis repart. C'est la fenetre pour la mettre a terre. */
      e.charge = 6;
      e.cyst = 2.2;
      break;
    case 'essaimage':
      e.charge = 4.2;
      for (let i = 0; i < 4; i++) {
        if (!game.hasRoom() || !game.director.hasBudget()) break;
        const a = game.rng() * TAU;
        game.spawnSpecific('swarmer', e.x + Math.cos(a) * 24, e.y + Math.sin(a) * 24, 0, 1.4);
      }
      break;
    case 'retraction':
      /* Un biofilm acidifie se retracte reellement : la masse se tasse et
         l'acide y penetre moins. Il faut le NEP pour rouvrir la fenetre. */
      e.charge = 5;
      game.zones.push(makeZone(e.x, e.y, 52, 'eps', 6, { slow: 0.5 }));
      break;
    default:
      e.charge = 3;
  }
}

/* ------------------------------------------------------------ ciblage --- */

export function nearestEnemy(game, x, y, range, exclude) {
  let best = null, bestD = range * range;
  for (const e of game.enemies) {
    if (!e.alive || e === exclude || e.ally > 0 || e.spec.neutral) continue;
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
    /* On ne mitraille pas ce qui ne nous menace pas. */
    if (!e.alive || e.ally > 0 || e.spec.neutral) continue;
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

export function compact(list) {
  let w = 0;
  for (let i = 0; i < list.length; i++) if (list[i].alive) list[w++] = list[i];
  list.length = w;
}

export { clamp };

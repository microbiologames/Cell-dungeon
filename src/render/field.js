/* ---------------------------------------------------------------------------
   Rendu du champ : fond noir, decor, organismes repartis sur huit calques de
   profondeur, halo de contraste de phase, puis composition et masque.
--------------------------------------------------------------------------- */

import { Screen, VIEW, fade32, mix32, rgba, bayer } from '../core/pixel.js';
import { clamp, TAU, hash2 } from '../core/util.js';
import { drawOrganism, drawPlayer, colorOf } from './organisms.js';
import { driveOf } from './flagella.js';
import { sharpness } from '../game/entities.js';
import { forEachDecor } from '../game/decor.js';

/** Niveau de flou (0 a 3) pour une nettete donnee. */
function blurLevelOf(sharp) {
  return clamp(Math.round((1 - sharp) * 3), 0, 3);
}

export function renderField(scr, game, pal) {
  const p = game.player;
  const shrink = p.stats.fieldShrink || 1;
  const fieldR = Math.round(VIEW.R * shrink);
  scr.setFieldRadius(fieldR);

  /* Tremblement : uniquement sur la camera, jamais sur le HUD. */
  const sh = game.shake;
  const ox = sh > 0 ? (game.rng() * 2 - 1) * sh * 2.5 : 0;
  const oy = sh > 0 ? (game.rng() * 2 - 1) * sh * 2.5 : 0;
  const camX = p.x + ox, camY = p.y + oy;
  const toX = (wx) => VIEW.CX + (wx - camX);
  const toY = (wy) => VIEW.CY + (wy - camY);

  /* Le pourtour de l'objectif est TOUJOURS noir, quel que soit le milieu :
     c'est la ou vit le HUD. beginFrame remplissait tout le tampon avec la
     couleur du milieu, ce qui passait inapercu tant qu'elle etait noire —
     avec le lait, le champ debordait sur le HUD et le rendait illisible.
     On peint donc le noir partout, puis le milieu DANS le disque. */
  scr.beginFrame(0xff000000);
  fillField(scr, fieldR, pal.bg);

  /* Le senseur de pH remplace le voile par une carte en fausses couleurs :
     on voit litteralement le terrain qu'on s'est fabrique. */
  if (p.flags.has('phsense')) drawPhMap(scr, game, fieldR, camX, camY, pal);
  else drawHaze(scr, game, pal, fieldR, camX, camY);

  /* Le courant se peint SOUS les organismes : c'est le milieu qui bouge. */
  if (game.conduite) drawCourant(scr, game, pal, fieldR, camX, camY);

  const dof = p.stats.dof;
  const margin = 24;

  /* --- decor : globules gras, a toutes les profondeurs ------------------ */
  forEachDecor(game.matrix, camX, camY, fieldR + margin, game.removedDecor, game.time,
    (it) => {
      const s = sharpness(it.z, game.focus, dof);
      const bl = blurLevelOf(s);
      scr.layer(Screen.layerFor(it.z, bl));
      /* Meme regle pour le decor : un globule hors plan s'efface. */
      const a = (pal.mode === 'bright' ? 0.14 : 0.35) + 0.5 * s;
      const sx = toX(it.x), sy = toY(it.y);
      if (it.kind === 'bubble') {
        /* Bulle d'air : anneau vif et centre vide. Elle repousse, donc elle
           doit se distinguer au premier coup d'oeil du globule qui colle. */
        scr.ring(sx, sy, it.r, 1.3, fade32(pal.shield, 0.55 * a));
        scr.ring(sx, sy, it.r * 0.45, 1, fade32(pal.shield, 0.25 * a));
      } else {
        if (bl >= 2) scr.ring(sx, sy, it.r + 1, 1.4, fade32(pal.debrisRim, 0.5 * a));
        scr.ring(sx, sy, it.r * 0.85, 1.3, fade32(pal.debrisRim, a));
        scr.disc(sx, sy, it.r * 0.5, fade32(pal.debris, a * 0.8), 0);
      }
    });

  /* --- zones : bouffees qui s'etendent et se diluent ------------------- */
  for (const z of game.zones) {
    if (!z.alive) continue;
    scr.layer(Screen.layerFor(0.01, 0));
    const reste = clamp(z.ttl / z.maxTtl, 0, 1);   // 1 = neuve, 0 = dissipee
    const age = 1 - reste;
    const gel = z.type === 'gel' || z.type === 'coagulum';
    const col = zoneColor(z, pal);
    const sx = toX(z.x), sy = toY(z.y);

    /* La fumee s'etend franchement et se dilue ; un gel prend et bouge a
       peine, mais reste grumeleux. */
    const grow = gel ? 1 + age * 0.14 : 1 + age * 1.35;
    const curl = gel ? 0 : age * 7;
    /* Sur un fond clair, une zone opaque devient de la peinture : on la
       garde nettement plus translucide que sur fond noir. */
    const clair = pal.mode === 'bright' ? 0.55 : 1;
    const dens = (gel ? 0.62 : 0.42) * clair
      * (gel ? 0.35 + 0.65 * reste : reste * reste);

    for (const puff of z.puffs) {
      const px = sx + puff.ox * grow + Math.sin(puff.ph + age * 3.2 * puff.sp) * curl;
      const py = sy + puff.oy * grow + Math.cos(puff.ph * 1.3 + age * 2.7 * puff.sp) * curl;
      softBlob(scr, px, py, puff.r * grow, col, dens, gel, clair);
    }
  }

  /* --- acides amines et plasmides ------------------------------------------------- */
  for (const k of game.pickups) {
    if (!k.alive) continue;
    scr.layer(Screen.layerFor(-0.01, 0));
    const pulse = 0.7 + 0.3 * Math.sin(k.phase);
    if (k.kind === 'plasmid') {
      /* Le plasmide est un anneau : c'est ce qu'est un plasmide. */
      scr.ring(toX(k.x), toY(k.y), 3.2, 1.4, fade32(pal.plasmid, pulse));
    } else {
      scr.disc(toX(k.x), toY(k.y), 1.4, fade32(pal.aa, pulse), 0);
      scr.plot(toX(k.x), toY(k.y), pal.aaGlow);
    }
  }

  /* --- organismes ------------------------------------------------------- */
  const phaseTrace = p.flags.has('phase');
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const sx = toX(e.x), sy = toY(e.y);
    if (sx < -margin || sy < -margin || sx > VIEW.W + margin || sy > VIEW.H + margin) continue;

    const s = sharpness(e.z, game.focus, dof);
    const bl = blurLevelOf(s);
    scr.layer(Screen.layerFor(e.z, bl));

    let [fill, rim] = colorOf(e.spec, pal);
    if (e.ally > 0) { fill = pal.ally; rim = pal.ally; }

    /* Halo de contraste de phase : un objet hors plan brille au lieu de
       s'effacer. C'est ce que fait un objet defocalise, et c'est ce qui rend
       une menace floue lisible. */
    if (bl >= 1) {
      /* En fond clair, un objet defocalise s'etale et FONCE : il n'a pas
         d'anneau. Le halo est propre au contraste de phase, donc on ne le
         trace que si le joueur a pris cette evolution. Sans ce garde, le
         halo se melait au flou et donnait des taches brunes. */
      const base = pal.mode === 'bright' ? (phaseTrace ? 0.7 : 0) : (phaseTrace ? 0.9 : 0.55);
      if (base > 0) {
        scr.ring(sx, sy, e.radius + 1.5 + bl, 1.2 + bl * 0.4,
          fade32(pal.halo, (bl / 3) * base));
      }
    }

    /* En fond clair, un objet tres defocalise se FOND dans le milieu.
       Sans ce plancher plus bas, le gain applique apres flou en faisait une
       boule sombre et opaque, plus lourde que les organismes nets. */
    const plancher = pal.mode === 'bright' ? 0.10 : 0.30;
    const alpha = phaseTrace
      ? Math.max(0.5, 0.35 + 0.65 * s)
      : plancher + (1 - plancher) * s;
    drawOrganism(scr, e.spec, sx, sy, e.radius, e.ang, e.phase,
      fade32(fill, alpha), fade32(rim, alpha),
      /* Le halo de phase suit l'opacite de l'objet : un organisme tres
         defocalise ne doit pas garder un lisere net. */
      { pal: { phase: fade32(pal.phase, alpha * 0.9) }, drive: driveOf(e) });

    /* Barre de vie des boss uniquement : le reste se lit a la forme. */
    if (e.spec.boss && e.hp < e.maxHp) {
      const w = 22, frac = clamp(e.hp / e.maxHp, 0, 1);
      scr.layer(Screen.layerFor(-0.02, 0));
      for (let i = 0; i < w; i++) {
        scr.plot(sx - w / 2 + i, sy - e.radius - 5,
          i / w < frac ? pal.damage : rgba(40, 20, 24, 200));
      }
    }
  }

  /* --- projectiles ------------------------------------------------------ */
  for (const b of game.bullets) {
    if (!b.alive) continue;
    const s = b.hostile ? sharpness(b.z, game.focus, dof) : 1;
    scr.layer(Screen.layerFor(b.hostile ? b.z : -0.03, blurLevelOf(s)));
    if (b.hostile) {
      scr.disc(toX(b.x), toY(b.y), b.radius, fade32(pal.hostile, 0.35 + 0.65 * s), 0);
    } else {
      drawAcidDrop(scr, toX(b.x), toY(b.y), b, pal);
    }
  }

  /* --- particules et lyses ---------------------------------------------- */
  scr.layer(Screen.layerFor(-0.04, 0));
  for (const q of game.particles) {
    if (!q.alive) continue;
    const vie = clamp(q.ttl / (q.maxTtl || 0.5), 0, 1);
    const sx = toX(q.x), sy = toY(q.y);

    if (q.kind === 'ring') {
      /* Onde de choc : un anneau qui s'ouvre vite et s'efface. C'est lui
         qui donne le COUP ; sans anneau, une mort n'est qu'un essaim de
         points et ne se sent pas. */
      const k = 1 - vie;
      const rr = q.r + (q.r1 - q.r) * (1 - (1 - k) * (1 - k));
      const [fill] = q.spec ? colorOf(q.spec, pal) : [pal.acid];
      scr.ring(sx, sy, rr, 1 + 1.6 * vie, fade32(fill, 0.75 * vie));
      continue;
    }

    if (q.kind === 'shard') {
      /* Fragment de paroi : allonge, il tourne. Il porte la couleur de
         l'espece, donc on voit QUI vient d'eclater. */
      const [fill, rim] = q.spec ? colorOf(q.spec, pal) : [pal.acid, pal.acidRim];
      const len = q.r * 2.2;
      scr.cap(sx, sy, len, Math.max(1, q.r * 0.8), q.ang || 0,
        fade32(fill, 0.35 + 0.65 * vie), fade32(rim, 0.35 + 0.65 * vie));
      continue;
    }

    /* Gouttelette de cytoplasme. */
    scr.disc(sx, sy, Math.max(0.5, (q.r || 0.8) * (0.4 + 0.6 * vie)),
      fade32(pal.acidRim, clamp(vie * 1.4, 0, 1)), 0);
  }

  /* --- aura et joueur --------------------------------------------------- */
  scr.layer(Screen.layerFor(-0.05, 0));
  const aura = p.stats.aura;
  if (aura.dps > 0) {
    scr.ring(toX(p.x), toY(p.y), aura.radius, 1.2,
      fade32(pal.acid, 0.18 + 0.08 * Math.sin(p.phase * 4)));
  }
  if (p.shield > 0) {
    scr.ring(toX(p.x), toY(p.y), p.radius + 3.5, 1.6,
      fade32(pal.shield, clamp(p.shield / 60, 0.2, 0.9)));
  }
  if (p.phagocytosedBy) {
    /* Englouti : on ne voit plus que la vacuole de l'hote. */
    scr.ring(toX(p.x), toY(p.y), p.radius + 5, 2, fade32(pal.hostile, 0.8));
  }
  const blink = p.invuln > 0 && Math.floor(p.phase * 12) % 2 === 0;
  if (!blink) {
    drawPlayer(scr, toX(p.x), toY(p.y), p.radius, p.ang, p.phase, pal, p.flagellation,
      { drive: p.drive, bend: p.bend });
  }

  scr.composite();

  /* L'acier et la lame de biocide passent PAR-DESSUS tout : une paroi est
     opaque, et un NEP n'est pas un objet observe mais le milieu qui change. */
  if (game.conduite) {
    drawParois(scr, game, pal, fieldR, camX, camY);
    drawNep(scr, game, pal, fieldR, camX, camY);
  }
  drawEdge(scr, game, pal, fieldR);
  if (game.flash > 0) tintField(scr, fieldR, pal.damage, game.flash * 0.35);
}

/**
 * Une goutte d'acide lactique en vol.
 *
 * Trois etats, qui racontent la dilution : la goutte part COMPACTE et
 * brillante, elle s'etire puis se SEPARE en gouttelettes de plus en plus
 * fines, et celles-ci s'ecartent et palissent jusqu'a disparaitre.
 * Les decalages derivent de l'identifiant du projectile, donc ils sont
 * stables d'une image a l'autre : pas de scintillement.
 */
function drawAcidDrop(scr, sx, sy, b, pal) {
  const t = clamp(b.diffuse || 0, 0, 1);
  const r0 = b.r0 || b.radius;

  if (t < 0.30) {
    /* Compacte : un noyau clair dans une enveloppe, elle file droit. */
    scr.disc(sx, sy, b.radius, fade32(pal.acid, 0.95), 0);
    scr.disc(sx, sy, Math.max(0.6, b.radius * 0.45), pal.acidCore, 0);
    return;
  }

  /* Direction de vol : les gouttelettes trainent derriere. */
  const sp = Math.hypot(b.vx, b.vy) || 1;
  const bx = -b.vx / sp, by = -b.vy / sp;

  const u = (t - 0.30) / 0.70;            // 0 a la separation, 1 a la dilution
  const n = u < 0.45 ? 3 : 6;
  const spread = r0 * (0.35 + 3.6 * u);
  const sub = Math.max(0.55, b.radius * (0.52 - 0.22 * u));
  const alpha = 0.92 * (1 - u * 0.82);

  for (let i = 0; i < n; i++) {
    /* Angles et distances figes par l'identifiant : stables dans le temps. */
    const h = hash2(b.uid * 31 + i, i * 17 + 3);
    const a = (i / n) * TAU + b.uid * 0.61 + u * 0.9;
    const d = spread * (0.35 + 0.65 * h);
    const px = sx + Math.cos(a) * d + bx * spread * 0.45;
    const py = sy + Math.sin(a) * d + by * spread * 0.45;
    scr.disc(px, py, sub * (0.6 + 0.4 * h), fade32(pal.acid, alpha), 0);
  }

  /* En fin de course, le halo de dilution : l'acide est encore la, mais
     trop dilue pour mordre. */
  if (u > 0.55) {
    scr.ring(sx + bx * spread * 0.45, sy + by * spread * 0.45,
      spread * 1.05, 1, fade32(pal.acidRim, 0.30 * (1 - u)));
  }
}

/**
 * Lobe diffus. Le tramage de Bayer decroit du centre vers le bord, ce qui
 * donne une frange irreguliere au lieu d'un contour net : c'est ce qui
 * distingue une bouffee d'un disque.
 */
function softBlob(scr, cx, cy, r, col, density, ferme, opacite = 1) {
  if (r < 0.6 || density <= 0.01) return;
  const R = Math.ceil(r);
  const icx = cx | 0, icy = cy | 0;
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const d = Math.sqrt(x * x + y * y) / r;
      if (d > 1) continue;
      const px = icx + x, py = icy + y;
      /* Un gel garde un bord marque ; une fumee s'effiloche. */
      const a = density * (ferme ? (d > 0.86 ? 1.15 : 0.8) : (1 - d * d));
      if (bayer(px, py) > a) continue;
      scr.plot(px, py, fade32(col, (ferme ? 0.6 : 0.5) * opacite));
    }
  }
}

function zoneColor(z, pal) {
  switch (z.type) {
    case 'coagulum':
    case 'gel': return pal.gel;
    case 'dextrane': return rgba(150, 132, 86, 255);
    case 'eps': return pal.shield;
    case 'hemolysine':
    case 'llo': return pal.damage;
    default: return pal.edge;
  }
}

/**
 * Carte des pH en fausses couleurs. Chaud = acide (votre terrain), froid =
 * pH du milieu. L'echelle se cale sur les bornes reelles du champ, donc elle
 * reste lisible meme quand tout le champ a deja ete acidifie.
 */
function drawPhMap(scr, game, fieldR, camX, camY, pal) {
  const f = game.phField;
  const [lo, hi] = f.range(camX, camY, fieldR + 20);
  const span = Math.max(0.25, hi - lo);
  scr.clip = false;
  for (let y = -fieldR; y <= fieldR; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, fieldR * fieldR - y * y)));
    for (let x = -w; x <= w; x++) {
      const px = VIEW.CX + x, py = VIEW.CY + y;
      const acid = clamp(1 - (f.atSmooth(camX + x, camY + y) - lo) / span, 0, 1);
      if (acid < 0.12) continue;
      /* Surcouche de capteur, pas repeinture du champ : tres tramee et peu
         opaque, pour qu'on continue a voir les organismes dedans. En fond
         clair l'acide ASSOMBRIT le milieu, en fond noir il l'illumine :
         sinon la carte se perd dans le fond. */
      if (bayer(px, py) > acid * 0.55) continue;
      const lumineux = pal.mode !== 'bright';
      const r = lumineux ? Math.round(120 + 120 * acid) : Math.round(168 - 58 * acid);
      const g = lumineux ? Math.round(40 + 60 * (1 - acid)) : Math.round(96 - 46 * acid);
      const b = lumineux ? Math.round(30 + 40 * (1 - acid)) : Math.round(64 - 34 * acid);
      scr.direct(px, py, rgba(r, g, b, Math.round(60 + 90 * acid)));
    }
  }
  scr.clip = true;
}

/** Peint le milieu observe a l'interieur du disque de l'objectif. */
function fillField(scr, fieldR, col) {
  for (let y = -fieldR; y <= fieldR; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, fieldR * fieldR - y * y)));
    for (let x = -w; x <= w; x++) scr.direct(VIEW.CX + x, VIEW.CY + y, col);
  }
}

/**
 * Voile de fond : un bouillon n'est jamais parfaitement vide.
 *
 * Un seuil applique a un bruit echantillonne tous les deux pixels produit une
 * GRILLE, pas des nuees : ca se lit comme une trame d'ecran. On interpole
 * donc un bruit de valeur basse frequence et on le trame avec Bayer, ce qui
 * donne un moutonnement irregulier — des micelles de caseine, pas un store.
 */
function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const tx = x - xi, ty = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const top = a + (b - a) * sx;
  const bot = c + (d - c) * sx;
  return top + (bot - top) * sy;
}

function drawHaze(scr, game, pal, fieldR, camX, camY) {
  const t = game.time * 0.35;
  const bright = pal.mode === 'bright';
  /* En fond clair le voile assombrit a peine : le lait est homogene. */
  const amp = bright ? 0.42 : 0.85;
  scr.clip = false;
  for (let y = -fieldR; y <= fieldR; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, fieldR * fieldR - y * y)));
    for (let x = -w; x <= w; x++) {
      const px = VIEW.CX + x, py = VIEW.CY + y;
      /* Deux octaves, en coordonnees MONDE : les nuees derivent avec le
         champ au lieu de coller a l'ecran. */
      const wx = (camX + x) * 0.035, wy = (camY + y) * 0.035;
      let n = valueNoise(wx + t * 0.05, wy - t * 0.03) * 0.65
            + valueNoise(wx * 2.7 - t * 0.02, wy * 2.7) * 0.35;
      n = (n - 0.42) * 2.4;
      if (n <= 0) continue;
      const a = Math.min(1, n) * amp;
      if (bayer(px, py) > a) continue;
      scr.direct(px, py, fade32(pal.haze, 0.55 + 0.45 * a));
    }
  }
  scr.clip = true;
}

/* ------------------------------------------------------------ conduite --- */

/**
 * Filets de courant, sous les organismes.
 *
 * Deux informations doivent se lire sans texte : dans quel sens ca coule, et
 * ou le courant est faible. Les filets sont donc plus longs et plus rapides
 * au centre du tube qu'a la paroi — c'est le profil laminaire lui-meme,
 * dessine. Sans etat : leur position est une fonction du temps et de leur
 * identifiant, comme tout le reste du decor.
 */
function drawCourant(scr, game, pal, fieldR, camX, camY) {
  const c = game.conduite;
  const hy = game.arena.halfY;
  const t = game.time;

  /* Nets : un filet de courant flou ne se lit pas, et le courant n'est pas
     un objet observe a une profondeur — c'est le milieu qui bouge. */
  scr.layer(Screen.layerFor(0.2, 0));
  for (let i = 0; i < 70; i++) {
    const y0 = (hash2(i, 3) * 2 - 1) * hy * 0.97;
    const v = c.flowAt(y0);
    if (v < 1) continue;
    const span = 900;
    const wx = ((hash2(i, 7) * span + t * v * 3.1) % span) - span / 2 + camX;
    const sx = VIEW.CX + (wx - camX), sy = VIEW.CY + (y0 - camY);
    if (sx < -20 || sx > VIEW.W + 20) continue;
    const len = 2 + (v / c.flow) * 7;
    const a = 0.22 + 0.42 * (v / c.flow);
    for (let k = 0; k < len; k++) scr.plot(sx - k, sy, fade32(pal.flow, a * (1 - k / len)));
  }
}

/**
 * Les parois d'acier, et l'acier lui-meme.
 *
 * Au-dela de la paroi il n'y a pas de milieu : il y a du 316L. On masque donc
 * tout ce que le champ a dessine hors du tube — sinon le decor flottait dans
 * le metal et le couloir ne se lisait plus comme un couloir.
 *
 * Les rayures sont dessinees vers l'INTERIEUR : ce sont des anfractuosites,
 * donc des abris contre le NEP, et un abri doit se voir.
 */
function drawParois(scr, game, pal, fieldR, camX, camY) {
  const hy = game.arena.halfY;
  const acier = fade32(pal.steelDim, 0.92);

  for (let y = -fieldR; y <= fieldR; y++) {
    const wy = camY + y;
    const dehors = Math.abs(wy) > hy;
    if (!dehors) continue;
    const w = Math.floor(Math.sqrt(Math.max(0, fieldR * fieldR - y * y)));
    const py = VIEW.CY + y;
    for (let x = -w; x <= w; x++) {
      const px = VIEW.CX + x;
      /* Grain du metal : un aplat parfait ne ressemble pas a de l'inox. */
      const g = hash2(Math.floor((camX + x) / 3), Math.floor(wy / 3));
      scr.direct(px, py, g > 0.88 ? fade32(pal.steel, 0.22) : acier);
    }
  }

  /* Les deux parois, leurs rayures, et le lisere de couche limite. */
  for (const s of [-1, 1]) {
    const py = Math.round(VIEW.CY + (s * hy - camY));
    if (py < -8 || py > VIEW.H + 8) continue;
    for (let x = -fieldR; x <= fieldR; x++) {
      const px = VIEW.CX + x;
      if (x * x + (py - VIEW.CY) * (py - VIEW.CY) > fieldR * fieldR) continue;
      scr.direct(px, py, pal.steel);
      const wx = camX + x;
      if (hash2(Math.floor(wx / 7), s) > 0.72) {
        const prof = 2 + Math.floor(hash2(Math.floor(wx / 7), s + 9) * 4);
        for (let k = 1; k < prof; k++) scr.direct(px, py - s * k, fade32(pal.steelDim, 0.75));
      }
    }
    /* Couche limite : au-dela, le courant est nul. Le refuge doit se voir,
       sinon le joueur ne saura jamais qu'il existe. */
    const ly = Math.round(VIEW.CY + (s * (hy - 11) - camY));
    for (let x = -fieldR; x <= fieldR; x += 3) {
      if (x * x + (ly - VIEW.CY) * (ly - VIEW.CY) > fieldR * fieldR) continue;
      scr.direct(VIEW.CX + x, ly, fade32(pal.flow, 0.22));
    }
  }
}

/**
 * Le Nettoyage En Place : telegraphe puis lame de biocide.
 *
 * La couleur dit le produit — alcalin, acide, oxydant — parce que c'est elle
 * qui dit au joueur quelle evolution va le sauver.
 */
function drawNep(scr, game, pal, fieldR, camX, camY) {
  const c = game.conduite;
  const bio = c.biocide;
  const teinte = pal.biocide[bio.couleur] || pal.textHot;
  const hy = game.arena.halfY;

  if (c.cip.etat === 'telegraphe') {
    /* Le champ vire et bat de plus en plus vite a mesure que ca approche. */
    const k = 1 - c.cip.t / 8;
    const bat = 0.5 + 0.5 * Math.sin(game.time * (5 + 16 * k));
    tintField(scr, fieldR, teinte, (0.06 + 0.16 * k) * bat);
    return;
  }
  if (c.cip.etat !== 'vague') return;

  /* La lame elle-meme, dans le tube et pas dans le metal. */
  for (let x = -fieldR; x <= fieldR; x++) {
    const k = c.intensite(camX + x);
    if (k <= 0) continue;
    const px = VIEW.CX + x;
    const w = Math.floor(Math.sqrt(Math.max(0, fieldR * fieldR - x * x)));
    for (let y = -w; y <= w; y++) {
      if (Math.abs(camY + y) > hy) continue;
      const py = VIEW.CY + y;
      if (bayer(px, py) > k * 0.85) continue;
      scr.direct(px, py, fade32(teinte, 0.30 + 0.45 * k));
    }
  }
}

/** Bord du champ : diaphragme du fond noir, plus le menisque de la goutte. */
function drawEdge(scr, game, pal, fieldR) {
  const p = game.player;
  for (let a = 0; a < TAU; a += 0.004) {
    const x = VIEW.CX + Math.cos(a) * fieldR;
    const y = VIEW.CY + Math.sin(a) * fieldR;
    scr.direct(x, y, pal.edge);
    scr.direct(VIEW.CX + Math.cos(a) * (fieldR - 1), VIEW.CY + Math.sin(a) * (fieldR - 1),
      fade32(pal.edge, 0.4));
  }
  /* Approche de la paroi : le bord s'allume du cote ou l'on est accule.
     Menisque de goutte ou acier de conduite, c'est l'arene qui repond. */
  const k = game.arena.edgeCloseness(p.x, p.y);
  if (k > 0) {
    const dir = game.arena.edgeDir(p.x, p.y);
    for (let a = -0.9; a <= 0.9; a += 0.01) {
      const x = VIEW.CX + Math.cos(dir + a) * fieldR;
      const y = VIEW.CY + Math.sin(dir + a) * fieldR;
      const f = k * (1 - Math.abs(a) / 0.9);
      scr.direct(x, y, mix32(pal.edge, pal.textHot, f));
      scr.direct(VIEW.CX + Math.cos(dir + a) * (fieldR - 1),
        VIEW.CY + Math.sin(dir + a) * (fieldR - 1), fade32(pal.textHot, f * 0.5));
    }
  }
}

function tintField(scr, fieldR, color, strength) {
  const k = clamp(strength, 0, 1);
  for (let y = -fieldR; y <= fieldR; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, fieldR * fieldR - y * y)));
    for (let x = -w; x <= w; x++) {
      const px = VIEW.CX + x, py = VIEW.CY + y;
      if (bayer(px, py) > k) continue;
      scr.direct(px, py, fade32(color, 0.5));
    }
  }
}

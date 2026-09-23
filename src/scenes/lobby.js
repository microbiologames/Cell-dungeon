/* ---------------------------------------------------------------------------
   Lobby : une boite de Petri vue au microscope.

   Le joueur y nage librement. Chaque matrice est un PUITS — un disque rempli
   de son propre milieu, ou derivent deux ou trois de ses organismes. On
   choisit son stage en nageant dedans ; il n'y a pas de menu. Un puits de
   plus mene au bestiaire.

   Le puits montre donc litteralement ce dans quoi on va tomber : c'est plus
   parlant qu'une liste, et ca reutilise tout le moteur de rendu.

   La SOUCHE se choisit de la meme facon : quatre petites colonies posees sur
   la gelose, entre les puits et la paroi. On nage dans l'une, on DEVIENT la
   cellule qu'elle contient — le nageur change de morphologie et de couleur
   sur-le-champ. Un menu de personnages aurait demande un ecran de plus et
   une navigation au clavier, la ou le lobby sait deja faire choisir en
   nageant, y compris au doigt sur un telephone.
--------------------------------------------------------------------------- */

import { VIEW, Screen, fade32, rgba } from '../core/pixel.js';
import { drawTextCentered, drawText } from '../core/font.js';
import { sceneText } from './hud-anchor.js';
import { clamp, TAU, hash2 } from '../core/util.js';
import { UI, MATRICES_PALETTE, souchePalette } from '../data/palette.js';
import { MATRICES } from '../data/matrices.js';
import { BESTIARY } from '../data/bestiary.js';
import { drawOrganism, drawPlayer, colorOf } from '../render/organisms.js';
import { ESPECES, ESPECE_DEFAUT, especeOf } from '../data/especes.js';
import { Swimmer } from './swimmer.js';

const WELL_R = 21;
const BOUNDS = { r: 92 };

/* Disposition des puits, en coordonnees monde. Tout doit TENIR dans le
   champ d'un coup : un ecran de selection ou il faut se promener pour
   decouvrir les options est un mauvais ecran de selection. La camera est
   donc FIXE a l'origine, contrairement au jeu. */
/* Cinq matrices en couronne autour du puits du bestiaire. La disposition
   circulaire evite d'avoir a redessiner la boite a chaque stage ajoute. */
const SLOTS = (() => {
  const ids = ['milk', 'pipe', 'kombucha', 'levain', 'blood'];
  const R = 62;
  const out = ids.map((id, i) => {
    const a = -Math.PI / 2 + (i / ids.length) * Math.PI * 2;
    return { id, x: Math.round(Math.cos(a) * R), y: Math.round(Math.sin(a) * R * 0.86) };
  });
  out.push({ id: 'bestiaire', x: 0, y: 0, r: 16 });
  return out;
})();

/* Les colonies de souches vivent DANS LES INTERVALLES de la couronne, a 84
   du centre. Mesure : a ce rayon la colonie la plus serree garde 13 px de
   marge avec le puits voisin, et reste a 83 du centre pour 92 de nage — on
   les atteint toutes sans jamais toucher la paroi. Les poser sur la couronne
   elle-meme les collait aux puits, et un choix de souche declenche alors un
   depart de partie. */
const SOUCHE_R = 9;
const SOUCHE_SLOTS = ESPECES.map((espece, k) => {
  const a = -Math.PI / 2 + ((k + 0.5) / 5) * Math.PI * 2;
  return {
    id: `souche:${espece.id}`, espece,
    x: Math.round(Math.cos(a) * 84), y: Math.round(Math.sin(a) * 84 * 0.86),
    r: SOUCHE_R, kind: 'souche',
  };
});

export class Lobby {
  constructor(onPick, especeId = ESPECE_DEFAUT) {
    this.onPick = onPick;
    this.swim = new Swimmer(0, -76);
    this.time = 0;
    this.focus = null;
    this.enterHold = 0;
    /* La souche survit d'une partie a l'autre : on rejoue tres souvent avec
       la meme, et la redemander a chaque retour au lobby serait une taxe. */
    this.especeId = especeId;
    this.wells = SLOTS.map((s) => {
      if (s.id === 'bestiaire') return { ...s, r: s.r || WELL_R, kind: 'bestiaire' };
      const mat = MATRICES[s.id];
      const pal = MATRICES_PALETTE[s.id];
      return {
        ...s, r: WELL_R, kind: 'matrice', mat, pal,
        playable: !!(mat && mat.playable),
        label: pal.name,
        sub: mat ? mat.subtitle : 'A VENIR',
        /* Trois habitants qui derivent dans le puits, pour montrer le milieu. */
        preview: (mat && mat.pool ? mat.pool : []).slice(0, 3).map((spec, i) => ({
          spec, ph: i * 2.1 + hash2(i, s.x) * TAU, rad: 10 + i * 6,
        })),
      };
    });
    this.wells.push(...SOUCHE_SLOTS.map((s) => ({ ...s })));
  }

  /** La souche jouee, objet complet. */
  get espece() { return especeOf(this.especeId); }

  update(dt, input) {
    this.time += dt;
    this.swim.update(dt, input.move, BOUNDS);

    /* Puits le plus proche, s'il est assez pres. */
    let best = null, bd = Infinity;
    for (const w of this.wells) {
      const d = Math.hypot(this.swim.x - w.x, this.swim.y - w.y);
      if (d < w.r + 14 && d < bd) { bd = d; best = w; }
    }
    this.focus = best;

    /* On entre en RESTANT dedans : pas de touche a trouver, et pas
       d'entree accidentelle en passant. Changer de souche est reversible et
       gratuit, donc son maintien est deux fois plus court qu'un depart de
       partie : 0,3 s contre 0,65 s. */
    const souche = best && best.kind === 'souche' && best.espece.id !== this.especeId;
    const entree = best && (best.kind === 'bestiaire' || best.playable);
    if (best && bd < best.r * 0.72 && (souche || entree)) {
      this.enterHold += dt;
      const seuil = souche ? 0.30 : 0.65;
      if (this.enterHold > seuil) {
        this.enterHold = 0;
        if (souche) this.especeId = best.espece.id;
        else this.onPick(best.kind === 'bestiaire' ? { bestiaire: true }
          : { matrice: best.id, espece: this.especeId });
      }
    } else {
      this.enterHold = Math.max(0, this.enterHold - dt * 2);
    }
  }

  render(scr) {
    /* Camera fixe : la boite de Petri entiere reste visible. */
    const camX = 0, camY = 0;
    const toX = (x) => VIEW.CX + (x - camX);
    const toY = (y) => VIEW.CY + (y - camY);
    const fieldR = VIEW.R;
    scr.setFieldRadius(fieldR);

    scr.beginFrame(0xff000000);
    /* L'agar : pale, legerement chaud. */
    fillDisc(scr, VIEW.CX, VIEW.CY, fieldR, rgba(222, 219, 203, 255));

    scr.layer(Screen.layerFor(0.5, 1));
    /* Stries de la gelose, pour que le fond ne soit pas mort. */
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU + Math.sin(this.time * 0.05 + i) * 0.04;
      const rr = 26 + hash2(i, 7) * 64;
      scr.disc(toX(Math.cos(a) * rr), toY(Math.sin(a) * rr),
        1 + hash2(i, 3) * 1.6, rgba(198, 194, 174, 200), 0);
    }

    for (const w of this.wells) this.drawWell(scr, w, toX, toY);

    scr.layer(Screen.layerFor(-0.1, 0));
    const esp = this.espece;
    drawPlayer(scr, toX(this.swim.x), toY(this.swim.y),
      /* Le rayon suit la hitbox de la souche : on voit AVANT de jouer qu'une
         levure est une grosse cible et un coque une petite. */
      this.swim.radius * (esp.stats.hitbox ? esp.stats.hitbox / 3.4 : 1),
      this.swim.ang, this.swim.phase, MATRICES_PALETTE.milk, { count: 2, mode: 'bundle' },
      { drive: this.swim.drive, bend: 0, lean: this.swim.lean,
        sillage: this.swim.sillage, trouble: this.swim.trouble,
        morpho: esp.morpho, couleurs: souchePalette(MATRICES_PALETTE.milk, esp.id),
        /* Dans le lobby, la caracteristique est montree au repos : la spore
           en reserve, l'amas au complet, un bourgeon a mi-course. */
        trait: { spores: 1, amas: esp.trait && esp.trait.id === 'amas' ? 3 : 1,
          bourgeon: 0.55, dormance: 0 },
      });

    scr.composite();
    drawRim(scr, fieldR, rgba(150, 146, 128, 255));
    this.drawHud(scr);
  }

  drawWell(scr, w, toX, toY) {
    const sx = toX(w.x), sy = toY(w.y);
    if (sx < -60 || sy < -60 || sx > VIEW.W + 60 || sy > VIEW.H + 60) return;
    if (w.kind === 'souche') { this.drawSouche(scr, w, sx, sy); return; }
    const actif = this.focus === w;
    const dispo = w.kind === 'bestiaire' || w.playable;

    scr.layer(Screen.layerFor(0.2, 0));
    /* Le milieu du puits : on voit dans quoi on va tomber. */
    const fond = w.kind === 'bestiaire' ? rgba(6, 8, 12, 255) : w.pal.bg;
    scr.disc(sx, sy, w.r, dispo ? fond : fade32(fond, 0.45), 0);

    if (w.kind === 'matrice' && dispo) {
      scr.layer(Screen.layerFor(0.1, 0));
      for (const p of w.preview) {
        const a = p.ph + this.time * 0.5;
        const px = sx + Math.cos(a) * p.rad;
        const py = sy + Math.sin(a * 1.3) * p.rad * 0.7;
        const [fill, rim] = colorOf(p.spec, w.pal);
        drawOrganism(scr, p.spec, px, py, Math.min(p.spec.radius, 5), a, this.time,
          fill, rim, { pal: w.pal, drive: 0.6 });
      }
    }
    if (w.kind === 'bestiaire') {
      scr.layer(Screen.layerFor(0.1, 0));
      for (let i = 0; i < 5; i++) {
        const a = i * 1.257 + this.time * 0.35;
        scr.disc(sx + Math.cos(a) * 12, sy + Math.sin(a) * 12, 1.6,
          fade32(UI.textHot, 0.8), 0);
      }
    }

    scr.layer(Screen.layerFor(-0.05, 0));
    const anneau = dispo ? (actif ? UI.textHot : rgba(150, 146, 128, 255))
      : rgba(150, 146, 128, 140);
    scr.ring(sx, sy, w.r + 1.5, actif ? 2 : 1.2, anneau);

    /* Anneau de progression : il se remplit tant qu'on reste dedans. */
    if (actif && this.enterHold > 0) {
      const frac = clamp(this.enterHold / 0.65, 0, 1);
      for (let a = -Math.PI / 2; a < -Math.PI / 2 + frac * TAU; a += 0.06) {
        scr.disc(sx + Math.cos(a) * (w.r + 4), sy + Math.sin(a) * (w.r + 4), 1.1, UI.textHot, 0);
      }
    }
  }

  /**
   * Une colonie de souche : une goutte de milieu ou vit UNE cellule, dessinee
   * exactement comme le joueur le sera. Montrer la vraie morphologie plutot
   * qu'une vignette evite la promesse non tenue — on voit la grappe se
   * deconstruire et le bourgeon grossir avant meme de choisir.
   */
  drawSouche(scr, w, sx, sy) {
    const actif = this.focus === w;
    const choisie = w.espece.id === this.especeId;
    const pal = MATRICES_PALETTE.milk;
    const col = souchePalette(pal, w.espece.id);

    scr.layer(Screen.layerFor(0.2, 0));
    scr.disc(sx, sy, w.r, rgba(236, 233, 218, 255), 0);

    scr.layer(Screen.layerFor(0.05, 0));
    const a = this.time * 0.4 + w.x;
    drawPlayer(scr, sx, sy, 3.0, a, this.time, pal, { count: 0, mode: 'bundle' },
      { drive: 0.25, bend: 0, lean: 0,
        morpho: w.espece.morpho, couleurs: col,
        trait: { spores: 1, amas: 4, bourgeon: 0.6, dormance: 0 } });

    scr.layer(Screen.layerFor(-0.05, 0));
    /* La souche choisie porte un anneau plein de SA couleur : c'est le seul
       endroit ou l'on peut verifier d'un coup d'oeil qui l'on est. */
    scr.ring(sx, sy, w.r + 1.5, choisie ? 2 : 1.2,
      choisie ? col.fill : (actif ? UI.textHot : rgba(150, 146, 128, 190)));
    if (actif && this.enterHold > 0 && !choisie) {
      const frac = clamp(this.enterHold / 0.30, 0, 1);
      for (let t = -Math.PI / 2; t < -Math.PI / 2 + frac * TAU; t += 0.08) {
        scr.disc(sx + Math.cos(t) * (w.r + 4), sy + Math.sin(t) * (w.r + 4), 1, UI.textHot, 0);
      }
    }
  }

  drawHud(scr) {
    const t = sceneText(scr);
    t.ligne('CELL DUNGEON', UI.text, 2).saut(3);
    const w = this.focus;
    if (w && w.kind === 'souche') {
      /* Devant une colonie, on parle de la SOUCHE : son nom, ce qu'elle
         tire, et sa caracteristique unique. C'est la seule information qui
         decide du choix, donc c'est la seule affichee. */
      const e = w.espece;
      t.ligne(e.label, UI.textHot, 2);
      t.ligne(e.sous, UI.textDim, 1);
      t.ligne(e.trait ? e.trait.label : 'AUCUNE CAPACITE PROPRE', UI.text, 1);
      t.ligne(e.id === this.especeId ? 'SOUCHE ACTIVE' : 'RESTE DEDANS POUR DEVENIR',
        e.id === this.especeId ? UI.textHot : UI.textDim, 1);
    } else if (w) {
      const bestiaire = w.kind === 'bestiaire';
      t.ligne(bestiaire ? 'BESTIAIRE' : w.label, UI.textHot, 2);
      t.ligne(bestiaire ? 'OBSERVER LA FLORE' : (w.playable ? w.sub : 'MATRICE A VENIR'),
        UI.textDim, 1);
      if (!bestiaire && !w.playable) t.ligne('PAS ENCORE JOUABLE', UI.textDim, 1);
      else t.ligne('RESTE DEDANS POUR ENTRER', UI.textDim, 1);
    } else {
      t.ligne(`SOUCHE : ${this.espece.label}`, UI.text, 1);
      t.ligne('NAGE VERS UN PUITS', UI.textDim, 1);
    }
  }
}

/* --- petits utilitaires de dessin direct -------------------------------- */

function fillDisc(scr, cx, cy, r, col) {
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
    for (let x = -w; x <= w; x++) scr.direct(cx + x, cy + y, col);
  }
}

function drawRim(scr, r, col) {
  for (let a = 0; a < TAU; a += 0.004) {
    scr.direct(VIEW.CX + Math.cos(a) * r, VIEW.CY + Math.sin(a) * r, col);
  }
}

export { fillDisc, drawRim };

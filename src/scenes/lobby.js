/* ---------------------------------------------------------------------------
   Lobby : une boite de Petri vue au microscope.

   Le joueur y nage librement. Chaque matrice est un PUITS — un disque rempli
   de son propre milieu, ou derivent deux ou trois de ses organismes. On
   choisit son stage en nageant dedans ; il n'y a pas de menu. Un puits de
   plus mene au bestiaire.

   Le puits montre donc litteralement ce dans quoi on va tomber : c'est plus
   parlant qu'une liste, et ca reutilise tout le moteur de rendu.

   La SOUCHE se choisit dans la NICHE : une petite maison de biofilm posee au
   bas de la boite, dans laquelle on entre. A l'interieur, les quatre souches
   dorment chacune dans son alveole ; on va au contact de celle qu'on veut,
   on la DEVIENT, et on ressort par la porte.

   Version precedente : quatre colonies semees entre les puits, sur la gelose.
   Elle marchait, mais elle melangeait deux gestes de nature differente — on
   nageait dans une colonie pour changer de corps et dans un puits pour partir
   en mission, avec la meme commande et a dix pixels d'ecart. Les rassembler
   dans une piece separe les deux : dedans on s'habille, dehors on part.

   L'esthetique reprend le vocabulaire de la plaque de biofilm de la conduite
   (`organisms.js`, cas 'plaque') — des bosses d'EPS qui se chevauchent,
   jamais un cercle — mais en chaud et en rond : la conduite est un milieu
   hostile, la niche est un chez-soi.
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
import { profilSouche } from '../game/stats.js';
import { Swimmer } from './swimmer.js';

const WELL_R = 21;
const BOUNDS = { r: 92 };

/* Disposition des puits, en coordonnees monde. Tout doit TENIR dans le
   champ d'un coup : un ecran de selection ou il faut se promener pour
   decouvrir les options est un mauvais ecran de selection. La camera est
   donc FIXE a l'origine, contrairement au jeu.

   UN CADRAN DE MONTRE : six positions a 60 degres sur un meme anneau, la
   niche au centre. La version precedente serrait cinq puits sur un anneau de
   62 avec le bestiaire au milieu et la niche coincee en bas — tout se
   touchait, et le centre, qui est l'endroit ou l'oeil tombe, servait a la
   chose qu'on consulte le moins.

   Rayon 78. Le chiffre vient de deux contraintes qui se rejoignent :
     - l'ECART. A 60 degres l'entraxe vaut exactement le rayon, soit 78 ;
       moins deux anneaux de puits (22,5 chacun) il reste 33 px de gelose
       entre deux voisins. C'est franc.
     - le BORD. Le bord exterieur d'un puits tombe a 99 px pour un champ de
       124 : 25 px de gelose derriere, donc « bien a l'interieur ».
   Et plus d'aplatissement en y : une boite de Petri vue de dessus est un
   cercle, le 0,86 de la couronne precedente ne decrivait rien. */
const CADRAN = 78;
const SLOTS = (() => {
  /* Dans le sens horaire depuis midi. Le BESTIAIRE est a six heures parce
     que c'est la seule position qu'on lit sans compter — et parce qu'en
     portrait le texte du HUD est juste en dessous, ce qui met la notice a
     cote de la chose qu'elle decrit. */
  const ordre = ['milk', 'pipe', 'kombucha', 'bestiaire', 'levain', 'blood'];
  return ordre.map((id, i) => {
    const a = -Math.PI / 2 + (i / ordre.length) * Math.PI * 2;
    const s = { id, x: Math.round(Math.cos(a) * CADRAN), y: Math.round(Math.sin(a) * CADRAN) };
    /* Le bestiaire est un peu plus petit : il n'est pas un stage. */
    if (id === 'bestiaire') s.r = 18;
    return s;
  });
})();

/* LA NICHE EST AU CENTRE, et c'est la troisieme position qu'elle occupe.
   D'abord quatre colonies semees entre les puits, puis une maison coincee au
   bas de la couronne ou elle frolait le puits du kombucha — 2,3 px entre les
   deux anneaux au premier essai, 6,2 au second, jamais confortable.

   Au centre le probleme disparait : le puits le plus proche est a 78, son
   anneau s'arrete a 55,5, et la maison a 21. Il reste 34 px de gelose tout
   autour. Entrer chez soi et partir en mission ne peuvent plus se declencher
   l'un pour l'autre, et c'est tout l'enjeu.

   C'est aussi la bonne place au sens du jeu : le centre est l'endroit ou
   l'oeil tombe et ou le nageur passe, et ce qu'on y met est ce qu'on fait en
   premier — choisir qui l'on est. */
const NICHE = { id: 'niche', x: 0, y: 0, r: 20, kind: 'niche' };

/* Le nageur arrive SOUS la niche, a 40 px : assez pres pour que la maison
   soit la premiere chose qu'il voie — son orientation de depart pointe
   dessus — et assez loin pour que rien ne soit deja selectionne. Le rayon de
   selection le plus large du lobby vaut 32 (18 + 14) ; a 40 du centre et 38
   du bestiaire, aucun des deux n'accroche. */
const DEPART = { x: 0, y: 40 };

/* --- l'interieur, dans son propre repere -------------------------------- */

/* La piece est centree sur l'origine parce que le nageur borne sa position
   sur un rayon centre sur l'origine (`Swimmer`, bounds.r). Deux reperes, un
   seul nageur : on le repose a l'entree et a la sortie. */
const NICHE_DEDANS = { r: 74 };

/* Les quatre alveoles en arc sur la moitie HAUTE, la porte en bas. Un arc et
   non un cercle complet : avec la porte sur le meme anneau, on frole une
   alveole en sortant, et sortir finirait par changer de souche.

   Le chiffre a surveiller n'est pas l'entraxe mais le vide entre les
   BOURRELETS, qui debordent de 7 px chacun. Premier essai a 50 px de rayon
   sur 140 degres : 39,6 px d'entraxe pour 40 px de bourrelets, soit un
   recouvrement — et la capture montrait quatre alveoles fondues en une
   guirlande. A 56 px sur 150 degres il reste 47,3 - 40 = 7,3 px de mur
   entre deux voisines, et chacune se lit seule. */
const ALVEOLE_R = 13;
const ALVEOLES = ESPECES.map((espece, k) => {
  const a = (-165 + (k / (ESPECES.length - 1)) * 150) * Math.PI / 180;
  return {
    id: `souche:${espece.id}`, espece, kind: 'souche',
    x: Math.round(Math.cos(a) * 56), y: Math.round(Math.sin(a) * 56 * 0.86),
    r: ALVEOLE_R,
  };
});
const PORTE = { id: 'porte', x: 0, y: 62, r: 11, kind: 'porte' };
/* On arrive DOS a la porte et assez loin d'elle pour ne pas ressortir dans
   la foulee : 38 px, soit plus de trois fois son rayon. */
const NICHE_ARRIVEE = { x: 0, y: 24 };
/* Et on ressort devant la maison, pas dedans : 23 px du centre du dome, donc
   hors du disque d'entree (11,5 px) avec de la marge. */
/* On ressort DEVANT la maison : 34 px du centre, donc au-dela du rayon
   d'entree (13) avec de la marge, et hors du rayon de selection (32) pour
   que la maison ne se rouvre pas toute seule dans la foulee. */
const NICHE_SORTIE = { x: 0, y: 34 };

/* La niche est en EPS, comme la plaque de la conduite — mais pas de la meme
   couleur. Mesure faite a l'oeil sur la planche : le `#4e7a6a` de la conduite
   pose sur la gelose claire (222, 219, 203) se lit comme une TACHE, pas comme
   une maison ; il est fait pour un fond noir. On garde donc la famille — un
   vert de gel a lisere menthe — en la remontant en clarte et en chaleur. */
const EPS = {
  mur: rgba(126, 168, 142, 255),
  murClair: rgba(158, 200, 172, 255),
  murSombre: rgba(84, 122, 102, 255),
  lisere: rgba(196, 232, 206, 255),
  dedans: rgba(238, 228, 200, 255),
  porte: rgba(58, 84, 72, 255),
};

export class Lobby {
  constructor(onPick, especeId = ESPECE_DEFAUT) {
    this.onPick = onPick;
    this.swim = new Swimmer(DEPART.x, DEPART.y);
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
    this.wells.push({ ...NICHE });
    /* Dedans ou dehors. Un booleen et non une scene a part : la niche
       reutilise le nageur, la camera fixe et le HUD du lobby — en faire une
       scene aurait duplique les trois pour une piece de quatre alveoles. */
    this.dedans = false;
  }

  /** La souche jouee, objet complet. */
  get espece() { return especeOf(this.especeId); }

  update(dt, input) {
    this.time += dt;
    if (this.dedans) { this.majDedans(dt, input); return; }
    this.swim.update(dt, input.move, BOUNDS);

    /* Puits le plus proche, s'il est assez pres. */
    const [best, bd] = this.plusProche(this.wells);
    this.focus = best;

    /* On entre en RESTANT dedans : pas de touche a trouver, et pas
       d'entree accidentelle en passant. Entrer dans la niche est reversible
       et gratuit, donc son maintien est deux fois plus court qu'un depart de
       partie : 0,3 s contre 0,65 s. */
    const niche = best && best.kind === 'niche';
    const entree = best && (best.kind === 'bestiaire' || best.playable);
    if (best && bd < best.r * 0.72 && (niche || entree)) {
      this.enterHold += dt;
      const seuil = niche ? 0.30 : 0.65;
      if (this.enterHold > seuil) {
        this.enterHold = 0;
        if (niche) this.entrer();
        else this.onPick(best.kind === 'bestiaire' ? { bestiaire: true }
          : { matrice: best.id, espece: this.especeId });
      }
    } else {
      this.enterHold = Math.max(0, this.enterHold - dt * 2);
    }
  }

  /** La cible la plus proche du nageur, si elle est a portee. */
  plusProche(cibles) {
    let best = null, bd = Infinity;
    for (const w of cibles) {
      const d = Math.hypot(this.swim.x - w.x, this.swim.y - w.y);
      if (d < w.r + 14 && d < bd) { bd = d; best = w; }
    }
    return [best, bd];
  }

  /** Franchir la porte, dans un sens ou dans l'autre. */
  poser(p) {
    this.swim.x = p.x; this.swim.y = p.y;
    this.swim.vx = 0; this.swim.vy = 0;
    this.focus = null;
    this.enterHold = 0;
  }

  entrer() { this.dedans = true; this.poser(NICHE_ARRIVEE); }
  sortir() { this.dedans = false; this.poser(NICHE_SORTIE); }

  /**
   * Dedans : quatre alveoles et une porte, meme geste que dehors.
   *
   * Le maintien de la porte est aussi court que celui d'une alveole (0,3 s) :
   * sortir ne coute rien et se refait, le faire attendre plus longtemps que
   * s'habiller n'aurait aucun sens.
   */
  majDedans(dt, input) {
    this.swim.update(dt, input.move, NICHE_DEDANS);
    const [best, bd] = this.plusProche([...ALVEOLES, PORTE]);
    this.focus = best;
    const utile = best && (best.kind === 'porte'
      || (best.kind === 'souche' && best.espece.id !== this.especeId));
    if (utile && bd < best.r * 0.72) {
      this.enterHold += dt;
      if (this.enterHold > 0.30) {
        this.enterHold = 0;
        if (best.kind === 'porte') this.sortir();
        else this.especeId = best.espece.id;
      }
    } else {
      this.enterHold = Math.max(0, this.enterHold - dt * 2);
    }
  }

  render(scr) {
    if (this.dedans) { this.renderNiche(scr); return; }
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
      this.swim.ang, this.swim.phase, MATRICES_PALETTE.milk,
      /* Deux flagelles en dur, avant : sur un staphylocoque ou une levure
         c'est exactement ce que l'auteur a refuse. Le compte suit la souche,
         ici comme au tirage des cartes. */
      { count: esp.aflagelle ? 0 : 2, mode: 'bundle' },
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
    if (w.kind === 'niche') { this.dessinerDome(scr, w, sx, sy); return; }
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
   * Le dome, vu de l'exterieur : la maison posee sur la gelose.
   *
   * Des bosses qui se chevauchent, jamais un cercle — un cercle se lirait
   * comme une bulle ou comme un puits de plus, et c'est exactement ce qu'on
   * ne veut pas a six pixels du puits du kombucha. La porte est tournee vers
   * le CENTRE de la boite, donc vers le nageur qui arrive.
   */
  dessinerDome(scr, w, sx, sy) {
    const actif = this.focus === w;
    const r = w.r;
    /* La maison est vue DE COTE, au milieu de puits vus de dessus.
       Ce n'est pas un oubli, c'est le choix qui a fait basculer la lecture.
       Trois essais en vue de dessus : un amas de bosses vertes de 30 px se
       lit comme un puits de plus, quelle que soit la quantite de detail
       qu'on y met — porte, cheminee, hublots, tout se noyait. Une facade a
       toit bombe et base plate, elle, se lit comme un batiment au premier
       coup d'oeil, parce qu'elle est la seule chose de la boite qui ait un
       HAUT et un BAS. La convention mixte est courante et personne ne la
       remarque ; ce qu'on remarque, c'est de ne pas reconnaitre sa maison. */
    const base = sy + r * 0.62;
    const haut = r * 1.34;

    /* Le profil du toit : une demi-ellipse bosselee. Les deux sinus sont
       fixes, donc le toit ne bouge pas d'une image a l'autre — une maison
       qui ondule est une meduse. */
    const profil = (x) => {
      const u = x / r;
      if (Math.abs(u) >= 1) return 0;
      return Math.sqrt(1 - u * u) * haut
        * (1 + 0.11 * Math.sin(u * 7.1 + 1.3) + 0.06 * Math.sin(u * 13.3 + 0.4));
    };
    const colonnes = (col, sur, dy) => {
      for (let x = -r - sur; x <= r + sur; x++) {
        const h = profil(x * (r / (r + sur)));
        if (h <= 0.5) continue;
        const y0 = Math.round(base - h - sur + dy);
        scr.rect(Math.round(sx + x), y0, 1, Math.round(base + dy - y0) + 1, col);
      }
    };

    /* L'ombre portee : aplatie et decalee vers le bas-droite, coherente avec
       la lumiere fixe en haut a gauche de tout le reste du jeu. */
    scr.layer(Screen.layerFor(0.4, 0));
    scr.ellipse(sx + 2, base + 2, r * 1.06, r * 0.3, 0, rgba(182, 178, 156, 255), 0);

    /* Un lisere sombre, obtenu en redessinant le meme profil deborde de
       1,5 px. Sans contour, le vert du gel et le beige de la gelose se
       touchent sans transition et la silhouette se delave. */
    scr.layer(Screen.layerFor(0.3, 0));
    colonnes(EPS.murSombre, 1.5, 1);

    scr.layer(Screen.layerFor(0.2, 0));
    colonnes(EPS.mur, 0, 0);

    /* La lumiere : le quart haut-gauche du toit, en clair. On suit le profil
       plutot que de poser des taches — mesure faite, deux taches claires
       posees a la main se lisaient comme deux defauts de compression. */
    scr.layer(Screen.layerFor(0.18, 0));
    for (let x = -r; x <= -r * 0.15; x++) {
      const h = profil(x);
      if (h <= 1) continue;
      scr.rect(Math.round(sx + x), Math.round(base - h), 1, Math.max(1, Math.round(h * 0.26)),
        EPS.murClair);
    }

    /* La PORTE : une arche plein cintre posee sur la base, large de huit
       pixels. Elle mange le quart de la facade — a 30 px de large, une porte
       « a l'echelle » serait deux pixels et ne se verrait pas. */
    scr.layer(Screen.layerFor(0.15, 0));
    const pw = 4;
    scr.rect(Math.round(sx - pw), Math.round(base - 7), pw * 2 + 1, 8, EPS.porte);
    scr.disc(sx, base - 7, pw + 0.4, EPS.porte, 0);
    /* La lumiere chaude qui sort, et qui bat lentement : c'est elle qui dit
       « habite », et elle coute six pixels. */
    scr.disc(sx, base - 4.5, 2.2,
      fade32(EPS.dedans, 0.6 + 0.25 * Math.sin(this.time * 1.7)), 0);

    /* Deux hublots — les canaux d'eau de la plaque de biofilm, qui sont un
       vrai caractere de la matrice d'EPS et qui tombent ici tres bien. */
    scr.disc(sx - r * 0.55, base - r * 0.72, 1.7, EPS.lisere, 0);
    scr.disc(sx + r * 0.55, base - r * 0.72, 1.7, EPS.lisere, 0);

    /* Et les bulles qui montent du toit. Elles n'ont aucune fonction : c'est
       exactement pour ca qu'elles sont la, et elles montent dans la gelose
       libre au-dessus, la ou rien ne les cache. */
    scr.layer(Screen.layerFor(-0.2, 0));
    for (let i = 0; i < 3; i++) {
      const t = (this.time * 0.34 + i / 3) % 1;
      scr.disc(sx + r * 0.3 + Math.sin(t * 5 + i) * 2.6,
        base - haut - 3 - t * 16, 1.5 * (1 - t * 0.4),
        fade32(EPS.lisere, 0.9 * (1 - t)), 0);
    }

    scr.layer(Screen.layerFor(-0.05, 0));
    const col = souchePalette(MATRICES_PALETTE.milk, this.especeId);
    /* L'anneau porte la couleur de la souche ACTIVE : depuis la gelose, la
       maison dit deja qui l'on est, sans avoir a y entrer. Il est ELLIPTIQUE
       et pose sur la facade, pas centre sur le point d'entree : un cercle
       autour d'une maison carree se lit comme un puits, ce qu'on vient
       justement d'arreter de dessiner. */
    scr.ringE(sx, base - haut * 0.42, r + 3, haut * 0.66 + 3, 0, actif ? 2 : 1.2,
      actif ? UI.textHot : col.fill);
    if (actif && this.enterHold > 0) {
      this.anneauMaintien(scr, sx, base - haut * 0.42, r + 6, 0.30);
    }
  }

  /** L'anneau qui se remplit tant qu'on reste dedans. */
  anneauMaintien(scr, sx, sy, rayon, seuil) {
    const frac = clamp(this.enterHold / seuil, 0, 1);
    for (let a = -Math.PI / 2; a < -Math.PI / 2 + frac * TAU; a += 0.07) {
      scr.disc(sx + Math.cos(a) * rayon, sy + Math.sin(a) * rayon, 1.1, UI.textHot, 0);
    }
  }

  /**
   * L'INTERIEUR : une piece ronde en EPS, quatre alveoles, une porte.
   *
   * Meme camera fixe que la boite de Petri et meme nageur : ce qui change
   * est le repere et le decor, rien d'autre. C'est ce qui permet a la niche
   * de ne pas etre une scene.
   */
  renderNiche(scr) {
    const toX = (x) => VIEW.CX + x;
    const toY = (y) => VIEW.CY + y;
    const fieldR = VIEW.R;
    scr.setFieldRadius(fieldR);
    scr.beginFrame(0xff000000);

    /* Le mur remplit tout le champ, le sol est le disque du milieu : on est
       DEDANS, il ne doit rester aucun bord de boite de Petri visible. */
    fillDisc(scr, VIEW.CX, VIEW.CY, fieldR, EPS.murSombre);
    fillDisc(scr, VIEW.CX, VIEW.CY, 88, EPS.dedans);

    /* La paroi : une couronne de bosses. Vingt-deux, assez pour qu'aucune
       ne se lise seule — une paroi doit se lire comme une matiere continue,
       pas comme un collier de perles. */
    scr.layer(Screen.layerFor(0.35, 0));
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU;
      const rr = 9 + hash2(i, 5) * 7;
      bosseEps(scr, toX(Math.cos(a) * 92), toY(Math.sin(a) * 92), rr, i,
        this.time, i % 3 === 0 ? EPS.murClair : EPS.mur, 5);
    }

    /* Grumeaux au sol, pour que la piece ne soit pas un aplat. */
    scr.layer(Screen.layerFor(0.5, 1));
    for (let i = 0; i < 20; i++) {
      const a = hash2(i, 13) * TAU, rr = 12 + hash2(i, 17) * 66;
      scr.disc(toX(Math.cos(a) * rr), toY(Math.sin(a) * rr * 0.9),
        1 + hash2(i, 19) * 1.8, rgba(224, 212, 184, 210), 0);
    }

    for (const al of ALVEOLES) this.dessinerAlveole(scr, al, toX(al.x), toY(al.y));
    this.dessinerPorte(scr, toX(PORTE.x), toY(PORTE.y));

    /* Des bulles qui montent dans la piece : c'est ce qui la rend vivante
       plutot que peinte. */
    scr.layer(Screen.layerFor(-0.3, 0));
    for (let i = 0; i < 7; i++) {
      const t = (this.time * 0.22 + hash2(i, 23)) % 1;
      const bx = toX(-70 + hash2(i, 29) * 140);
      scr.disc(bx + Math.sin(t * 6 + i) * 3, toY(76 - t * 150),
        1 + hash2(i, 31) * 1.4, fade32(EPS.lisere, 0.7 * (1 - t)), 0);
    }

    scr.layer(Screen.layerFor(-0.1, 0));
    const esp = this.espece;
    drawPlayer(scr, toX(this.swim.x), toY(this.swim.y),
      this.swim.radius * (esp.stats.hitbox ? esp.stats.hitbox / 3.4 : 1),
      this.swim.ang, this.swim.phase, MATRICES_PALETTE.milk,
      /* Le nageur du lobby n'a PAS de flagelle ici : il en avait deux en
         dur, et sur un staphylocoque ou une levure c'est precisement ce que
         l'auteur a refuse. Le compte suit donc la souche. */
      { count: esp.aflagelle ? 0 : 2, mode: 'bundle' },
      { drive: this.swim.drive, bend: 0, lean: this.swim.lean,
        sillage: this.swim.sillage, trouble: this.swim.trouble,
        morpho: esp.morpho, couleurs: souchePalette(MATRICES_PALETTE.milk, esp.id),
        trait: { spores: 1, amas: esp.trait && esp.trait.id === 'amas' ? 3 : 1,
          bourgeon: 0.55, dormance: 0 } });

    scr.composite();
    drawRim(scr, fieldR, EPS.murSombre);
    this.drawHud(scr);
  }

  /**
   * Une alveole : un creux dans la paroi ou dort une souche, dessinee
   * exactement comme le joueur le sera. Montrer la vraie morphologie plutot
   * qu'une vignette evite la promesse non tenue — on voit la grappe se
   * deconstruire et le bourgeon grossir avant meme de choisir.
   */
  dessinerAlveole(scr, w, sx, sy) {
    const actif = this.focus === w;
    const choisie = w.espece.id === this.especeId;
    const pal = MATRICES_PALETTE.milk;
    const col = souchePalette(pal, w.espece.id);

    /* Le bourrelet d'EPS autour du creux, en DEUX passes. Une seule passait
       inapercue : le creux clair sur un sol clair ne se lisait pas comme un
       creux, et les quatre alveoles ressemblaient a quatre taches. La passe
       sombre dessous fait l'ombre du bourrelet, et c'est elle qui donne la
       profondeur. */
    scr.layer(Screen.layerFor(0.35, 0));
    bosseEps(scr, sx, sy + 2, w.r + 7, w.x + 13, this.time, EPS.murSombre, 8);
    scr.layer(Screen.layerFor(0.3, 0));
    bosseEps(scr, sx, sy, w.r + 5, w.x + 7, this.time, EPS.mur, 8);
    scr.layer(Screen.layerFor(0.2, 0));
    scr.disc(sx, sy, w.r, rgba(246, 240, 216, 255), 0);

    scr.layer(Screen.layerFor(0.05, 0));
    const a = this.time * 0.4 + w.x;
    /* 4,4 et non 3,4 : a 3,4 dans un creux de 26 px la cellule etait un
       point de couleur, et c'est la MORPHOLOGIE qu'on vient regarder. */
    drawPlayer(scr, sx, sy, 4.4, a, this.time, pal,
      /* Meme regle que partout : une souche sans flagelle n'en porte pas,
         pas meme en vitrine. */
      { count: w.espece.aflagelle ? 0 : 2, mode: 'bundle' },
      { drive: 0.25, bend: 0, lean: 0,
        morpho: w.espece.morpho, couleurs: col,
        trait: { spores: 1, amas: 4, bourgeon: 0.6, dormance: 0 } });

    scr.layer(Screen.layerFor(-0.05, 0));
    /* La souche choisie porte un anneau plein de SA couleur : c'est le seul
       endroit ou l'on peut verifier d'un coup d'oeil qui l'on est. */
    scr.ring(sx, sy, w.r + 1.5, choisie ? 2 : 1.2,
      choisie ? col.fill : (actif ? UI.textHot : EPS.lisere));
    if (actif && this.enterHold > 0 && !choisie) {
      this.anneauMaintien(scr, sx, sy, w.r + 4, 0.30);
    }
  }

  /** La porte, vue de l'interieur : l'arche, et la gelose claire derriere. */
  dessinerPorte(scr, sx, sy) {
    const actif = this.focus === PORTE;
    /* Meme bourrelet en deux passes que les alveoles, et pour la meme raison
       mesuree : une seule passe posait un disque clair sur un sol clair, et
       la sortie ne se distinguait pas d'une tache. */
    scr.layer(Screen.layerFor(0.35, 0));
    bosseEps(scr, sx, sy + 2, PORTE.r + 7, 29, this.time, EPS.murSombre, 8);
    scr.layer(Screen.layerFor(0.3, 0));
    bosseEps(scr, sx, sy, PORTE.r + 5, 23, this.time, EPS.mur, 8);
    scr.layer(Screen.layerFor(0.2, 0));
    /* La lumiere du dehors est FROIDE et celle du dedans est chaude : c'est
       ce contraste-la qui dit « sortie », pas la forme de l'arche. On voit
       litteralement la gelose au travers — c'est sa couleur exacte. */
    scr.disc(sx, sy, PORTE.r, rgba(210, 214, 206, 255), 0);
    scr.disc(sx, sy - PORTE.r * 0.25, PORTE.r * 0.74, rgba(232, 234, 226, 255), 0);
    scr.disc(sx, sy - PORTE.r * 0.45, PORTE.r * 0.4, rgba(246, 247, 242, 255), 0);
    scr.layer(Screen.layerFor(-0.05, 0));
    scr.ring(sx, sy, PORTE.r + 1.5, actif ? 2 : 1.2, actif ? UI.textHot : EPS.lisere);
    if (actif && this.enterHold > 0) this.anneauMaintien(scr, sx, sy, PORTE.r + 4, 0.30);
  }

  drawHud(scr) {
    const t = sceneText(scr);
    const w = this.focus;
    if (this.dedans) {
      if (w && w.kind === 'souche') {
        /* Devant une alveole, la FICHE de la souche. Le titre « LA NICHE »
           saute : on sait ou on est, et chaque ligne rendue sert a choisir.
           Les atouts et les faiblesses sont CALCULES a partir des stats
           (`profilSouche`), jamais recopies — une fiche ecrite a la main
           aurait divergé du premier reglage d'equilibrage. */
        const e = w.espece;
        const pr = profilSouche(e);
        t.ligne(e.label, UI.textHot, 2);
        t.ligne(e.sous, UI.textDim, 1);
        t.ligne(e.trait ? e.trait.label : 'PAS DE CAPACITE', UI.text, 1).saut(2);
        for (const a of pr.atouts) t.ligne(`+ ${a}`, UI.heal, 1);
        for (const f of pr.faiblesses) t.ligne(`- ${f}`, UI.damage, 1);
        /* Le lactobacille est la reference : zero ecart des deux cotes. Sans
           cette ligne sa fiche est vide et se lit comme un bug, alors que
           c'est justement son identite. */
        if (!pr.atouts.length && !pr.faiblesses.length) {
          t.ligne('LA REFERENCE', UI.text, 1);
        }
        t.saut(2).ligne(e.id === this.especeId ? 'SOUCHE ACTIVE' : 'RESTE POUR DEVENIR',
          e.id === this.especeId ? UI.textHot : UI.textDim, 1);
      } else if (w && w.kind === 'porte') {
        t.ligne('LA NICHE', UI.text, 2).saut(3);
        t.ligne('SORTIR', UI.textHot, 2);
        t.ligne('RESTE DEDANS POUR REVENIR', UI.textDim, 1);
      } else {
        t.ligne('LA NICHE', UI.text, 2).saut(3);
        t.ligne(this.espece.label, UI.textHot, 1);
        t.ligne('VA AU CONTACT D UNE SOUCHE', UI.textDim, 1);
      }
      return;
    }
    t.ligne('CELL DUNGEON', UI.text, 2).saut(3);
    if (w && w.kind === 'niche') {
      t.ligne('LA NICHE', UI.textHot, 2);
      t.ligne(`SOUCHE : ${this.espece.label}`, UI.text, 1);
      t.ligne('RESTE DEDANS POUR ENTRER', UI.textDim, 1);
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

/**
 * Une bosse d'EPS : des disques qui se chevauchent, jamais un cercle.
 *
 * C'est le vocabulaire de la plaque de biofilm de la conduite
 * (`organisms.js`, cas 'plaque'), repris tel quel — une matrice
 * exopolysaccharidique est grumeleuse, et c'est ce grumeau qui la distingue
 * au premier coup d'oeil d'une bulle ou d'un puits. Toute la niche est faite
 * de cette seule primitive : le dome, la paroi, les bourrelets d'alveole et
 * l'encadrement de la porte.
 *
 * `graine` fige la forme : sans elle les bosses se redistribueraient a
 * chaque image et la maison bouillonnerait. Seul le RAYON respire.
 */
function bosseEps(scr, cx, cy, r, graine, temps, col, n = 9, aplat = 0.92) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash2(i, graine) * 0.9;
    /* Bosses poussees VERS L'EXTERIEUR (0,44 a 0,80 du rayon) et grosses.
       Premier jet a 0,28-0,68 : elles se recouvraient au centre et la
       silhouette redevenait un disque. Ce qui fait lire « gel » est le
       CONTOUR bossele, donc c'est le contour qu'il faut peupler. */
    const d = r * (0.44 + 0.36 * hash2(i + 3, graine));
    const rr = r * (0.34 + 0.22 * hash2(i + 11, graine))
      * (1 + 0.05 * Math.sin(temps * 0.8 + i));
    scr.disc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * aplat, rr, col, 0);
  }
  /* Et un coeur plein, sinon les bosses exterieures laissent un trou au
     milieu — visible des que la couleur du fond differe. */
  scr.disc(cx, cy, r * 0.5, col, 0);
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

/* ---------------------------------------------------------------------------
   Geometrie de la conduite.

   Un tuyau d'atelier n'est pas un rectangle : il s'elargit en chambre, se
   pince au passage d'une vanne, porte des filtres, et se separe en branches
   aux tes. Toute cette geometrie est GENEREE PAR HACHAGE de l'abscisse, donc
   sans etat, infiniment longue et identique a chaque partie de meme graine.

   Une seule regle physique commande le reste : la CONSERVATION DU DEBIT. Dans
   un tube, le meme volume doit passer par chaque section ; donc la ou c'est
   etroit, ca va vite. Le joueur n'a rien a apprendre de plus — il le verra.

   Le monde boucle sur PERIODE : passe cette longueur, la conduite se repete.
   Comme le decor et la geometrie sont tous deux periodiques de cette meme
   longueur, et que la Conduite recentre tout le monde d'un coup quand le
   joueur franchit la couture, ca ne se voit pas. Le couloir est, en pratique,
   infini dans les deux sens.
--------------------------------------------------------------------------- */

import { clamp, hash2, TAU } from '../core/util.js';

/** Longueur d'un tour de conduite, en pixels. Multiple de la maille du decor
 *  (64 px), sinon la couture ferait sauter les globules. */
export const PERIODE = 2816;           // 44 mailles de 64

/** Ramene une abscisse dans un tour, dans [-PERIODE/2, PERIODE/2[. */
export function boucle(x) {
  const L = PERIODE;
  return x - Math.round(x / L) * L;
}

/* Trois familles d'accidents, toutes calees sur une grille de TRONCONS pour
   qu'un accident ne chevauche jamais un autre. */
const TRONCON = 352;                   // PERIODE / 8 : huit troncons par tour
const N_TRONCONS = PERIODE / TRONCON;

/**
 * Nature des troncons d'un tour.
 *
 * Tiree par MELANGE d'un jeu impose, pas par hachage libre : avec un tirage
 * independant par troncon, une graine sur trois faisait un tour entier sans
 * bifurcation. Le joueur doit rencontrer chaque accident a chaque tour —
 * c'est le contenu du stage, pas une surprise optionnelle.
 */
const JEU = ['droit', 'chambre', 'pincement', 'filtre',
  'bifurcation', 'chambre', 'pincement', 'bifurcation'];

function melange(graine) {
  const t = JEU.slice();
  /* Fisher-Yates deterministe. */
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(hash2(i * 31 + 7, graine) * (i + 1));
    const tmp = t[i]; t[i] = t[j]; t[j] = tmp;
  }
  return t;
}

export class Geometrie {
  /**
   * @param {number} demiBase demi-hauteur nominale de la conduite
   * @param {number} graine
   */
  constructor(demiBase = 112, graine = 3) {
    this.demiBase = demiBase;
    this.graine = graine;
    this.natures = melange(graine);
    /* Bornes utiles au reste du moteur : la grille de pH et le rendu ont
       besoin de savoir jusqu'ou la conduite peut s'ouvrir. */
    this.demiMax = demiBase * 1.75;
    this.demiMin = demiBase * 0.42;
  }

  /** Indice et position relative dans le troncon courant. */
  troncon(x) {
    const xb = boucle(x);
    const i = Math.floor((xb + PERIODE / 2) / TRONCON);
    const t = ((xb + PERIODE / 2) / TRONCON) - i;
    const k = ((i % N_TRONCONS) + N_TRONCONS) % N_TRONCONS;
    return { i, t, nature: this.natures[k] };
  }

  /** Demi-hauteur de la conduite a cette abscisse. */
  demi(x) {
    const { t, nature } = this.troncon(x);
    const f = Math.sin(clamp(t, 0, 1) * Math.PI) ** 2;
    let k = 1;
    if (nature === 'chambre') k = 1 + 0.75 * f;
    else if (nature === 'pincement') k = 1 - 0.58 * f;
    else if (nature === 'filtre') k = 1 - 0.12 * f;
    /* Une legere ondulation partout : une conduite reelle n'a pas de section
       parfaitement constante, et ca suffit a tuer l'impression de couloir de
       jeu video. */
    const xb = boucle(x);
    k *= 1 + 0.07 * Math.sin(xb * 0.0071 + this.graine) + 0.04 * Math.sin(xb * 0.019);
    return clamp(this.demiBase * k, this.demiMin, this.demiMax);
  }

  /**
   * Septum de bifurcation a cette abscisse, ou null.
   *
   * Aux tes, la conduite se separe en deux branches. Le septum est une VRAIE
   * paroi : on ne le traverse pas, on choisit un cote — et on choisit vite,
   * parce que le courant pousse.
   */
  septum(x) {
    const { t, nature } = this.troncon(x);
    if (nature !== 'bifurcation') return null;
    /* Le septum naît en pointe, s'epaissit, puis disparait : c'est un te,
       pas un mur pose en travers. */
    const f = Math.sin(clamp(t, 0, 1) * Math.PI);
    if (f < 0.12) return null;
    const demi = this.demi(x);
    return { y: 0, demi: Math.min(demi * 0.42, 6 + 26 * f) };
  }

  /**
   * Barreaux de filtre a cette abscisse, ou null.
   *
   * Une crepine : des barreaux verticaux perces d'ouvertures. Ca ne tue pas,
   * ca TRIE — on passe par les trous, et ce qui est gros passe mal.
   */
  filtre(x) {
    const { i, t, nature } = this.troncon(x);
    if (nature !== 'filtre') return null;
    /* Trois grilles par troncon, chacune large de quelques pixels. */
    for (let g = 0; g < 3; g++) {
      const centre = 0.25 + g * 0.25;
      const d = Math.abs(t - centre) * TRONCON;
      if (d > 4) continue;
      const demi = this.demi(x);
      /* Position des ouvertures, tiree par hachage : une crepine n'a pas ses
         trous alignes d'une grille a l'autre. */
      const n = 3;
      const trous = [];
      for (let k = 0; k < n; k++) {
        const c = (hash2(i * 13 + g * 5 + k, this.graine + 2) * 2 - 1) * demi * 0.72;
        trous.push({ y: c, demi: 9 + hash2(i + k, g + 7) * 7 });
      }
      return { trous, epaisseur: 4 - d };
    }
    return null;
  }

  /** Le point est-il dans une ouverture du filtre ? */
  passeFiltre(f, y) {
    for (const t of f.trous) if (Math.abs(y - t.y) < t.demi) return true;
    return false;
  }

  /**
   * Vitesse de l'ecoulement a cette abscisse, par CONSERVATION DU DEBIT.
   *
   * Le meme volume passe par chaque section : la ou la conduite se pince, le
   * courant accelere. C'est la seule loi de ce stage, et elle est suffisante
   * pour que la geometrie se lise sans un mot d'explication. Une bifurcation
   * divise la section utile en deux, donc accelere aussi.
   */
  facteurDebit(x) {
    const demi = this.demi(x);
    const s = this.septum(x);
    const utile = s ? demi - s.demi : demi;
    /* Le plafond n'est pas arbitraire : au-dela, le courant d'un pincement
       depasse la vitesse de nage du joueur et remonter devient IMPOSSIBLE,
       pas seulement couteux. Mesure a 2,6 : 88 px/s de courant contre 68 de
       nage. Une conduite doit etre dure a remonter, pas infranchissable. */
    return clamp(this.demiBase / Math.max(utile, 8), 0.5, 1.8);
  }

  /**
   * Canal autorise a cette abscisse, pour une ordonnee donnee.
   * @returns {{bas:number, haut:number}} bornes en y
   */
  canal(x, y) {
    const demi = this.demi(x);
    const s = this.septum(x);
    if (!s) return { bas: -demi, haut: demi };
    /* On reste du cote ou l'on est deja : le septum ne se traverse pas. */
    if (y >= s.y) return { bas: s.y + s.demi, haut: demi };
    return { bas: -demi, haut: s.y - s.demi };
  }
}

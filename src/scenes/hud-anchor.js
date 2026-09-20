/* ---------------------------------------------------------------------------
   Ancrage des textes de scene, TOUJOURS hors du disque de l'objectif.

   En paysage le disque touche le haut et le bas : il ne reste que les deux
   colonnes. En portrait il touche la gauche et la droite : il ne reste que
   la bande du bas. Ecrire a une position fixe faisait tomber les titres sur
   le champ dans l'une des deux orientations.
--------------------------------------------------------------------------- */

import { VIEW } from '../core/pixel.js';
import { drawText, drawTextCentered } from '../core/font.js';

/** Bloc de texte hors du disque : colonne gauche en paysage, bande du bas
 *  en portrait. Renvoie un ecrivain qui empile les lignes. */
export function sceneText(scr) {
  const cote = VIEW.mode === 'sides';
  let y = cote ? 8 : VIEW.CY + VIEW.R + 8;
  const x = 3;
  return {
    ligne(txt, col, scale = 1) {
      if (cote) drawText(scr, txt, x, y, col, 1, scale);
      else drawTextCentered(scr, txt, VIEW.CX, y, col, 1, scale);
      y += scale * 5 + 4;
      return this;
    },
    saut(n = 4) { y += n; return this; },
    get y() { return y; },
  };
}

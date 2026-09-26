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
  /* Largeur utile, en pixels. En paysage c'est la colonne a gauche du disque,
     qui va de 64 a 110 px selon la fenetre ; en portrait c'est la bande du
     bas, donc presque toute la largeur. Un paragraphe ne peut pas se couper
     sans ce chiffre, et le coder en dur donnerait juste dans une des deux
     orientations — c'est exactement le defaut que ce fichier corrige. */
  const largeur = cote ? Math.max(40, VIEW.CX - VIEW.R - 6) : VIEW.W - 6;
  const t = {
    ligne(txt, col, scale = 1) {
      if (cote) drawText(scr, txt, x, y, col, 1, scale);
      else drawTextCentered(scr, txt, VIEW.CX, y, col, 1, scale);
      y += scale * 5 + 4;
      return t;
    },
    /**
     * Un paragraphe, coupe AUX ESPACES et jamais au milieu d'un mot.
     *
     * Quatre pixels par caractere a l'echelle 1 : glyphe de 3 plus une
     * chasse de 1 (`GLYPH_W` dans font.js). On garde un plancher de huit
     * caracteres — en dessous, couper ne sert plus a rien et vaut mieux
     * deborder que rendre une colonne d'une lettre.
     */
    paragraphe(txt, col, scale = 1) {
      const n = Math.max(8, Math.floor(largeur / (4 * scale)));
      let courante = '';
      for (const mot of String(txt).split(/\s+/)) {
        if (!mot) continue;
        const essai = courante ? `${courante} ${mot}` : mot;
        if (essai.length > n && courante) { t.ligne(courante, col, scale); courante = mot; }
        else courante = essai;
      }
      if (courante) t.ligne(courante, col, scale);
      return t;
    },
    saut(n = 4) { y += n; return t; },
    get y() { return y; },
  };
  return t;
}

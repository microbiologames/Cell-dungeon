/* ---------------------------------------------------------------------------
   Bulles de fermentation : la mecanique signature des milieux ouverts.

   Dans une jarre de kombucha comme dans un levain, le CO2 produit par la
   fermentation remonte en permanence. On observe la preparation par le
   dessus : une bulle n'arrive donc pas par le cote, elle arrive PAR LA
   PROFONDEUR. Elle est d'abord un halo flou tres loin, elle passe par le
   plan de mise au point — et c'est la seule fraction de seconde ou elle est
   nette — puis elle repart flou de l'autre cote avant de creuer la surface.

   C'est la premiere fois que l'axe Z porte une menace qui n'est pas un
   organisme, et c'est ce qui rend la mecanique interessante : la mise au
   point cesse d'etre un outil de ciblage pour devenir un outil de LECTURE.
   Bien regler sa profondeur, c'est voir la bulle arriver.

   Une bulle ne blesse pas. Elle POUSSE — violemment pres de son axe, a peine
   sur son bord. On ne l'esquive pas en tirant dessus, on s'ecarte.
--------------------------------------------------------------------------- */

import { clamp, TAU } from '../core/util.js';

/** Profondeur de depart et d'arrivee. La bulle traverse tout le champ. */
const Z_DEPART = 1.35;
const Z_FIN = -1.35;

export class Bulles {
  constructor(game) {
    this.game = game;
    const cfg = game.matrix.bulles || {};
    this.liste = [];
    /* Cadence de base et cadence finale : la quantite de bulles monte avec
       la progression, c'est un des moteurs de l'intensite du stage. */
    this.debutParSec = cfg.debut ?? 0.18;
    this.finParSec = cfg.fin ?? 0.9;
    this.rMin = cfg.rMin ?? 14;
    this.rMax = cfg.rMax ?? 42;
    /* Biais vers les petites. Sans lui, une loi uniforme sur une gamme aussi
       large remplit la jarre de bulles enormes et le stage devient
       injouable ; avec, les grosses restent des evenements. */
    this.skew = cfg.skew ?? 1;
    /* Vitesse de remontee, en unites de z par seconde. Lente : une bulle de
       fermentation dans un milieu visqueux et charge ne fuse pas. */
    this.vitesseZ = cfg.vitesseZ ?? 0.30;
    this.poussee = cfg.poussee ?? 300;
    this.acc = 0;
  }

  update(dt) {
    const g = this.game;
    const p = clamp(g.progress, 0, 1);

    /* --- naissance ---------------------------------------------------- */
    const cadence = this.debutParSec + (this.finParSec - this.debutParSec) * p;
    this.acc += dt * cadence;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.naitre();
    }

    /* --- remontee et poussee ------------------------------------------ */
    for (const b of this.liste) {
      b.z -= this.vitesseZ * dt;
      /* Une bulle qui remonte grossit un peu : la pression diminue. */
      b.r = b.r0 * (1 + 0.16 * (Z_DEPART - b.z) / (Z_DEPART - Z_FIN));
      /* Derive laterale tres faible : elle monte, elle ne nage pas. */
      b.x += Math.sin(g.time * 0.6 + b.ph) * 5 * dt;
      b.y += Math.cos(g.time * 0.5 + b.ph * 1.7) * 5 * dt;
      if (b.z <= Z_FIN) b.mort = true;
      else this.pousser(b, dt);
    }
    if (this.liste.some((b) => b.mort)) this.liste = this.liste.filter((b) => !b.mort);
  }

  naitre() {
    const g = this.game;
    /* Elle apparait quelque part autour du joueur, pas forcement sous lui :
       la plupart passeront a cote, et c'est ce qui rend celles qui arrivent
       dessus lisibles. */
    const a = g.rng() * TAU;
    const r0 = this.rMin + Math.pow(g.rng(), this.skew) * (this.rMax - this.rMin);
    /* Plus la bulle est grosse, plus loin elle peut naitre : sinon les
       grosses tombent toujours sur le joueur et on ne les evite jamais. */
    const d = g.rng() * (150 + r0 * 2.2);
    this.liste.push({
      x: g.player.x + Math.cos(a) * d,
      y: g.player.y + Math.sin(a) * d,
      z: Z_DEPART,
      r0,
      r: r0,
      ph: g.rng() * TAU,
      mort: false,
    });
  }

  /**
   * Pousse tout ce qui se trouve sur le passage.
   *
   * L'intensite depend de deux choses : la distance a l'AXE de la bulle, et
   * la proximite du plan. Une bulle encore loin en profondeur ne pousse pas
   * — elle previent. C'est pour ca qu'elle est lisible : on a le temps de
   * s'ecarter si on regarde au bon endroit.
   */
  pousser(b, dt) {
    const g = this.game;
    /* Fenetre de passage : elle ne brasse qu'en traversant le plan. */
    const proche = 1 - clamp(Math.abs(b.z) / 0.55, 0, 1);
    if (proche <= 0) return;
    b.actif = proche;

    /* Le fluide chasse deborde la bulle : une bulle qui monte pousse aussi
       ce qui la borde, pas seulement ce qu'elle percute. Limiter la poussee
       a son rayon geometrique donnait un effet qu'on ne sentait pas. */
    const R = b.r * 1.7;
    const souffle = (o, masse) => {
      const dx = o.x - b.x, dy = o.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d > R) return;
      /* Exposant 1,3 et non 2 : au carre, seul l'axe exact poussait et tout
         le reste de la bulle etait inerte. La vague a un front large. */
      const k = Math.pow(1 - d / R, 1.3);
      const nx = d > 0.01 ? dx / d : Math.cos(b.ph);
      const ny = d > 0.01 ? dy / d : Math.sin(b.ph);
      /* `proche` au carre : la vague culmine au passage du plan et retombe
         vite. C'est ce qui la fait passer comme une vague et non comme un
         courant permanent. */
      const f = (this.poussee * k * proche * proche) / masse;
      o.vx += nx * f * dt;
      o.vy += ny * f * dt;
    };

    souffle(g.player, 1);
    for (const e of g.enemies) {
      if (!e.alive || e.spec.immobile) continue;
      /* La masse en VOLUME etait un contresens. Ce qui pousse n'est pas un
         choc mais le fluide que la bulle chasse devant elle — et un corps
         de meme densite que le milieu suit ce fluide, quelle que soit sa
         taille. Seule son inertie devant la trainee le fait trainer un peu.
         L'exposant 3 rendait toute baleine strictement inamovible : une
         moisissure de rayon 38 encaissait 1400 fois moins que le joueur, et
         la vague passait a travers elle sans rien deplacer. */
      souffle(e, Math.max(1, Math.pow(e.radius / 3.4, 0.9)));
    }
    for (const k of g.pickups) if (k.alive) souffle(k, 0.7);
  }
}

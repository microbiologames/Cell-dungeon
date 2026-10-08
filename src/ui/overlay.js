/* ---------------------------------------------------------------------------
   Interfaces en DOM : titre, cartes d'evolution, pause, fin de partie.
   Le jeu est en pixels dans le canvas, les textes longs sont en HTML :
   une fonte 3x5 ne peut pas porter une description d'evolution.

   La partie en cours change au fil des scenes : l'overlay ne garde donc
   PAS de reference a une partie, il en demande une quand il en a besoin.
--------------------------------------------------------------------------- */

import { RARITY } from '../data/evolutions.js';
import { RARITY_HEX } from '../data/palette.js';
import { mmss } from '../core/util.js';
import { CARD_ART } from './card-art.js';
import { son } from '../audio/son.js';

const $ = (id) => document.getElementById(id);

export class Overlay {
  /**
   * @param {() => void} onExit  retour au lobby
   */
  constructor(onExit) {
    this.onExit = onExit;
    this.getGame = () => null;
    this.els = {
      menu: $('ovMenu'), level: $('ovLevel'), pause: $('ovPause'), end: $('ovEnd'),
      cards: $('lvCards'), title: $('lvTitle'), reroll: $('btnReroll'),
      endTitle: $('endTitle'), endStats: $('endStats'), pauseStats: $('pauseStats'),
      menuKeys: $('menuKeys'),
    };
    $('btnStart').onclick = () => {
      /* SEUL point d'entree du son : la politique d'autoplay des navigateurs
         exige un geste utilisateur pour ouvrir un AudioContext. */
      son.init();
      this.hideAll();
    };
    $('btnRetry').onclick = () => onExit();
    $('btnResume').onclick = () => this.resume();
    $('btnQuit').onclick = () => onExit();
    this.els.reroll.onclick = () => {
      const g = this.getGame();
      if (g && g.reroll()) this.showLevelUp();
    };

    /* Curseur d'overlay : l'index de la cible retenue dans l'ecran ouvert.
       C'est le seul chemin vers COMMENCER, REPRENDRE, QUITTER et les cartes
       quand il n'y a ni souris ni clavier — donc le chemin de la borne, dont
       l'encodeur n'envoie que des axes et des boutons. */
    this.curseur = 0;
    this.majLibelleCommandes(false);

    /* Les chiffres restent le raccourci du clavier : une carte, une touche.
       Ils ne remplacent pas le curseur, ils doublent. */
    addEventListener('keydown', (e) => {
      if (this.current !== 'level') return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9) this.els.cards.children[n - 1]?.click();
    });
  }

  hideAll() {
    for (const el of Object.values(this.els)) el.classList?.remove('on');
    this._oublierCurseur();
    this.current = null;
  }

  show(which) {
    this.hideAll();
    this.els[which]?.classList.add('on');
    this.current = which;
    /* Un ecran s'ouvre AVEC une cible deja designee : sur la borne, un
       premier appui doit valider quelque chose, pas reveiller un curseur
       invisible. */
    this._poserCurseur(0);
  }

  /**
   * Libelle des commandes de l'ecran-titre. Trois mondes, trois phrases :
   * la manette passe devant le tactile des qu'une manette se declare, parce
   * qu'une borne d'arcade a un ecran tactile dans aucun cas et que c'est
   * pourtant ce que `pointer: coarse` laissait croire sur certains kiosques.
   */
  majLibelleCommandes(hasPad) {
    if (!this.els.menuKeys) return;
    this.els.menuKeys.textContent = hasPad
      ? 'JOYSTICK GAUCHE : NAGER — JOYSTICK DROIT HAUT/BAS : MISE AU POINT — BOUTON : DASH'
      : (matchMedia('(pointer: coarse)').matches
        ? 'GAUCHE : DEPLACER — DROITE : MISE AU POINT'
        : 'WASD/ZQSD DEPLACER — MOLETTE OU R/F MISE AU POINT — ESPACE DASH');
  }

  /* --- Curseur ----------------------------------------------------------- */

  /** Les cibles de l'ecran ouvert, dans l'ordre du DOM, invisibles exclues. */
  _cibles() {
    const el = this.els[this.current];
    if (!el) return [];
    /* offsetParent est nul pour un element cache : c'est ce qui ecarte le
       bouton de relance du transposon quand le joueur ne l'a pas. */
    return [...el.querySelectorAll('.card, .btn')].filter((b) => b.offsetParent !== null);
  }

  _oublierCurseur() {
    for (const el of Object.values(this.els)) {
      el?.querySelectorAll?.('.sel').forEach((b) => b.classList.remove('sel'));
    }
  }

  _poserCurseur(i) {
    const cibles = this._cibles();
    this._oublierCurseur();
    if (!cibles.length) { this.curseur = 0; return; }
    /* Bouclage, pas butee : sur une borne on ne doit jamais pouvoir coincer
       le curseur contre un bord qu'on ne voit pas bouger. */
    this.curseur = ((i % cibles.length) + cibles.length) % cibles.length;
    const cible = cibles[this.curseur];
    cible.classList.add('sel');
    cible.scrollIntoView?.({ block: 'nearest' });
  }

  /**
   * Un tour de navigation sans souris, appele par la boucle principale.
   * @param {{dy: number, valider: boolean}} m  cap et validation consommes
   */
  naviguer(m) {
    if (!this.current || (!m.dy && !m.valider)) return;
    if (m.dy) this._poserCurseur(this.curseur + m.dy);
    if (m.valider) this._cibles()[this.curseur]?.click();
  }

  resume() {
    const g = this.getGame();
    this.hideAll();
    if (g) g.state = 'playing';
  }

  showLevelUp() {
    const g = this.getGame();
    if (!g) return;
    const p = g.player;
    this.els.title.textContent = `NIVEAU ${p.level}`;
    this.els.cards.innerHTML = '';
    for (const [i, evo] of (g.hand || []).entries()) {
      const rank = p.taken.get(evo.id) || 0;
      const btn = document.createElement('button');
      btn.className = 'card';
      btn.type = 'button';
      const col = RARITY_HEX[evo.rarity] || '#cfe6d8';
      btn.style.borderLeft = `3px solid ${col}`;
      /* L'illustration est FACULTATIVE. On ne demande QUE les fichiers
         presents (CARD_ART est genere depuis assets/cards/) : sinon chaque
         carte sans vignette provoquait un 404, et ces erreurs attendues
         noyaient les vraies dans la console. */
      const art = CARD_ART.has(evo.id)
        ? `<img class="art" src="assets/cards/${encodeURIComponent(evo.id)}.png" alt="">`
        : '';
      btn.innerHTML = `
        <div class="body">
          ${art}
          <div class="txt">
            <div class="top">
              <span class="name">${i + 1}. ${escapeHtml(evo.label)}</span>
              <span class="rar" style="color:${col}">${RARITY[evo.rarity].label}</span>
            </div>
            <div class="desc">${escapeHtml(evo.desc)}</div>
            ${rank ? `<div class="rank">RANG ${rank} / ${evo.ranks}</div>` : ''}
            ${evo.note ? `<div class="note">${escapeHtml(evo.note)}</div>` : ''}
          </div>
        </div>`;
      btn.onclick = () => {
        this.hideAll();
        g.chooseEvolution(evo.id);
        if (g.state === 'levelup') this.showLevelUp();
      };
      this.els.cards.appendChild(btn);
    }
    const canReroll = p.flags.has('transposon') && !p.rerollUsed;
    this.els.reroll.style.display = canReroll ? '' : 'none';
    this.show('level');
  }

  showPause() {
    this.els.pauseStats.innerHTML = this.statBlock();
    this.show('pause');
  }

  showEnd(won) {
    this.els.endTitle.textContent = won ? 'MATRICE SURVECUE' : 'LYSE';
    this.els.endStats.innerHTML = this.statBlock();
    this.show('end');
  }

  statBlock() {
    const g = this.getGame();
    if (!g) return '';
    const p = g.player;
    const evos = p.summary()
      .map(({ evo, rank }) => `${escapeHtml(evo.label)}${rank > 1 ? ` x${rank}` : ''}`)
      .join(' · ');
    /* Le bilan de la caracteristique unique : combien de spores brulees,
       combien de divisions. C'est l'histoire de la partie en un chiffre, et
       ca n'existe nulle part ailleurs — les evolutions perdues a une division
       ne laissent aucune trace dans la liste ci-dessous. */
    const trait = p.espece.trait ? traitBilan(p) : '';
    return `
      <p class="stat">SOUCHE <b>${escapeHtml(p.espece.label)}</b>${trait}</p>
      <p class="stat">SCORE <b>${g.score}</b></p>
      <p class="stat">TEMPS <b>${mmss(g.time)}</b> — NIVEAU <b>${p.level}</b> — TUES <b>${p.kills}</b></p>
      <p class="stat">DEGATS <b>${p.stats.dmg.toFixed(1)}</b> — CADENCE <b>${p.fireRate.toFixed(2)}/s</b>
         — PV <b>${Math.round(p.stats.maxHp)}</b> — VITESSE <b>${Math.round(p.stats.speed)}</b></p>
      <p class="stat" style="margin-top:6px">${evos || 'AUCUNE EVOLUTION'}</p>`;
  }
}

/** Une phrase courte sur l'etat de la caracteristique unique. */
function traitBilan(p) {
  if (p.trait === 'sporulation') {
    return ` — SPORES <b>${p.spores}</b> EN RESERVE, <b>${p.sporesBrulees}</b> CONSOMMEES`;
  }
  if (p.trait === 'amas') return ` — AMAS <b>${p.amasVivant}</b> / ${p.amasMax}`;
  if (p.trait === 'bourgeonnement') {
    return ` — DIVISIONS <b>${p.divisions}</b>, BOURGEON <b>${Math.round(p.bourgeon * 100)} %</b>`;
  }
  return '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

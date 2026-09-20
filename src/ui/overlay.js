/* ---------------------------------------------------------------------------
   Interfaces en DOM : menus et cartes d'evolution.
   Le jeu est en pixels dans le canvas, les textes longs sont en HTML :
   une fonte 3x5 ne peut pas porter une description d'evolution.
--------------------------------------------------------------------------- */

import { RARITY } from '../data/evolutions.js';
import { RARITY_HEX } from '../data/palette.js';
import { mmss } from '../core/util.js';

const $ = (id) => document.getElementById(id);

export class Overlay {
  constructor(game, onStart) {
    this.game = game;
    this.onStart = onStart;
    this.els = {
      menu: $('ovMenu'), level: $('ovLevel'), pause: $('ovPause'), end: $('ovEnd'),
      cards: $('lvCards'), title: $('lvTitle'), reroll: $('btnReroll'),
      endTitle: $('endTitle'), endStats: $('endStats'), pauseStats: $('pauseStats'),
      menuKeys: $('menuKeys'),
    };
    $('btnStart').onclick = () => onStart();
    $('btnRetry').onclick = () => onStart();
    $('btnResume').onclick = () => this.resume();
    $('btnQuit').onclick = () => { this.hideAll(); this.show('menu'); };
    this.els.reroll.onclick = () => { if (game.reroll()) this.showLevelUp(); };

    this.els.menuKeys.textContent = game.input && game.input.hasTouch
      ? 'GAUCHE : DEPLACER — DROITE : MISE AU POINT'
      : 'WASD/ZQSD DEPLACER — MOLETTE OU R/F MISE AU POINT — ESPACE DASH';

    addEventListener('keydown', (e) => {
      if (this.current !== 'level') return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9) {
        const btn = this.els.cards.children[n - 1];
        if (btn) btn.click();
      }
    });
  }

  hideAll() {
    for (const el of Object.values(this.els)) el.classList?.remove('on');
    this.current = null;
  }

  show(which) {
    this.hideAll();
    this.els[which]?.classList.add('on');
    this.current = which;
  }

  resume() {
    this.hideAll();
    this.game.state = 'playing';
  }

  showLevelUp() {
    const g = this.game;
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
      /* L'illustration est FACULTATIVE : si assets/cards/<id>.png n'existe
         pas, l'image se retire d'elle-meme et la carte reste identique a
         avant. Les vignettes peuvent donc arriver une par une. */
      btn.innerHTML = `
        <div class="body">
          <img class="art" src="assets/cards/${encodeURIComponent(evo.id)}.png" alt=""
               onerror="this.remove()">
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
    const g = this.game;
    const p = g.player;
    const evos = p.summary()
      .map(({ evo, rank }) => `${escapeHtml(evo.label)}${rank > 1 ? ` x${rank}` : ''}`)
      .join(' · ');
    return `
      <p class="stat">TEMPS <b>${mmss(g.time)}</b> — NIVEAU <b>${p.level}</b> — TUES <b>${p.kills}</b></p>
      <p class="stat">DEGATS <b>${p.stats.dmg.toFixed(1)}</b> — CADENCE <b>${p.fireRate.toFixed(2)}/s</b>
         — PV <b>${Math.round(p.stats.maxHp)}</b> — VITESSE <b>${Math.round(p.stats.speed)}</b></p>
      <p class="stat" style="margin-top:6px">${evos || 'AUCUNE EVOLUTION'}</p>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

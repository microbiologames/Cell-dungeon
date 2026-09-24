/* ---------------------------------------------------------------------------
   Jauge processeur : un seul nombre, comparable entre deux machines.

   A quoi elle sert. Le rendu de Cell Dungeon est LOGICIEL et MONO-COEUR :
   un Uint32Array, huit calques floutes separement, une composition, un
   putImageData. Le processeur graphique ne fait que l'agrandissement final.
   La question "quelle machine pour la borne ?" se ramene donc a une seule
   grandeur : la vitesse mono-coeur en entiers sur un grand tableau, qui est
   exactement ce que fait le compositeur.

   Comment s'en servir :

     node tools/jauge.mjs          sur cette machine-ci
     node tools/jauge.mjs          sur la machine candidate (Pi, mini-PC...)

   puis on compare. tools/perf.mjs mesure les millisecondes par image ICI et
   imprime le seuil de jauge a ne pas depasser sur la cible. Rien n'est
   extrapole : les deux bouts sont mesures.

   Node suffit : ni navigateur, ni Playwright, ni le depot complet. Ce fichier
   se copie seul sur une carte SD.

   Pourquoi le MINIMUM de plusieurs passes, et non la moyenne : sur une
   machine partagee, la contention n'ajoute que du temps, jamais n'en retire.
   Deux relevés consecutifs de ce banc ont donne 169 puis 121 ms sur le meme
   processeur — 40 % d'ecart, entierement du bruit de voisinage. Le minimum
   est le seul estimateur qui ne bouge pas.
--------------------------------------------------------------------------- */

/** Une passe : 8 balayages d'un tableau de 4 Mi entiers, en lecture-ecriture.
 *  Taille choisie pour DEBORDER les caches de dernier niveau (16 Mio), comme
 *  le fait le compositeur avec ses huit calques : un banc qui tient en cache
 *  mesure le cache, pas la machine, et flatterait un petit processeur. */
export function passe() {
  const N = 1 << 22;
  const buf = new Uint32Array(N);
  const t0 = performance.now();
  for (let k = 0; k < 8; k++) {
    for (let i = 0; i < N; i++) buf[i] = (buf[i] * 1664525 + 1013904223 + i) >>> 0;
  }
  return { ms: performance.now() - t0, temoin: buf[0] };
}

export function jauge(passes = 3) {
  let best = Infinity, temoin = 0;
  for (let i = 0; i < passes; i++) {
    const r = passe();
    if (r.ms < best) best = r.ms;
    temoin = r.temoin;   // empeche l'elimination de la boucle par le compilateur
  }
  return { ms: Math.round(best), temoin };
}

/* Execute directement : on imprime le chiffre et de quoi identifier la
   machine, parce qu'une jauge sans sa machine ne se compare a rien. */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { ms } = jauge(Number(process.argv[2] || 3));
  const os = await import('node:os');
  const cpu = os.cpus()[0];
  console.log(`jauge : ${ms} ms   (plus bas = plus rapide)`);
  console.log(`machine : ${cpu ? cpu.model.trim() : 'inconnue'}`
    + ` x${os.cpus().length}   ${os.arch()}   node ${process.versions.node}`);
  console.log(`memoire : ${Math.round(os.totalmem() / 2 ** 30)} Gio`);
}

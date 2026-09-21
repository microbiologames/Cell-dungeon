# Ce qu'on reprend de `wet-mount.html`, et ce qu'on jette

`wet-mount.html` est un **simulateur d'observation contemplatif** : peu
d'organismes, aucune urgence, et la justesse optique est la récompense.
Cell Dungeon est un **jeu d'action** : trois cents entités, des décisions en
150 ms, et la lisibilité prime. Plusieurs choix excellents dans le premier
sont donc de mauvais choix dans le second. Audit :

---

## ⚠️ Révisé — le fond noir n'est pas universel

> **J'avais tort sur un point, et il faut le dire.** Ce document rejetait le
> fond clair et imposait le fond noir partout. Or **le lait cru est blanc** :
> l'observer sur fond noir est contre-intuitif, et ça se voit immédiatement
> à l'écran.
>
> Mon objection portait en réalité sur le **contraste**, pas sur le fond. Un
> état frais non coloré a 8 % de contraste et c'est illisible — mais un
> **frottis coloré** en fond clair est parfaitement lisible : une coloration
> de Gram donne des cellules franches sur un fond pâle.
>
> La règle corrigée n'est donc pas « fond noir », c'est :
> **le mode d'observation suit le milieu, et le contraste vient de la
> coloration.**
>
> | Matrice | Milieu | Mode | Organismes |
> |---|---|---|---|
> | Lait cru | blanc | **fond clair** | **sombres**, colorés |
> | Conduite, kombucha, sang | sombres | **fond noir** | **lumineux**, marquage vital |
>
> `src/data/palette.js` porte un `mode` par matrice (`'bright'` / `'dark'`)
> et deux jeux de couleurs complets. Le rendu s'y adapte à trois endroits :
>
> - **le halo de défocalisation** : en fond clair il n'y en a pas. Un objet
>   hors plan s'étale et fonce ; l'anneau lumineux est propre au contraste
>   de phase, donc réservé à l'évolution du même nom ;
> - **l'opacité des zones** : sur fond clair, une zone opaque devient de la
>   peinture. Elles sont gardées bien plus translucides ;
> - **le plancher d'opacité des organismes flous** : sans lui, le gain
>   appliqué après le flou faisait des boules sombres plus lourdes que les
>   organismes nets. En fond clair, ce qui est hors plan se **fond** dans le
>   milieu.
>
> Le HUD, lui, ne change jamais : il vit sur le pourtour noir de l'objectif,
> quel que soit le mode. `UI` est donc un jeu de couleurs distinct des
> palettes de matrice.
>
> **Deux pièges dormants que le passage au clair a réveillés**, tous deux
> invisibles tant que le milieu était noir :
>
> - `beginFrame` remplissait **tout le tampon** avec la couleur du milieu.
>   Le pourtour se peignait donc en crème et le HUD devenait illisible. On
>   peint maintenant le noir partout, puis le milieu **dans le disque**.
> - Le détourage du joueur était un disque **noir en dur**, ajouté pour le
>   détacher de la foule lumineuse. Sur le lait, il laissait une tache noire.
>   Il a fini par être **supprimé** : la caméra est verrouillée sur le
>   joueur, qui occupe donc toujours le centre exact du champ. On ne peut
>   pas le perdre, et le halo ne résolvait aucun problème réel — il posait
>   seulement un disque étranger sur le milieu.
>
> La leçon est générale : **une couleur écrite en dur est une hypothèse sur
> le fond**. Tout ce qui est dessiné dans le champ doit venir de la palette
> de la matrice.

## ❌ Rejeté — la palette d'état frais (dans les matrices sombres)

Dans `wet-mount`, tout est gris-beige translucide sur crème. C'est **le sujet
même** du simulateur : un état frais n'est pas coloré, on ne voit presque rien,
et apprendre à regarder est l'exercice.

Dans un jeu d'action, c'est disqualifiant. Le joueur doit distinguer en une
fraction de seconde un mob d'un globule gras, son tir d'un tir ennemi, un
ennemi net d'un ennemi flou. Une palette à 8 % de contraste rend ça impossible.

**À la place — fond noir (darkfield) + fluorochromes.** On ne joue pas en
fond clair, on joue en **microscopie sur fond noir avec marquage vital**. Ce
sont deux techniques réelles :

- **Fond noir** : le condenseur n'éclaire que de la lumière oblique, seule la
  lumière diffractée par les objets entre dans l'objectif. Résultat : des
  organismes **lumineux sur fond parfaitement noir**, à très fort contraste.
- **Double marquage.** Les cellules sont révélées à l'**orange d'acridine**
  (vivantes en vert). Les **acides aminés libres**, eux, ne sont pas des
  acides nucléiques : ils sont révélés à l'**o-phtalaldéhyde**, la méthode
  OPA, qui est précisément l'essai standard de protéolyse en laiterie.

Ce choix règle trois problèmes d'un coup :

| Problème | Résolution |
|---|---|
| Lisibilité des menaces | Contraste maximal, organismes lumineux |
| Les « zones noires » du HUD | Ce n'est plus un cache arbitraire : **c'est le champ réel** |
| Le butin au sol doit se voir | La méthode OPA révèle littéralement les acides aminés libres |

Le joueur est **vert** (vivant), les acides aminés ramassables sont **ambrés**,
et les halos de flou brillent au lieu de se délaver.

> Une réserve, notée plutôt que cachée : les dérivés OPA émettent en réalité
> dans le bleu, pas dans l'ambre. La teinte est choisie pour la lisibilité,
> le bleu et le cyan étant déjà pris par des rôles de menace. C'est la même
> catégorie de déviation que l'échelle : documentée, pas dissimulée.

## ❌ Rejeté — l'échelle optique littérale

`wet-mount` est à l'échelle : nombre de champ 20, objectif ×1000 → champ de
160 µm, profondeur de champ 1.5 µm. C'est pédagogiquement irréprochable.

Mais à l'échelle réelle, *Listeria* (1.5 × 0.5 µm) est **plus petite** qu'un
lactocoque en chaînette, et une levure fait dix fois la taille du joueur. On
ne peut pas construire un boss avec ça.

**À la place** : échelle **relative** plausible, pas littérale. On conserve
l'ordre de grandeur (phage ≪ bactérie ≪ levure ≪ protozoaire) et on triche
sur les facteurs. La profondeur `z` devient un axe **abstrait et normalisé**
`[-1 ; +1]`, pas des micromètres. Le HUD n'affiche jamais de µm : il n'y a
donc aucun mensonge, juste un silence.

## ❌ Rejeté — le flou par tramage aléatoire

`wet-mount` rend le flou en supprimant des pixels au hasard
(`nz(x*7+13, y*11+5) < BLUR*0.8`) et en délavant vers le fond. Le bruit est
en **espace écran**, donc stable tant que l'objet ne bouge pas — ce qui est
le cas dans un simulateur où l'on tourne des molettes.

Dès qu'un objet traverse l'écran à 90 px/s, ses pixels tombent sur des valeurs
de bruit différentes à chaque image : ça **grésille**. C'est précisément ce que
tu as identifié en disant que « les effets de flou seraient à améliorer ».

**À la place**, trois changements :

1. **Vrai flou séparable** (deux passes de boîte) appliqué à des *calques* de
   profondeur, pas à des pixels isolés. Sur un tampon de 256 × 352, c'est
   négligeable en coût et c'est un flou optique, pas une dissolution.
2. **Tramage ordonné de Bayer 4 × 4** au lieu du bruit de hachage, pour la
   quantification. Stable en espace écran **et** régulier : on garde le grain
   pixel art sans le grésillement.
3. **Halo de contraste de phase** : un objet hors du plan focal ne s'efface
   pas, il **s'entoure d'un anneau lumineux**. C'est ce que fait réellement un
   objet défocalisé, et ça rend les menaces hors plan lisibles au lieu de les
   effacer — exactement ce que demande la mécanique de mise au point.

## ❌ Rejeté — le tracé pixel par `fillRect`

`plot()` appelle `fillStyle` + `fillRect(x,y,1,1)` par pixel. Pour quarante
organismes lents, c'est parfait et c'est simple.

Pour trois cents entités plus les projectiles, c'est quelques centaines de
milliers d'appels de contexte par image. **À la place** : un tampon
`Uint32Array` écrit directement, composité une fois par `putImageData`.

## ❌ Rejeté — le monde torique

`wet-mount` enroule la préparation (`wrapD`) : on se balade sans fin. Dans une
arène, un monde qui boucle rend la fuite gratuite et **désamorce la mort par
saturation**, qui est le cœur de l'équilibrage (voir `04-vagues-equilibrage.md`).

**À la place** : arène **bornée** par le ménisque de la goutte, avec une
poussée de rappel élastique aux bords. On peut être acculé — c'est le but.

> **Révision après test.** L'arène faisait 560 px de rayon pour un champ
> visible de 110 : on butait sans arrêt sur le bord, et le monde paraissait
> minuscule. Elle est passée à **1600**, soit une centaine de fois la surface
> visible. Le bord redevient un événement plutôt qu'une clôture.
>
> L'option du monde torique a été réexaminée à cette occasion et écartée à
> nouveau, pour la même raison qu'au départ : dans une arène qui boucle, fuir
> indéfiniment est gratuit, ce qui désamorce la mort par saturation sur
> laquelle repose tout le décrochage final (`04-vagues-equilibrage.md`).
> Agrandir règle le problème ressenti — l'espace — sans toucher à celui-là.
> Le coût est nul : le directeur ne peuple que les environs du joueur, et la
> grille de pH ne fait diffuser qu'une fenêtre autour de lui.

---

## ✅ Gardé — et pourquoi ça tient

| Élément | Pourquoi ça survit |
|---|---|
| Vocabulaire `kind` (`rod`, `chain`, `cluster`, `bud`, `spore`, `arthro`, `hypha`…) | Bonne taxonomie morphologique, et langage commun aux deux projets |
| Vocabulaire `mot` (`brown`, `swim`, `tumble`, `glide`) | Idem, et `tumble` décrit vraiment *Listeria* |
| Tampon basse résolution agrandi au plus proche voisin | C'est la DA, et ça borne le coût de rendu |
| Amplitude brownienne en `1/√taille` | C'est **physiquement juste** (Stokes-Einstein) : les petits objets s'agitent plus. Joli détail gratuit |
| Génération procédurale par hachage de coordonnées | Décor (globules gras, débris) infiniment dense à coût mémoire nul |
| La flore du lait cru | Bien documentée, réutilisée telle quelle |
| Le champ circulaire | Gardé, mais il change de nature : c'est l'ouverture du fond noir |

---

## Le principe de l'arbitrage

Quand la justesse scientifique et la lisibilité s'opposent, on cherche
**d'abord une technique réelle qui règle les deux**. Le fond noir et l'orange
d'acridine en sont l'exemple : on n'a pas sacrifié la microbiologie pour la
lisibilité, on a changé de technique d'observation.

Quand aucune technique ne concilie les deux, la lisibilité gagne et **on
l'écrit dans la doc** plutôt que de faire semblant. C'est le cas de l'échelle.

---

## La brusquerie venait de l'ENTRÉE, pas du rendu

Signalé après un test sur téléphone : au joystick virtuel, les changements de
direction sont fluides ; au clavier, ils sont secs. Le diagnostic est dans
cette différence, et il ne pointe pas vers le moteur de rendu.

**Le clavier ne produit que huit directions.** Chaque appui fait donc sauter
le cap visé de 45° d'un coup. Le joystick, lui, balaie l'angle en continu et
le problème ne se pose jamais. Sans inertie de direction, le jeu applique ce
saut tel quel : le corps se téléporte d'un cap à l'autre en une image, et
toutes les animations qui en dépendent sautent avec lui.

### Ce qu'on regarde pour trancher : la trajectoire

Pas le sprite qui pivote — le **chemin parcouru**.
`node tools/trajectoire.mjs` rejoue la même séquence de neuf touches pour
plusieurs agilités et superpose les chemins.

| Constat | Lecture |
|---|---|
| Avant, agilité de base : le chemin a des **angles** | C'est la brusquerie ressentie |
| Après, agilité de base : le chemin a des **courbes** | C'est le correctif, et il se voit |
| Avant **et** après, flagellation polaire : le chemin **boucle** | Ce n'est pas la giration, c'est l'inertie de **translation** (τ = 0,53 s pour un appui de 0,75 s). Ça existait déjà, et c'est le caractère assumé de ce build |

La dernière ligne compte autant que les autres : on a failli « corriger » un
comportement qui précédait le changement et qui est voulu.

### Le réglage appartient à l'agilité, une stat qui existe déjà

Pas une constante de rendu : la **stat d'agilité**, que deux évolutions de
flagellation pilotent déjà (`peritriche` +22 %, `polaire` −18 % par rang). Le
niveau de base est bas exprès — une cellule non évoluée nage mollement du
gouvernail, et c'est ce qu'on veut voir.

Une mesure a tranché la formule : le temps de giration se déduit de
**l'agilité seule**, pas de `vitesse / agilité` comme pour la translation. La
flagellation polaire monte la vitesse *et* baisse l'agilité, si bien que le
temps de translation s'étale d'un facteur six entre les deux extrêmes.
Reporté tel quel sur la giration, il donnait **4,75 s pour un demi-tour** :
injouable. Rapporté à l'agilité seule, l'éventail se resserre à un facteur
trois et reste jouable aux deux bouts.

### Le coût en équilibrage : nul

Vérifié à graines identiques, cinq runs, contre un témoin à giration quasi
instantanée :

| | Témoin | Retenu |
|---|---|---|
| Lait cru | 28 / 33 / 69 | 23 / 30 / 64 |
| Conduite | 67 / 222 / 210 | 76 / 223 / 209 |

L'écart est dans le bruit. Une amélioration de toucher qui ne coûte rien à la
courbe de difficulté : c'est le cas rare où il n'y a pas d'arbitrage.

## Un flagelle est la mémoire du chemin de sa cellule

À très bas nombre de Reynolds, un filament passif tracté ne fait pas ce qu'il
veut : **il suit le chemin de sa base**. Les forces visqueuses dominent
tellement l'inertie que chaque tronçon se range dans la trace laissée par le
précédent. Un flagelle est donc, littéralement, l'historique récent de
l'orientation de la cellule — exactement comme la queue d'un serpent repasse
là où est passée sa tête.

On garde donc une demi-seconde de cap par cellule (`Sillage`, en valeur
*déroulée* pour que l'interpolation ne fasse pas le tour du cadran), et on
intègre le filament le long de cette mémoire : à l'abscisse `t`, sa direction
est celle qu'avait la cellule il y a `t × 0,24 s`.

Trois comportements en découlent, et tous les trois sont observés :

- **Course.** Le faisceau se rassemble derrière la cellule — les ancrages
  eux-mêmes convergent vers le pôle arrière, parce qu'un faisceau péritriche
  n'est pas six filaments parallèles, c'est six filaments qui se rejoignent.
- **Virage.** La queue balaie en retard puis rattrape. C'est gratuit : c'est
  le sillage qui le produit, on n'a rien à animer.
- **Arrêt brutal.** Le moteur s'arrête (la fréquence tombe de 33 à 1,4 rad/s)
  mais les filaments continuent sur leur lancée, se déphasent et s'ouvrent,
  puis se recalent en une demi-seconde. C'est le `trouble`, alimenté par le
  freinage et par la vitesse angulaire.

Deux mesures payées au passage : à amplitude quasi nulle, un filament au repos
sortait comme un **trait rigide**, ce qui est le contraire de l'effet voulu —
c'est la **fréquence**, pas l'amplitude, qui dit si le moteur tourne. Et sans
rassemblement des ancrages, la course sortait comme une touffe et pas comme
une corde.

# 09 — La borne microscope

Cell Dungeon finit sa vie en **borne d'arcade déguisée en microscope** : un
joystick pour nager, une molette pour la mise au point, une boîte de Petri
rétroéclairée sous l'objectif dont la couleur suit le stage, et un écran à la
place de l'oculaire.

Ce document tient le plan. Il commence par ce que la **mesure** a tranché,
parce que deux des questions posées au départ — « quel Raspberry Pi ? » et
« tiendra-t-il avec beaucoup de mobs ? » — ont une réponse chiffrée, et que
cette réponse n'est pas celle qu'on attendait.

---

## 1. Ce que la mesure a déjà tranché

Banc : `npm run perf` (`tools/perf.mjs`). Il rejoue la vraie boucle avec le
pilote automatique de `playtest`, aux quatre moments du run, et chronomètre
le travail **processeur** par image, hors attente d'affichage. `npm run smoke`
ne pouvait pas répondre : `requestAnimationFrame` plafonne à 60 et une machine
à 4 ms comme une machine à 16 ms y affichent le même « 60 ».

Relevé sur la machine de référence (Xeon 2,8 GHz, jauge 104 ms), matrice
lait cru, médiane sur 240 images après échauffement :

| Ce qu'on mesure | Résultat |
|---|---|
| Logique de jeu (directeur, collisions, pH, décor, IA) | **0,10 ms** — constant |
| Rendu (8 calques, flou, composition, `putImageData`) | **5,0 à 7,6 ms** |
| Part du rendu dans le total | **97 à 99 %** |
| Effet de la foule : 7 mobs → 36 mobs | **×1,3** pour ×5 de population |
| Effet du format d'écran (carré → 21:9) | **×1,25**, pour ×2,3 de pixels |

### Trois conséquences, toutes contre-intuitives

**1. « Beaucoup de mobs » n'est pas le critère de dimensionnement.**
Multiplier la population par cinq ne coûte que 30 % de temps en plus. Le gros
du coût est un **plancher** : huit calques floutés et composités, payés que le
champ soit vide ou plein. Dimensionner la machine « pour la foule » revient à
se tromper de grandeur — c'est le plancher qu'il faut tenir, et il est là dès
la première seconde du run.

**2. Le GPU ne servira à rien, et la RAM non plus.**
Le rendu est **logiciel et mono-cœur** : un `Uint32Array`, un flou de boîte
séparable par calque, une composition, un `putImageData`. Le processeur
graphique ne fait que l'agrandissement final, qui est gratuit. Trois cœurs sur
quatre resteront inutilisés. Le jeu tient dans quelques mégaoctets. **Le seul
chiffre qui compte est la vitesse mono-cœur en entiers.**

**3. Le format de l'écran coûte 25 %, pas un facteur deux.**
`computeLayout` fait dépendre la taille du tampon du format de la fenêtre : un
écran carré demande 76 800 pixels, un 21:9 en demande 176 800. On pouvait donc
croire le format décisif. Mesuré, l'écart tombe à 25 % — parce que le
compositeur travaille par **rectangle sale**, et qu'en paysage c'est le HUD des
colonnes latérales qui étend ce rectangle à toute la largeur, pas le champ.
Les dispositions portrait (`bottom`) sont ~25 % moins chères que les paysage
(`sides`). C'est réel mais secondaire : **choisir l'écran sur l'ergonomie, pas
sur ces 25 %** — sauf si la marge s'avère serrée sur la machine retenue.

### Les seuils, pour choisir la machine sans parier

`tools/jauge.mjs` est un banc de calcul pur, mono-cœur, sur un tableau qui
déborde les caches — exactement le profil du compositeur. Il ne demande que
`node` : il se copie seul sur une carte SD, sans navigateur ni dépôt.

```
node tools/jauge.mjs      # ici, puis sur la machine candidate
```

`npm run perf` imprime les seuils à ne pas dépasser sur la cible. Au dernier
relevé (pire médiane 7,0 ms pour une jauge de 104 ms) :

| Objectif | Jauge maximale de la machine cible |
|---|---|
| Confortable — médiane sous la moitié du budget (8,3 ms) | **≤ 124 ms** |
| 60 Hz sans marge — médiane au budget (16,7 ms) | **≤ 248 ms** |
| 30 Hz | **≤ 495 ms** |

**Rien ici n'est extrapolé, et rien ne doit l'être** : les deux bouts se
mesurent. Relever la jauge sur la machine candidate *avant* de l'acheter — un
Pi emprunté une soirée suffit à répondre.

---

## 2. La machine

### Le protocole, dans cet ordre

1. Emprunter ou se faire prêter un Pi 5. Y lancer `node tools/jauge.mjs`.
2. Comparer aux seuils ci-dessus.
3. Si la jauge passe sous 124 ms : acheter, c'est réglé.
   Entre 124 et 248 ms : ça tiendra 60 Hz mais sans marge — passer en portrait
   (−25 %) et surveiller le 95ᵉ centile sur la machine réelle, qui sera dédiée
   et donc mesurable proprement, contrairement à la machine de développement.
   Au-delà de 248 ms : voir « si ça ne passe pas », plus bas.

### Les candidats

**Raspberry Pi 5, 2 Go.** Le modèle 2 Go est le bon : la RAM n'entre pas dans
l'équation, et c'est le moins cher. Son BCM2712 tourne à 2,4 GHz. Mauvaise
nouvelle de contexte : la pénurie de mémoire a déjà provoqué deux hausses de
prix en 2026, le 2 Go est passé à 65 $, et Raspberry Pi annonce une année
difficile — tout en qualifiant la situation de temporaire. Comme la RAM ne sert
pas ici, c'est précisément le modèle le moins exposé.

**Mini-PC Intel N100.** À considérer sérieusement : il est mesuré **~60 % plus
rapide en mono-cœur** que le Pi 5, ce qui est exactement la grandeur qui décide
ici. Il coûte souvent autant qu'un Pi 5 correctement équipé (alimentation,
carte, boîtier, dissipateur), démarre sur un SSD, et se pilote de façon
identique. Il perd sur la consommation et sur l'absence de GPIO — mais les
GPIO ne serviront pas, puisque les commandes passent par USB (§3). Un boîtier
de mini-PC est aussi plus encombrant dans une caisse découpée au laser.

Verdict : **Pi 5 2 Go si la jauge passe, N100 sinon.** La jauge tranche, pas
la préférence.

### Deux pièges matériels

**Le Pi 5 n'a plus de sortie audio analogique.** Le jack 3,5 mm a disparu, et
il n'existe aucun point de soudure ni broche GPIO pour le récupérer : le SoC a
été redessiné pour la bande passante PCIe au détriment du circuit audio. Le son
devra sortir en **HDMI** (donc via un écran ou un extracteur HDMI-audio), ou
par une **carte son USB**, ou par un **DAC I2S** sur GPIO. Ce n'est pas un
détail pour ce projet : la bande son est une pièce majeure du jeu
(`docs/07-son.md`). Une petite carte son USB plus un ampli de classe D et deux
haut-parleurs est la voie la plus simple. À budgéter dès le départ.

**La chaleur.** Un Pi 5 sous charge continue dans une caisse fermée en MDF
s'étrangle thermiquement, et l'étranglement se verra directement sur le seul
cœur qui travaille. Dissipateur actif obligatoire, plus des grilles découpées
au laser en entrée basse et sortie haute.

### Si ça ne passe pas

Par ordre de coût croissant pour le jeu :

1. **Passer en disposition portrait.** −25 %, gratuit, aucun code.
2. **Viser 30 Hz** et verrouiller la fréquence. Sur un jeu d'esquive, c'est
   sensible mais jouable ; à tester avant de le rejeter.
3. **Toucher au pipeline optique** — réduire le nombre de calques, ou le rayon
   du flou. C'est là que sont les millisecondes, et c'est aussi là qu'est
   l'identité visuelle du jeu (`docs/06-heritage-wet-mount.md`). **Décision
   d'auteur, pas décision technique.** Ne pas s'y engager sans mesurer
   d'abord ce que chaque calque retiré rapporte vraiment.
4. **Changer de machine.** Souvent moins cher que le temps passé sur le point 3.

---

## 3. Les commandes

### Bonne nouvelle : l'essentiel est déjà câblé

`src/core/input.js` écoute déjà :

- l'événement **`wheel`** → `focusImpulse`, c'est-à-dire **la mise au point** ;
- les **flèches** et `KeyW/A/S/D` lus par position physique → le déplacement ;
- `Space` (dash), `Escape`/`KeyP` (pause), `KeyM` (muet).

Un périphérique qui se présente en **USB HID** — clavier et souris standard —
pilote donc le jeu **sans écrire une ligne de code**, sans pilote et sans
configuration. C'est la voie à prendre.

### Un seul Pi Pico pour tout

Un RP2040 en CircuitPython suffit à faire, sur un seul câble USB :

| Organe | Ce que le Pico envoie | Ce que le jeu reçoit |
|---|---|---|
| Molette de mise au point (encodeur rotatif) | `Mouse.move(wheel=±1)` | `wheel` → `focusImpulse` |
| Joystick 4 ou 8 directions (microswitches) | flèches clavier | `MOVE_KEYS` |
| Bouton dash | `Space` | `takeDash()` |
| Boutons service (pause, muet) | `Escape`, `KeyM` | — |
| LED de la boîte de Petri | — | pilotées par le Pico (§5) |

`rotaryio.IncrementalEncoder` lit la quadrature de l'encodeur,
`adafruit_hid.mouse` émet l'événement molette. **Alimenter l'encodeur en
3,3 V**, pas en 5 V, si ses sorties vont directement sur les GPIO du RP2040.

Alternative sans microcontrôleur pour le joystick seul : un encodeur clavier
USB du commerce (« zero delay »), qui câble des microswitches sur des touches.
Mais il ne fait pas la molette, et il faudrait alors deux périphériques : le
Pico unique reste plus propre, et il fera aussi les LED.

### La double molette de platine : l'objet est juste, la commande est fausse

C'est le souhait de départ, et il mérite une réponse franche plutôt qu'un
« compliqué à trouver ».

Le problème n'est pas l'approvisionnement, il est **cinématique**. Les molettes
coaxiales d'une platine commandent une **position** : on tourne, le plateau se
déplace d'autant, on lâche, il reste là. Le jeu, lui, attend une **direction de
nage** maintenue (`input.move`, vecteur normalisé consommé à chaque image). Les
deux mappages possibles sont mauvais :

- **molette → position dans l'arène** : impossible, l'arène fait 1600 px de
  rayon quand le champ visible en fait 124 ; il faudrait des dizaines de tours.
- **vitesse de rotation → vitesse de nage** : jouable, mais il faut tourner
  *sans jamais s'arrêter* pendant les 12 minutes d'un run, et toute diagonale
  demande de faire tourner les deux molettes à la fois, à des vitesses
  différentes. Sur un jeu où l'esquive décide de la survie, c'est perdu
  d'avance.

**Recommandation : joystick pour la nage, molette pour la mise au point.** Et
c'est le partage le plus *réaliste* des deux : sur un vrai microscope, la mise
au point **est** une molette, et c'est le geste qu'on veut faire sentir. La
platine, elle, n'est pas un organe de pilotage temps réel.

Deux façons de ne pas renoncer à l'objet :

- **Recycler un microscope réel** et instrumenter sa *vraie* molette de mise au
  point — c'est le meilleur des deux mondes. Bonus : la micrométrique et la
  macrométrique peuvent devenir la mise au point fine et grossière.
- **Garder les molettes de platine comme commande de menu** : naviguer entre
  les puits du lobby, choisir sa souche, feuilleter le bestiaire. Là, le
  mappage position→sélection est *juste*, et le geste est savoureux.

**Comment trancher sans acheter :** brancher une souris à molette et
maquetter le mappage « rotation → vitesse » dans le navigateur, sur le jeu
réel, avant toute commande de pièces. Une demi-heure de code, et la question
est réglée par le poignet plutôt que par l'opinion.

---

## 4. L'écran

L'oculaire optique est écarté, et à raison : afficher une dalle à travers un
système optique réel demande un collimateur, perd de la lumière, et exclut de
jouer à plusieurs.

Contraintes réelles :

- **Pas d'écran rond.** Le HUD vit *hors* du disque du champ — bande du bas en
  portrait, deux colonnes latérales en paysage. Un cache circulaire le
  couperait.
- Le pixel art est agrandi au plus proche voisin : viser un **rapport entier**
  entre le tampon et la dalle donne une image parfaitement nette. Tampon
  392×272 sur une dalle 1024×768 → ×2 avec marge ; tampon 256×341 tourné en
  portrait sur une 768×1024 → ×3.
- Le portrait coûte ~25 % de processeur en moins (§1), mais pour jouer à
  plusieurs le paysage est plus confortable.

**Recommandation : dalle IPS 7 à 10 pouces en 4:3 ou 16:10, en paysage.** Et
l'argument de cohérence est meilleur qu'il n'y paraît : les microscopes de
labo modernes sont trinoculaires, avec une caméra et **un moniteur posé à
côté**. Un écran n'est donc pas une trahison de l'objet — c'en est un accessoire
authentique. La tête binoculaire peut rester en place, purement décorative,
pendant que l'écran fait le travail.

---

## 5. La boîte de Petri rétroéclairée

### La couleur existe déjà dans le code

`src/data/palette.js` porte un `bg` par matrice :

| Matrice | `bg` | Lecture |
|---|---|---|
| Lait cru | `#e9e5d7` | crème, fond clair |
| Levain | `#ddd2b6` | ocre pâle, fond clair |
| Conduite | `#02070a` | quasi noir |
| Kombucha | `#080502` | quasi noir |
| Sang | `#0a0206` | quasi noir |

**Ne pas asservir les LED à `bg` directement** : trois matrices sur cinq
éteindraient la boîte. Ajouter un champ dédié `led` à chaque palette — une
couleur *d'ambiance*, plus saturée, qui dit le milieu plutôt que son fond :
blanc crème pour le lait, acier bleuté pour la conduite, ambre thé pour le
kombucha, ocre pour le levain, rouge sombre pour le sang. Cinq lignes de
données, et le raisonnement reste dans le fichier où il se lit.

### LED plutôt qu'écran

Un écran sous une boîte de Petri se verrait de près : plat, réfléchissant,
pixelisé. Un **anneau ou une bande de LED adressables** (WS2812B) derrière un
diffuseur en acrylique opale donne une lumière de transillumination crédible —
c'est d'ailleurs ainsi qu'on éclaire une boîte pour la photographier. Et
l'adressable ouvre ce qu'une couleur fixe ne peut pas : **la boîte devient un
second HUD**, pulsation sur le pH qui descend, battement rouge quand le boss
arrive, balayage froid pendant un Nettoyage En Place.

Le diffuseur est essentiel : sans lui on voit les points lumineux. Acrylique
opale 3 mm, découpé au laser, à au moins 15 mm des LED.

### Le chemin de la couleur jusqu'aux LED

Le jeu tourne dans un navigateur et ne peut pas toucher les GPIO. Le plus
simple, et sans second câble : **le Pico qui fait déjà le HID expose aussi un
port série** (USB CDC), le jeu lui envoie la couleur en **WebSerial** — supporté
par Chromium sous Linux — et le Pico pilote les WS2812B. Un seul périphérique,
un seul câble, aucun service à faire démarrer au boot.

Repli si WebSerial pose problème en mode kiosque : un petit service local qui
écoute en HTTP sur la machine et relaie vers le Pico ; le jeu fait un `fetch`.
Plus de pièces mobiles, mais entièrement dans des outils déjà connus du dépôt.

La gélose en résine et les fausses colonies sont hors de ce document : l'auteur
sait déjà faire.

---

## 6. Le son

Rappel du §2 : **pas de sortie analogique sur Pi 5**. Prévoir carte son USB, ou
DAC I2S, ou audio HDMI.

Deux points de vigilance propres à ce jeu :

- Le moteur audio garde des **voix permanentes** : chaque canal a un
  oscillateur qui tourne du début à la fin (`CLAUDE.md`, `docs/07-son.md`).
  C'est un coût constant, sur le thread audio et non sur le thread principal —
  donc invisible dans `npm run perf`. **À mesurer séparément sur la machine
  cible**, en regardant si la charge audio fait déborder le thread de rendu.
- Le jeu ne démarre le son qu'après un geste de l'utilisateur, règle des
  navigateurs. Sur une borne qui s'allume seule, ce geste n'arrive jamais : il
  faudra soit lancer Chromium avec l'autorisation de lecture automatique, soit
  faire du premier appui sur le joystick le geste déclencheur. À traiter dans
  le mode borne (§8).

---

## 7. La menuiserie, découpée au laser

Pièces que le laser fait bien ici :

- corps, socle et caisse, en encoches auto-alignantes ;
- **platine porte-boîte** : logement exact d'une boîte de Petri (⌀ 55 ou
  90 mm), avec le siège du diffuseur opale dessous ;
- **cache d'oculaire** autour de l'écran, qui donne la silhouette de microscope
  sans masquer le HUD ;
- panneau de commande : perçages du joystick, des boutons ⌀ 24/28 mm, de l'axe
  de la molette ;
- grilles de ventilation (§2) ;
- gabarits de perçage pour le bâti.

Matériaux : MDF 5 mm pour la structure (peu cher, se peint bien, se ponce),
acrylique noir 3 mm pour les faces vues, **acrylique opale** pour le seul
diffuseur. Assemblage par encoches et écrous en T, pour pouvoir rouvrir.

**Règle : le carton avant le MDF.** Maquetter la hauteur du plan de commande,
l'angle de l'écran et la position de la molette en carton d'emballage avant de
lancer la moindre découpe. L'ergonomie d'une borne se règle avec les coudes,
pas dans un logiciel de dessin — et un plan validé en carton évite trois
passages laser.

---

## 8. Le logiciel de borne : ce qu'il reste à écrire

Peu de choses, et aucune n'est difficile.

1. **Mode kiosque** : Chromium en plein écran, sans curseur, sans barre, sans
   veille ni économiseur, démarrage automatique à l'allumage.
2. **Servir le jeu en local.** Ne **pas** dépendre de la page GitHub Pages : la
   borne doit fonctionner sans réseau. Le dépôt est entièrement statique,
   `npm run serve` suffit, à lancer au démarrage.
3. **Mode attract** : après N secondes sans entrée, revenir au lobby. Les
   crochets existent déjà (`input.takeAnyPress()`, `window.__startMatrice`).
4. **Geste sonore initial** : voir §6.
5. **Sortie couleur vers les LED** : champ `led` dans les palettes, plus
   l'émission WebSerial (§5).
6. **Mappage des molettes de platine**, si et seulement si la maquette du §3
   conclut qu'elles valent le coup.
7. **Verrouillage de la fréquence d'image** si on descend à 30 Hz (§2).

---

## 9. Phasage

| Phase | Contenu | Fin quand |
|---|---|---|
| **0. Trancher** | Jauge sur la machine candidate ; maquette du mappage molette au navigateur | La machine est choisie sur un chiffre, et le sort de la double molette est réglé |
| **1. Le cœur jouable** | Machine + écran + joystick + molette, posés sur une planche, sans menuiserie | On joue un run complet avec les vraies commandes |
| **2. Le mode borne** | Kiosque, service local, attract, son au démarrage | La borne s'allume seule et joue sans clavier |
| **3. La boîte de Petri** | Champ `led`, Pico, WS2812B, diffuseur | La couleur suit le stage, et pulse |
| **4. La menuiserie** | Carton, puis MDF et acrylique | La borne tient debout |
| **5. Finitions** | Peinture, marquages, étiquettes d'objectif, gélose en résine | — |

La phase 1 est **jouable de bout en bout**. C'est voulu : on veut jouer avec le
joystick et la molette avant de découper quoi que ce soit, exactement comme le
sang attend qu'on ait joué la conduite pour de vrai.

---

## 10. Décisions en attente

- **Format et taille de l'écran** — arbitrage entre confort à plusieurs
  (paysage) et 25 % de processeur (portrait). À reprendre une fois la jauge
  connue : si la marge est large, l'ergonomie décide seule.
- **Le sort de la double molette** — à trancher par la maquette du §3, pas par
  discussion.
- **Microscope recyclé ou bâti sur mesure** — un vrai corps de microscope donne
  la molette de mise au point gratuitement et une crédibilité qu'aucune découpe
  n'atteindra ; un bâti sur mesure loge la machine et l'écran sans compromis.
- **Chemin des LED** — WebSerial (recommandé) ou service local.
- **Les palettes `led`** — cinq couleurs d'ambiance à choisir, avec la même
  exigence que le reste : ce sont des couleurs de *milieu*, elles se justifient.

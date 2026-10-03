# Le Pico de la borne

Un seul Raspberry Pi Pico, un seul câble USB vers la machine, et il fait tout :
joystick, molette de mise au point, boutons, et l'anneau de LED sous la boîte
de Petri.

Le principe qui rend ça simple : le Pico se présente en **USB HID standard**,
clavier et souris. Or `src/core/input.js` écoute déjà `wheel` et les flèches,
lues par position physique. **Aucune ligne de code n'est à ajouter au jeu** pour
que les commandes fonctionnent — seules les LED demandent un canal à part.

---

## Ce qu'il faut

- Un **Raspberry Pi Pico** (RP2040). Le Pico W n'apporte rien ici.
- **CircuitPython** installé dessus.
- Les bibliothèques, dans `lib/` sur la carte : `adafruit_hid`, `neopixel`.
  Elles viennent du bundle CircuitPython officiel, celui qui correspond à la
  version installée.
- Un **joystick d'arcade** à microswitches, des **boutons** ⌀ 24 ou 28 mm.
- Un **encodeur rotatif incrémental** — voir la section dédiée plus bas, le
  choix n'est pas neutre.
- Un **anneau WS2812B**, 16 LED.

---

## Brochage

| Broche | Organe |
|---|---|
| GP2 / GP3 / GP4 / GP5 | joystick : haut / bas / gauche / droite |
| GP6 | bouton dash → Espace |
| GP7 | bouton pause → Échap |
| GP8 | bouton muet → M |
| GP10 / GP11 | encodeur de mise au point, voies A et B |
| GP16 | données de l'anneau de LED |

Les microswitches vont **à la masse**, sans résistance : le tirage interne
est activé par le firmware. C'est le câblage des joysticks d'arcade du
commerce, qui n'ont que deux cosses.

**Alimenter l'encodeur en 3,3 V**, pas en 5 V, puisque ses sorties vont
directement sur les GPIO du RP2040.

### Les deux pièges de l'anneau de LED

**Le courant.** Une WS2812B tire jusqu'à 60 mA en blanc plein. Seize LED à
fond demandent donc **0,96 A**, ce qu'aucun port USB ne fournit. Le firmware
plafonne la luminosité à 0,35, ce qui ramène à **340 mA** — tenable sur un
port. Si tu donnes à l'anneau **sa propre alimentation 5 V** (recommandé, avec
masse commune avec le Pico), ce plafond peut monter : c'est la ligne
`LUMINOSITE` dans `code.py`.

**Le niveau logique.** Les WS2812B attendent un signal à 0,7 × VDD, soit
3,5 V quand elles sont en 5 V — et le Pico ne sort que 3,3 V. Souvent ça
passe quand même, parfois non, et l'échec est capricieux plutôt que franc. Les
trois parades, par ordre de propreté : un décaleur de niveau (74AHCT125),
alimenter l'anneau en 4,5 V au lieu de 5 V, ou sacrifier la première LED de la
chaîne en simple répéteur.

---

## Mise en service

1. Copier `boot.py` et `code.py` à la racine du lecteur `CIRCUITPY`.
2. **Débrancher et rebrancher** le Pico. `boot.py` n'est lu qu'au
   branchement : un reset logiciel ne suffit pas. C'est lui qui ouvre le
   second port série, celui des données — sans quoi les couleurs
   arriveraient au milieu des messages de la console REPL.
3. Ouvrir le jeu dans Chromium, puis, **une seule fois**, dans la console :

   ```js
   __leds.connecter()
   ```

   Un sélecteur de port s'ouvre : choisir le Pico. C'est le geste qu'exige
   WebSerial, et il ne peut pas être automatisé.
4. **Les fois suivantes, il n'y a plus rien à faire.** Le navigateur retient
   l'autorisation, et le jeu rouvre le port tout seul à chaque allumage. C'est
   ce qui rend la borne autonome.

Vérifier que ça vit :

```js
__leds.etat     // { dispo, actif, mort, matrice, couleur, ... }
```

`actif: true` et une `couleur` qui bouge quand on joue : la liaison tient.

---

## Le protocole

Le jeu envoie des lignes de texte, et rien d'autre :

```
#RRGGBB\n
```

C'est délibérément lisible : n'importe quel terminal série permet de tester
l'anneau sans lancer le jeu, et de voir ce que le jeu envoie vraiment.

Au plus **30 trames par seconde**, et seulement quand la couleur bouge d'au
moins un niveau sur 255 (`src/borne/leds.js`). Soit 240 octets par seconde sur
une liaison à 115 200 bauds : 0,2 % de sa capacité. Le jeu n'attend jamais la
fin d'une écriture — une trame perdue coûte une couleur, jamais une image.

---

## L'encodeur de mise au point

**Référence retenue : `PEC11R-4015F-N0024` (Bourns).** Environ 2 €, en stock
chez DigiKey, RS (781-6824), Farnell/Newark et Arrow.

| Caractéristique | Valeur | Pourquoi celle-là |
|---|---|---|
| Détentes | **0 — aucune** | une vraie molette de microscope est lisse ; les crans donnent un toucher de bouton de radio |
| Impulsions / tour | 24 | donne 0,61 tour pour traverser toute la profondeur (calcul ci-dessous) |
| Axe | plat (méplat), ⌀ 6 mm, 15 mm | le standard : toutes les molettes du commerce s'y montent, et le méplat empêche le glissement sous couple |
| Poussoir | non | inutile ici ; la variante `S0024` en ajoute un si tu en veux un |
| Durée de vie | 30 000 tours | voir « pièce d'usure » plus bas |

La nomenclature Bourns se lit : `PEC11R-4` **`0`** `15F-` **`N`** `0024` —
le premier chiffre est la détente (**0** = sans, **2** = avec), les deux
suivants la longueur d'axe en mm, `F` l'axe plat, `N`/`S` l'absence ou la
présence du poussoir, et les quatre derniers les impulsions par tour.

Donc, selon ce que tu préfères :

| Tu veux | Référence |
|---|---|
| Lisse, sans poussoir (**recommandé**) | `PEC11R-4015F-N0024` |
| Lisse, avec poussoir | `PEC11R-4015F-S0024` |
| Cranté, sans poussoir | `PEC11R-4215F-N0024` |
| Axe plus long (20 mm), lisse | `PEC11R-4020F-N0024` |

### Pourquoi 24 impulsions, et pas 1200

`src/game/game.js` borne `focusTarget` entre **−1,05 et +1,05** : la course
utile vaut donc 2,10. `src/core/input.js` borne `deltaY` à ±60 et le multiplie
par 0,0024, soit **0,144 par impulsion**. Avec 24 impulsions par tour :

```
2,10 / (24 × 0,144) = 0,61 tour pour traverser toute la profondeur
```

Un peu plus d'un demi-tour, ce qui est exactement le geste d'une vis
micrométrique. C'est aussi pourquoi un **spinner d'arcade est le mauvais
outil** ici malgré son apparence idéale : à 1200 impulsions par tour, il
faudrait jeter 98 % de sa résolution, et ses roulements à billes sont conçus
pour qu'il tourne en roue libre — alors qu'une mise au point doit rester où on
la laisse.

Dans `code.py`, `rotaryio.IncrementalEncoder` utilise par défaut
`divisor=4`, c'est-à-dire un compte par cycle complet de quadrature : c'est ce
qui donne les 24 comptes par tour. Passer à `divisor=1` quadruplerait la
sensibilité et ramènerait la course à 0,15 tour — injouable.

### Trois précautions de montage

**Ne pas monter une grosse molette directement sur l'axe.** Le palier d'un
encodeur de 12 mm est fragile, et un capot de 55 mm fait bras de levier : la
première personne qui s'appuie dessus plie l'axe. Soit le capot tourne sur son
propre palier dans le panneau et entraîne l'axe par un accouplement, soit on
reste sous ~40 mm de diamètre.

**Ajouter du frottement.** Sans détente, l'encodeur tourne presque librement,
alors qu'une vis macrométrique oppose une résistance douce et continue. Un
joint torique frottant à l'intérieur du capot donne exactement ce toucher, et
c'est du bricolage pur — rien à acheter.

**C'est une pièce d'usure.** 30 000 tours, c'est beaucoup pour un appareil de
salon et peu pour une borne. Ordre de grandeur : à 30 tours par partie, cela
fait un millier de parties. À 2 € la pièce, le problème n'est pas le coût mais
l'accès — prévoir de pouvoir la remplacer sans démonter toute la colonne.

Si la borne tourne vraiment beaucoup, la relève est un capteur **magnétique
sans contact** (type AS5600, aimant diamétral collé en bout d'axe) : usure
nulle, mais il faut alors un vrai axe sur roulements et une lecture I²C côté
Pico. À garder pour une version 2, pas pour le premier montage.

---

## Régler la molette

`input.js` borne `deltaY` à ±60 et le multiplie par 0,0024 : **0,144 de mise au
point par impulsion**. Sur une course de 2,10, il faut donc 14,6 impulsions
pour la traverser — 0,61 tour avec l'encodeur retenu.

Pour une molette plus nerveuse, monter `CRANS_PAR_PAS` dans `code.py`. Pour
plus de finesse, ne pas prendre un encodeur à plus d'impulsions sans augmenter
d'autant la course : c'est le rapport des deux qui fait le toucher.

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
- Un **encodeur rotatif incrémental** (type EC11), de préférence avec crans.
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

## Régler la molette

`input.js` borne `deltaY` à ±60 et le multiplie par 0,0024 : **0,144 de mise au
point par cran**. Sur une profondeur utile de −1 à 1, il faut donc une
quinzaine de crans pour la traverser, soit un peu plus d'un demi-tour d'un
encodeur à 24 crans. C'est volontairement proche du geste d'une vraie vis
micrométrique.

Pour une molette plus nerveuse, monter `CRANS_PAR_PAS` dans `code.py` ; pour
plus de finesse, prendre un encodeur à plus de crans par tour.

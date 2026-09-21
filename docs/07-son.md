# Son

Bande son **générative et adaptative**. Rien n'est enregistré : tout est
synthétisé au moment du jeu et assemblé en direct selon l'état de la partie.

## Le périmètre artistique

Deux ambiances, et une seule règle pour les tenir ensemble.

| Contexte | Ce qu'on entend |
|---|---|
| **Lobby, bestiaire** | Drone lent, nappes longues, réverbe très ouverte et écho ping-pong. Pas de batterie. On observe, on ne se bat pas |
| **Matrices** | **Drum and bass à grain chiptune**, 168 à 176 BPM. Ondes carrées et triangulaires qui coupent le mix, ostinato hypnotique, mélodies courtes. Mais l'ambiance reste **liquide**, pas souterraine : nappes mouvantes, écho, glissandos |

Le **squelette rythmique ne change pas** d'une matrice à l'autre : c'est lui
qui fait que la bande son est « toujours chez elle ». Ce qui change, c'est la
tonalité, le mode et la couleur des timbres — exactement comme chaque matrice
a déjà sa palette visuelle.

| Matrice | Tonique | Mode | Rapport cyclique | Grain |
|---|---|---|---|---|
| Lobby / bestiaire | A | dorien | 50 % | 15 % |
| Lait cru | D | dorien | 50 % | 55 % |
| Conduite | F# | mineur | 12,5 % | 85 % |
| Kombucha | C# | phrygien | 25 % | 50 % |
| Levain | A | penta. mineure | 50 % | 42 % |

## Quatre canaux, comme une puce sonore

**C'est une contrainte de conception, pas une décoration.** Un oscillateur Web
Audio ne se relance pas après un `stop()` : créer une voix par note produit des
centaines de nœuds par minute qu'il faut penser à déconnecter — la fuite
classique de tout moteur audio de jeu.

On fait donc l'inverse, et ça tombe bien, c'est exactement ainsi que marche une
puce 8 bits : **chaque canal a un oscillateur qui tourne du début à la fin**, et
jouer une note ne fait que changer sa fréquence et ouvrir son enveloppe. Zéro
allocation en régime permanent, **polyphonie plafonnée par construction**, et le
grain monophonique caractéristique en prime.

| Canal | Rôle | Timbre |
|---|---|---|
| `pulse1` | Mélodie | Carrée à rapport cyclique variable, construite par série de Fourier (Web Audio ne propose que 50 %) |
| `pulse2` | Ostinato | Idem, autre rapport |
| `triangle` | Basse | Triangulaire |
| `bruit` | Percussion | LFSR sous-échantillonné : le grain métallique d'une NES, pas du bruit blanc |
| `sub` | Poids | Sinus. Rien de rétro, et c'est assumé : sans bas du spectre il n'y a pas de drum and bass |
| `nappe` | Liquide | Trois scies désaccordées. C'est le **désaccord** qui fait l'impression de liquide, pas le nombre de voix. Filtrée **bas** (1,1 kHz plafonné) et sur **deux pôles** : voir « le sifflement » ci-dessous |

## Le moteur observe, on ne lui pousse rien

`observe(scene, game, dt)` est appelé **une fois par image** et déduit tout :
intensité, mise au point, danger, pH, arrivée d'un boss, passage d'un NEP,
coups encaissés, mises à mort. C'est la même convention que le rendu, qui
**lit** `game` au lieu de se le faire pousser.

La conséquence est concrète : **ajouter une matrice ne demande aucun câblage
audio**, et `game.js` ne connaît pas l'existence du son. Les événements
ponctuels eux-mêmes se déduisent par **détection de front** — `game.flash` qui
monte, `player.kills` qui augmente, `game.boss` qui apparaît.

### Mappages

| État du jeu | Effet musical |
|---|---|
| `director.liveCredits() / targetCredits()` + `progress` | **Intensité** → gains des couches. Le budget de menace *est* déjà la bonne mesure, on ne réinvente rien |
| `\|game.focus\|` | Passe-bas master. Regarder loin de son propre plan **ouate** le son comme ça floute l'image. C'est l'**écart** qui compte, pas le signe |
| Vie basse, `game.flash` | Couche de tension, battement sourd |
| `game.ph` vs `chem.phStart/phFloor` | Couleur harmonique (passe B) |

Les couches tournent **toutes en permanence** ; on ne fait que ramper leurs
gains. Jamais de coupure : une couche qui s'arrête s'entend, une couche qui
descend ne s'entend pas.

## Timing

Deux horloges. Un `setInterval` grossier (25 ms) réveille le planificateur ;
celui-ci inscrit les notes **120 ms à l'avance** sur l'horloge d'échantillon
(`ctx.currentTime`). Une note est donc à sa place à la milliseconde près, même
si une image du jeu prend 40 ms.

## Garde-fous

- Avant `init()`, **toute la surface publique est un no-op**.
- `init()` n'est appelé que depuis `btnStart` — politique d'autoplay.
- Toute exception désactive le moteur **en silence** : le jeu ne tombe jamais
  parce que le son n'est pas disponible.
- Veille sur pause (Échap/P) et sur perte de focus de l'onglet.

## Licence

Aucune dépendance, aucun asset, aucun échantillon. Réverbe de Schroeder,
rythmes euclidiens, LFSR, `mulberry32` : ce sont des **techniques**, pas du code
copié. Tout est écrit de zéro.

## Vérifier

On ne règle pas une bande son adaptative en constatant qu'elle ne lève pas
d'exception : elle peut très bien ne produire que du silence.

```
npm run son:check      # rend hors ligne et MESURE les mappages
npm run son:derive     # 60 s a etat fige : detecte une accumulation
npm run son:studio     # conduit le studio dans un vrai navigateur
node tools/son-extrait.mjs milk 34   # rend un WAV, pour écouter
```

`son-check` rend cinq états de jeu dans un `OfflineAudioContext` et vérifie que
ça sonne, que ça ne sature pas, que l'intensité amène bien le bas du spectre,
que la mise au point mange l'aigu **sans éteindre le morceau**, que le lobby
ne sonne pas comme un stage, et qu'**aucune raie ne siffle**.

### Le sifflement, et pourquoi le niveau ne le voyait pas

Défaut signalé à l'oreille : *« un sifflement arrive très progressivement pour
finir par occuper tout l'espace en milieu de partie »*. Les six verdicts
existants passaient tous, et le banc de dérive donnait ×1,02 sur soixante
secondes — donc pas de boucle qui s'emballe. Il a fallu un **spectre** pour le
nommer : une raie stable à **2223 Hz**, deux fois plus forte que ses voisines,
présente à toutes les intensités et **survivant au contournement du grain**.

Par élimination, la coupable est la `nappe` :

| Variante | Pic 2,15–2,5 kHz |
|---|---|
| telle quelle | 13,19 |
| sans nappe | 7,70 |
| nappe coupée à 900 Hz | 7,77 |
| sans réverbe | 4,93 |
| nappe Q = 0,4 | 12,58 |
| sans ostinato, sans lead | ~13,2 |

C'est une dent de scie **tenue en permanence** dont `appliquerAmbiance`
recalait le passe-bas sur `coupure × 0.35`, soit **2170 Hz** pour le lait : les
harmoniques 13 à 16 des accords tombaient pile sur le coin du filtre. Et cette
couche était la seule envoyée à la réverbe **à gain 1.0** — les peignes de
Schroeder étalaient ces partiels en une bande continue. D'où un sifflement qui
*monte* au lieu d'attaquer. Le Q n'y était pour rien : c'est la **position** de
la coupure, pas sa résonance.

Quatre corrections, qui vont toutes dans le sens de la DA :

- coupure plafonnée à **1250 Hz**. Une nappe est un fond harmonique ; ce sont
  les carrés incisifs qui doivent couper le mix, et la nappe leur disputait
  précisément leur bande ;
- **deux pôles** au lieu d'un. À 12 dB/octave, une scie coupée à 1,1 kHz garde
  encore le quart de ses harmoniques à 2 kHz, et dès que le mix se dégarnit
  elles s'entendent seules ;
- envoi de réverbe ramené de 1.0 à **0.4 en stage**, laissé à **1.0 au lobby**
  où le drone est le sujet ;
- un **souffle** très lent sur la coupure, une période différente par voix. Un
  partiel parfaitement stable s'entend comme un sifflet ; le même partiel qui
  respire s'entend comme une texture.

Le verdict permanent mesure chaque raie face à la **médiane de son propre
tiers d'octave**, pas face au niveau moyen du morceau : une texture large monte
avec ses voisines et ne ressort pas, une raie pure laisse son voisinage en bas.
Avec le défaut volontairement remis, il donne ×38 à 2223 Hz ; corrigé, plus
aucune raie ne passe même le plancher d'audibilité.

### Six pièges payés en écrivant ce banc

| Symptôme | Cause |
|---|---|
| Les cinq états sortaient **identiques** | La courbe de grain est une **porte**, pas une saturation : quantifier sur 14 paliers renvoie zéro pour tout échantillon sous 1/28 d'amplitude. Il faut présenter le signal **chaud** au quantificateur et rattraper après, comme une vraie pédale de bitcrush |
| Mesures **non reproductibles** d'une passe à l'autre | Le banc utilisait le **singleton**, et la boucle de jeu de la page continuait d'appeler `observe()` pendant le rendu hors ligne, remettant l'ambiance à zéro en plein milieu. Le banc instancie désormais son propre moteur |
| Fermer le passe-bas de 12 kHz à 3,4 kHz ne bougeait la mesure que de 5 % | Le passe-haut d'analyse était à **un seul pôle** : 6 dB/octave laisse passer tout le médium. On mesurait le mix, pas l'aigu. Quatrième ordre |
| Aucune énergie au-dessus de 5 kHz, quel que soit l'état | Le banc rendait à **24 kHz** : la charleston (7 à 10 kHz) se retrouvait au bord de Nyquist et le biquad s'y écrasait. On mesurait le banc, pas le moteur |
| La recherche de raie déclarait un sifflet **partout** | Elle comparait chaque pic à un voisinage **vide** : dans un passage clairsemé, un partiel à −60 dB domine arithmétiquement sans que personne ne l'entende. Il faut un plancher d'audibilité, et exclure le lobby, qui est un drone assumé |
| Le défaut volontairement remis **passait le banc** | Le rendu ne durait que **quatre secondes** : une dizaine de blocs d'analyse, trop peu pour qu'une raie tenue se détache. À dix secondes elle ressort à ×38. Un banc qui ne rattrape pas le bug qu'il est censé garder ne garde rien — on le vérifie en remettant le défaut |

## Le studio : régler la DA à l'oreille, la transporter par un code

`tools/son-studio.html` — page autonome, aucun build. Se sert comme le jeu :

```
npm run serve      # puis http://localhost:8080/tools/son-studio.html
npm run son:studio # le banc qui vérifie que le studio ne ment pas
```

### Preset ≠ graine

C'est la distinction qui structure tout le fichier `src/data/son-presets.js` :

| | Rôle | Doit bouger ? |
|---|---|---|
| **Preset** | Tempo, tonique, mode, couleur des timbres, espace, caractère de batterie | Non. C'est **l'identité** |
| **Graine** | Quelle note l'ostinato tire, où tombe la variation, quelle charleston passe | Oui. C'est **l'interprétation** |

Le **code** emballe les deux en dix-huit caractères : `CD1-milk-F9SJQNM43A6AA5XVER`.
Les deux, parce qu'on les a entendus ensemble.

Chaque champ tient sur un nombre fixe de bits, avec un pas choisi pour que les
valeurs adoptées tombent exactement dessus — l'aller-retour preset → code →
preset est **l'identité, pas une approximation**. Ce qu'on entend dans le
studio est ce que le jeu jouera. L'alphabet est celui de Crockford (ni I, ni
L, ni O, ni U : on recopie ces codes à la main), et une somme de contrôle de
cinq bits attrape les fautes de frappe. Un code refusé ne charge **rien** —
un preset à moitié appliqué se débusque à l'oreille pendant une soirée.

### Ce qui est réglable, et ce qui ne l'est pas

Quatorze curseurs : tempo, tonique, mode, les deux rapports cycliques,
couleur, grain, désaccord de nappe, réverbe, écho, sub, caractère de
percussion, présence de l'ostinato, densité mélodique.

Restent **côté moteur**, et délibérément : les seuils d'apparition des
couches, la loi mise au point → passe-bas master, la structure des canaux
permanents, et les garde-fous anti-sifflement (coupure de nappe plafonnée,
deuxième pôle, envoi de réverbe réduit en stage). Un curseur dessus, et on
reconstruit le défaut en trois clics.

`sub` et `ostinato` sont des **multiplicateurs** sur la loi de couche, pas des
niveaux : la loi reste au moteur, seule la dose est une décision artistique.

### Trois choses que le studio fait et qu'un simple panneau de curseurs ne fait pas

- **Le contexte est simulé.** Une DA ne se juge pas à l'arrêt : intensité,
  danger et mise au point sont pilotables, et un « arc de partie » de 90 s les
  balaye comme une vraie partie — montée, creux de défocalisation, danger dans
  le dernier tiers.
- **On compare en maintenant un bouton.** L'oreille compare mal deux sons
  séparés par dix secondes de réglage, et très bien deux sons séparés par
  rien. Les champs qui s'écartent de l'adopté sont marqués, sinon on ne sait
  plus ce qu'on a changé.
- **Le détecteur de raie tourne en direct**, avec exactement le seuil du banc
  hors ligne, et le verdict est **suspendu sur un mix clairsemé** — pour la
  même raison que le banc exclut le lobby.

### Adopter

« Exporter » rend le bloc à recopier dans `src/data/son-presets.js`, plus les
cinq codes. Rien n'est écrit automatiquement : les presets adoptés sont
curatés à la main, comme les sprites.

## Overlay de debug

Touche **L** : intensité, mise au point, danger, acidité, ambiance courante.
Touche **M** : couper. On ne règle pas les mappages à l'oreille seule — il faut
voir les grandeurs observées pour savoir si c'est le mappage ou le timbre qui
ne va pas.

## Ce qui vient après

**La passe B attend que la DA soit calée**, et c'est délibéré : son matériau
(riser de NEP, ostinato de biofilm, palette de boss) se règle sur des timbres.
Le coder avant de figer les presets, c'est payer le réglage deux fois.

Au programme : scénario du NEP (montée de tension, impact, timbre par
biocide), ostinato de biofilm tant qu'un producteur d'alginate vit, palette de
boss dédiée, couleur harmonique pilotée par le pH, et l'automate cellulaire
qui fera émerger les motifs d'une simulation microbienne.

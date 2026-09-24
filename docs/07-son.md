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
| `nappe` | Liquide | Trois scies désaccordées. C'est le **désaccord** qui fait l'impression de liquide, pas le nombre de voix. Sur **deux pôles** : voir « le sifflement » ci-dessous |

Ces timbres sont désormais **le rack par défaut**, pas du code : voir plus bas.

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
npm run son:publier    # fabrique la copie hebergee et la conduit aussi
node tools/son-extrait.mjs milk 34   # rend un WAV, pour écouter
```

`son-check` mesure d'abord la **réverbe seule, à l'impulsion** — RT60, platitude
par bande, et le test le plus bête et le plus sûr : est-ce que la queue décroît.
Puis il rend six états de jeu dans un `OfflineAudioContext` et vérifie que
ça sonne, que ça ne sature pas, que l'intensité amène bien le bas du spectre,
que la mise au point mange l'aigu **sans éteindre le morceau**, que le lobby
ne sonne pas comme un stage, et qu'**aucune raie ne siffle**.

### Le sifflement, acte I : la nappe

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

**Et ça ne suffisait pas.** Le sifflement est revenu, et la suite est la partie
instructive.

### Le sifflement, acte II : la réverbe était l'amplificateur

Corriger la nappe a supprimé une vraie raie, mais la toute première mesure
disait déjà ceci — et je ne l'ai pas lue :

| Variante | Pic 2,15–2,5 kHz |
|---|---|
| sans nappe | 7,70 |
| **sans réverbe** | **4,93** |

La plus forte baisse de toutes. J'avais corrigé ce qui **alimentait** le
résonateur et laissé le résonateur.

La réverbe, mesurée seule à l'impulsion :

```
+33,6 dB a 1771 Hz,  queue 7,96 s
par octave (dB) : 125:19  250:20  500:30  1000:30  2000:34  4000:30  8000:19
```

Et à `retour 0.86`, le niveau ne décroît pas : il **monte** de −40 dB à +37 dB
en douze secondes.

#### La cause : un passe-bas biquad amplifie, toujours

Chaque peigne était amorti par un `BiquadFilterNode` passe-bas. Mesure au
`getFrequencyResponse`, coupure 2800 Hz :

| Q | gain max | |
|---|---|---|
| 1 | 1,253 | **+1,96 dB** à 2177 Hz |
| 0,707 | 1,222 | +1,74 dB |
| 0,5 | 1,202 | +1,59 dB |
| 0,3 | 1,182 | +1,45 dB |

**Il amplifie sous sa coupure quel que soit le Q.** Baisser le Q ne l'enlève
pas. Dans une boucle à `retour` = 0,8, le gain de boucle réel devient 0,96 :
quasi l'auto-oscillation. Le filtre chargé d'amortir *était* l'amplificateur.

Preuve croisée décisive : un peigne **sans** filtre décroît en 1,23 s pour
1,27 s prédites. Avec le biquad, 3,94 s.

#### La correction

- **Un-pole au lieu du biquad** dans la boucle : `y[n] = (1−d)·x[n] + d·y[n−1]`,
  via un `IIRFilterNode`. Son `|H| ≤ 1` est garanti par construction — c'est
  exactement le filtre d'amortissement de Freeverb.
- **Huit peignes au lieu de quatre.** Avec quatre, la seule façon d'obtenir une
  queue longue est de monter le renvoi, et un peigne à fort renvoi est un
  résonateur. La densité modale croît avec le nombre de peignes.
- **De vrais passe-tout.** Les deux sections de diffusion étaient des peignes
  feedforward, donc deux filtres en peigne de plus au lieu d'un diffuseur.

```
avant  : queue 8 s et croissante,  bosse de bande +13,2 dB
apres  : RT60 1,98 s,              bosse de bande  +3,4 dB
```

#### Trois leçons, payées deux fois

1. **Corriger la source ne suffit pas quand il y a un amplificateur.** La
   mesure le disait dès le premier A/B ; je l'ai lue comme une confirmation de
   ma première hypothèse au lieu d'une deuxième cause.
2. **Un garde-fou qui exclut le cas gênant ne garde rien.** Le détecteur du
   studio suspendait son verdict « sur un mix clairsemé » — précisément l'état
   où le défaut a été signalé. Le banc, lui, ne testait aucun stage au repos.
   C'est le premier état ajouté depuis : il sort ×82 avec le défaut remis.
3. **Une mesure non monotone est une mesure fausse, pas une découverte.**
   Trois méthodes de RT60 ont donné trois absurdités (la durée du rendu, le
   plancher du flottant, un RT60 plus court à plus fort renvoi) avant que le
   simple relevé du niveau par seconde ne montre une queue qui *monte*.

### Huit pièges payés en écrivant ce banc

| Symptôme | Cause |
|---|---|
| Les cinq états sortaient **identiques** | La courbe de grain est une **porte**, pas une saturation : quantifier sur 14 paliers renvoie zéro pour tout échantillon sous 1/28 d'amplitude. Il faut présenter le signal **chaud** au quantificateur et rattraper après, comme une vraie pédale de bitcrush |
| Mesures **non reproductibles** d'une passe à l'autre | Le banc utilisait le **singleton**, et la boucle de jeu de la page continuait d'appeler `observe()` pendant le rendu hors ligne, remettant l'ambiance à zéro en plein milieu. Le banc instancie désormais son propre moteur |
| Fermer le passe-bas de 12 kHz à 3,4 kHz ne bougeait la mesure que de 5 % | Le passe-haut d'analyse était à **un seul pôle** : 6 dB/octave laisse passer tout le médium. On mesurait le mix, pas l'aigu. Quatrième ordre |
| Aucune énergie au-dessus de 5 kHz, quel que soit l'état | Le banc rendait à **24 kHz** : la charleston (7 à 10 kHz) se retrouvait au bord de Nyquist et le biquad s'y écrasait. On mesurait le banc, pas le moteur |
| La recherche de raie déclarait un sifflet **partout** | Elle comparait chaque pic à un voisinage **vide** : dans un passage clairsemé, un partiel à −60 dB domine arithmétiquement sans que personne ne l'entende. Il faut un plancher d'audibilité, et exclure le lobby, qui est un drone assumé |
| Le sifflement est revenu après correction | On avait corrigé la **source** (la nappe) et laissé l'**amplificateur** (la réverbe). Une raie a besoin des deux : quelque chose qui l'émet, quelque chose qui la tient. Le premier A/B montrait déjà que couper la réverbe faisait plus d'effet que couper la nappe |
| Un `BiquadFilterNode` passe-bas dans une boucle de réverbération | Il amplifie de +1,5 à +2 dB sous sa coupure, **quel que soit son Q**. Dans une boucle, cette bosse ne colore pas : elle résonne. Un filtre d'amortissement doit être un **un-pole** (`IIRFilterNode`), dont le gain est majoré par un |
| Le défaut volontairement remis **passait le banc** | Le rendu ne durait que **quatre secondes** : une dizaine de blocs d'analyse, trop peu pour qu'une raie tenue se détache. À dix secondes elle ressort à ×38. Un banc qui ne rattrape pas le bug qu'il est censé garder ne garde rien — on le vérifie en remettant le défaut |

## Le studio : régler la DA à l'oreille, la transporter par un code

`tools/son-studio.html` — page autonome, aucun build. Se sert comme le jeu :

```
npm run serve      # puis http://localhost:8080/tools/son-studio.html
npm run son:studio # le banc qui vérifie que le studio ne ment pas
```

### Ambiance, rack, graine

Trois choses, et il ne faut pas les confondre :

| | Rôle | Où | Doit bouger ? |
|---|---|---|---|
| **Ambiance** | Tempo, tonique, mode, grain, réverbe, écho, densité mélodique. Ce qui se dit d'un morceau **sans parler de ses instruments** | `son-presets.js` | Non. C'est l'**identité** |
| **Rack** | Le **son de chaque voix** : onde, filtre, résonance, enveloppe, niveau | `son-instruments.js` | Non |
| **Graine** | **Compose** la progression d'accords, le motif de l'ostinato et la phrase du lead — puis pilote les densités | — | Oui. C'est l'**interprétation** |

Le **code** emballe les trois : `CD2-milk-F9SB86M8F7PYB60CD3…`. Les trois, parce
qu'on les a entendus ensemble.

### La graine compose, elle ne saupoudre pas

**Défaut vécu, signalé à l'oreille** : « en changeant la graine la mélodie ne
change pas trop ». C'était exact. La progression d'accords et le motif de
l'ostinato étaient des **constantes** du moteur, et le lead tirait une note au
hasard à chaque phrase. La graine ne changeait donc ni l'harmonie, ni le motif,
ni aucune forme mémorisable — seulement des densités de charleston et de clap.

Et un tirage par note ne fait pas une mélodie : il fait une suite de notes sans
forme, qu'on n'a aucune raison de retenir.

La graine compose désormais trois choses, depuis un **flux de hasard séparé** de
celui du jeu — sinon la matière changerait selon le nombre de charlestons déjà
jouées, et deux parties de même graine ne se ressembleraient plus :

- **la progression** : quatre degrés, ouverte sur la tonique, sans répétition
  d'un accord au suivant ;
- **le motif de l'ostinato** : huit pas, avec retour sur un pilier à chaque
  temps fort et une palette réduite. Un motif tiré uniformément sonne comme une
  erreur, pas comme une boucle — or il doit tenir douze minutes ;
- **la phrase du lead** : quatre à six degrés, **parcourus dans l'ordre**. C'est
  ce qui la rend entêtante ; le hasard décide seulement si elle sonne ou si elle
  se tait.

Le squelette rythmique, lui, ne bouge pas : c'est lui qui fait que la bande son
est « toujours chez elle ».

**Mesure**, écart quadratique entre deux rendus rapporté au niveau, batterie
coupée puisqu'elle est volontairement invariante :

| | Deux graines |
|---|---|
| Avant (constantes) | ×0,31 |
| Après (composée) | ×0,97 |

Le banc l'assert désormais sur trois graines, à la fois sur la matière composée
et sur le signal rendu — composer autre chose sans que ça s'entende serait le
même défaut sous un autre nom.

### Le rack : neuf voix, un synthétiseur soustractif ordinaire

Chaque voix mélodique — nappe, sub, basse, ostinato, lead — expose un **modèle
de synthèse**, une **onde**
(sinus, triangle, scie, impulsions 8/12,5/25/33 %, carré), un **filtre**
(passe-bas, passe-bande, passe-haut) avec coupure et résonance, une
**enveloppe** ADSR et un **niveau**. La grosse caisse a ses deux hauteurs et
son temps de chute ; la caisse claire, la charleston et la tension ont un
filtre, une durée et un niveau.

C'est volontairement le vocabulaire le plus banal qui soit. Un rack ne se
règle pas en lisant une documentation : on tourne un bouton, on entend, on
garde.

Chaque ambiance a **son** rack — une matrice a sa palette sonore comme elle a
sa palette visuelle — et le studio sait recopier un rack vers les autres quand
on ne veut pas tout refaire.

#### Le modèle de synthèse, et les machines

Un filtre et une enveloppe ne transforment pas un oscillateur en cloche, ni du
bruit en charleston. Chaque voix a donc un **modèle** — l'architecture de
synthèse elle-même :

| Genre | Modèles |
|---|---|
| Mélodique | `soustractif` · `super` (unisson désaccordé) · `fm` (modulation de fréquence) · `acide` (le filtre a sa propre enveloppe) |
| Percussion au bruit | `bruit` · `taps` (rebonds) · `caisse` (bruit + deux sinus accordés) · `metal` (six carrés inharmoniques) |
| Grosse caisse | `propre` · `saturé`, plus un clic d'attaque dosable |

Deux **boutons de caractère** par voix, dont le sens dépend du modèle : écart
d'unisson et niveau pour `super`, rapport et profondeur pour `fm`, hauteur et
durée du balayage pour `acide`, écart entre rebonds pour `taps`. Le studio
affiche la légende du modèle courant — sans elle ce sont deux curseurs
anonymes.

Au-dessus, un catalogue de **machines** : des timbres tout faits à choisir
avant de régler. Sept pour les voix mélodiques, sept pour les percussions au
bruit, quatre pour la grosse caisse. Une machine ne touche **pas** au niveau de
la voix — changer d'instrument ne doit pas faire sauter l'équilibre du mix.

Leurs noms décrivent un **caractère**, pas une marque. Tout est synthétisé ici,
rien n'est échantillonné : appeler une de ces voix du nom d'une machine réelle
serait une promesse qu'elle ne tient pas. Les repères historiques sont dans
l'aide, là où ils servent — « la grosse caisse des boîtes analogiques de 1980 »
pour le sinus long, « celle de 1983, taillée pour la piste » pour la claquante.

**Les valeurs ne sont pas continues** : chaque champ pioche dans une table.
Une table de 16 ou 32 entrées tient sur quatre ou cinq bits exactement, et une
coupure se pense en octaves, pas en hertz — un curseur log donne des crans qui
s'entendent tous. Les tables contiennent toutes les valeurs d'origine, si bien
que le rack par défaut **reproduit à l'identique** le moteur d'avant.

#### Où passe la frontière

Ce qui était un réglage **global** et agissait en réalité sur une voix précise
est descendu dans le rack : les deux rapports cycliques (lead et ostinato), la
« couleur » (qui ne retouchait que la nappe), le désaccord, le niveau du sub,
la présence de l'ostinato, le caractère de percussion. L'ambiance n'a gardé
que ce qui est vraiment transversal.

Les **couches** ne portent plus que la loi d'apparition ; le niveau de chaque
voix est dans son patch. Mélanger les deux rendait les deux illisibles — on ne
savait plus si on réglait une dramaturgie ou un timbre.

Le **stinger** des événements n'est pas dans le rack : ce n'est pas un
instrument dont on règle le timbre, c'est un signal de jeu, et il doit rester
reconnaissable quoi qu'on fasse des autres voix.

#### Solo et sourdine

Une voix mise en sourdine voit son niveau forcé à zéro dans le rack
**appliqué**, jamais dans le rack adopté : un solo n'est pas un réglage, et le
code doit emballer ce qu'on a réglé, pas ce qu'on écoutait à l'instant. Le
banc le vérifie — mettre une voix en solo ne doit pas changer le code.

Chaque champ tient sur un nombre fixe de bits, avec un pas choisi pour que les
valeurs adoptées tombent exactement dessus — l'aller-retour preset → code →
preset est **l'identité, pas une approximation**. Ce qu'on entend dans le
studio est ce que le jeu jouera. L'alphabet est celui de Crockford (ni I, ni
L, ni O, ni U : on recopie ces codes à la main), et une somme de contrôle de
cinq bits attrape les fautes de frappe. Un code refusé ne charge **rien** —
un preset à moitié appliqué se débusque à l'oreille pendant une soirée.

### Ce qui est réglable, et ce qui ne l'est pas

Sept curseurs d'ambiance, et neuf voix de rack à cinq ou neuf champs chacune.

Restent **côté moteur**, et délibérément : les seuils d'apparition des
couches, la loi mise au point → passe-bas master, la structure des canaux
permanents, et la réverbe, dont le gain de boucle a déjà coûté un sifflement
de huit secondes.

Une réserve honnête : le plafond de coupure de la nappe est désormais **entre
tes mains**. Le deuxième pôle du filtre reste, lui, une propriété de
l'instrument — mais une scie tenue ouverte à 6 kHz peut redevenir sifflante.
C'est le prix du contrôle, et c'est pour ça que le détecteur de raie est
allumé en permanence pendant qu'on règle.

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
  hors ligne. Seul le **lobby** échappe à son verdict, parce que le drone y est
  le sujet ; les stages sont jugés à toute intensité. Choisir un stage place
  aussi le contexte à une intensité **représentative** (0,45) plutôt qu'à zéro :
  un stage à l'arrêt n'a plus que sa nappe, un état que le jeu ne connaît que
  pendant les premières secondes d'une partie.

### Publier le studio

`tools/son-studio.html` importe le moteur par des chemins relatifs (`../src/…`).
Une page **hébergée** est servie à la racine : il faut donc en fabriquer une
variante — et cette variante n'est plus celle que `son:studio` teste.

```
npm run son:publier      # fabrique la copie autonome ET la conduit dans un navigateur
```

Deux règles, payées cher :

- **Les modules sont publiés sous un préfixe versionné** (`v3/src/…`), changé à
  chaque publication. Sinon un navigateur sert les modules de la version
  précédente **depuis son cache**, à côté du nouveau `index.html`. Un import
  nommé manquant fait échouer **tout le graphe de modules avant sa première
  ligne** : aucun panneau construit, aucun son, et rien dans le dépôt qui
  cloche. C'est arrivé, et le banc du dépôt était vert pendant ce temps.
- **Mais les anciens préfixes restent en ligne.** Les supprimer a cassé la page
  une deuxième fois, en sens inverse : un navigateur qui garde en cache
  l'**ancien `index.html`** y cherche ses modules, et ne trouve plus rien.
  Une panne de cache réparée par une panne de cache symétrique. Quelques
  dizaines de kilo-octets par version suffisent à l'éviter — on les garde.
- **La copie fabriquée est conduite dans un vrai navigateur**, pas seulement
  celle du dépôt. Vérifier la page qu'on garde n'est pas vérifier la page
  qu'on livre.

### Ce qui a été adopté (22/09/2026)

Cinq codes, une seule graine : **23105**. Elle fait partie de la DA au même
titre qu'un timbre — c'est elle qui a composé la progression, le motif et la
phrase qu'on a validés. En tirer une au hasard à chaque partie donnerait un
autre morceau ; ce serait défendable, et ce serait une **autre** décision.

**Le rack commun a changé sur un point majeur** : la nappe n'est plus une scie
en passe-bas mais un **unisson en passe-bande à 1800 Hz**. Le passe-bande lui
retire son grave — elle laisse donc la place au sub au lieu de l'encombrer —
et l'unisson lui donne une largeur qu'un oscillateur seul n'a pas.

**Seul le lait cru s'écarte du rack commun**, et franchement :

| Voix | Ce qu'elle devient |
|---|---|
| `ostinato` | un unisson de scies sombre et lent : il cesse d'être un motif piqué pour devenir une nappe rythmique de plus |
| `lead` | un **acide** — filtre résonant balayé à chaque note, coupure 700 Hz, niveau 0,5. C'est lui qui porte le morceau |
| `kick` | la grosse caisse **sourde**, grave et longue, qui laisse la place à ce lead au lieu de lui disputer l'attaque |

Les quatre autres partagent le rack commun : la matière y change par le tempo,
la tonique, le mode et l'espace, pas par les timbres. C'est une décision, pas
un oubli.

Le **lobby** est le changement le plus radical : 58 → **170 BPM**, grain à
fond, réverbe et écho au maximum. Toujours aucune batterie — la couche n'y
monte jamais — mais la nappe respire toutes les 1,4 s au lieu de 4,1. Ce n'est
plus un drone lent, c'est une masse qui pulse.

#### Deux écarts de niveau, mesurés après coup

RMS sur 12 s, stages à intensité 0,8, graine adoptée :

| Ambiance | RMS | Écart / conduite |
|---|---|---|
| Lobby | 0,0127 | **−15,9 dB** |
| Lait cru | 0,1043 | **+2,4 dB** |
| Conduite | 0,0789 | 0 |
| Kombucha | 0,0803 | +0,2 |
| Levain | 0,0805 | +0,2 |

Les trois stages « ouverts » sont à 0,2 dB les uns des autres : très cohérent.
Deux exceptions, toutes deux conséquences directes de choix assumés :

- **le lait cru est 2,4 dB plus fort** que les autres stages — c'est le lead
  acide à 0,5. Un cran de niveau (0,5 → 0,4) le ramènerait à +0,5 dB ;
- **le lobby est 16 dB sous les stages** (contre −11,6 avant). Le passe-bande
  de la nappe lui retire son grave, et au lobby elle joue une octave plus bas
  que partout ailleurs : c'est là que la coupe se voit le plus. Le passage
  lobby → stage est donc un saut de niveau marqué.

Ni l'un ni l'autre n'est un défaut : ce sont des conséquences chiffrées de la
DA choisie, laissées telles quelles faute d'une décision contraire. Le studio
ne permet pas de comparer deux ambiances au même niveau, ce qui explique
qu'elles aient pu passer inaperçues.

### Adopter

« Exporter » rend le bloc à recopier dans `src/data/son-presets.js`, plus les
cinq codes. Rien n'est écrit automatiquement : les presets adoptés sont
curatés à la main, comme les sprites.

## Overlay de debug

Touche **L** : intensité, mise au point, danger, acidité, ambiance courante.
Touche **M** : couper. On ne règle pas les mappages à l'oreille seule — il faut
voir les grandeurs observées pour savoir si c'est le mappage ou le timbre qui
ne va pas.

## La passe B (24/09/2026)

La passe A a construit le moteur ; la passe B lui fait **raconter** ce qui se
passe. Elle attendait que la DA soit calée, et c'était délibéré : son matériau
se règle sur des timbres, le coder avant de figer les presets aurait payé le
réglage deux fois. Les cinq codes adoptés étant écrits, le verrou est levé.

Cinq chantiers étaient au programme. **Trois ont été faits, deux abandonnés**
sur décision de l'auteur :

| Chantier | Décision |
|---|---|
| Couleur harmonique pilotée par le pH | fait, **sous condition** |
| Palette de boss dédiée | fait |
| Scénario du NEP | fait |
| Ostinato de biofilm tant qu'un producteur d'alginate vit | **abandonné** |
| Automate cellulaire faisant émerger les motifs | **abandonné** |

### La couleur acide, et pourquoi elle se mérite

L'accord de nappe **s'affaisse par le haut** quand le milieu s'acidifie : la
quinte tombe d'un demi-ton — le triton, le frottement le plus reconnaissable —
puis la tierce la suit. La fondamentale ne bouge jamais : c'est elle qui tient
la tonalité, la baisser ferait entendre une modulation et non une couleur.

Trois choix, chacun contre une alternative qui paraissait plus simple :

- **Altération chromatique, pas diatonique.** Baisser un degré de gamme ne
  marche pas sur les modes adoptés : le kombucha est déjà en phrygien (rien à
  baisser) et le levain en pentamineure (ni seconde ni sixte à toucher). Une
  règle par degré n'aurait rien changé sur **deux stages sur quatre**.
- **Par paliers, pas en continu.** Un glissando de la nappe contre une basse
  fixe s'entend comme un désaccordage, c'est-à-dire comme une panne. Deux
  seuils (0,35 et 0,70) avec une hystérésis de 0,08 — sans elle, un joueur
  posté pile sur un seuil fait clignoter l'accord à chaque image.
- **Conditionnée au senseur de pH.** C'est la condition posée par l'auteur, et
  elle est juste : `game.ph` est le pH **local**, relevé sous le joueur. Sans
  la carte en fausses couleurs qu'affiche l'évolution `phsense`, l'accord
  changerait en se déplaçant sans que rien à l'écran ne dise pourquoi — et un
  effet dont on ne peut pas voir la cause ne s'entend pas comme une
  information, il s'entend comme une panne. Conséquence assumée : `phsense`
  est une rare, donc la plupart des parties n'entendront jamais cette couleur.

Mesuré : **0,75 d'écart dans la bande de la nappe**, contre un témoin à 0,10
(le même état rendu deux fois — le plancher vient du tampon de bruit, tiré à
chaque instance). En large bande l'écart tombe à 0,11, ce qui est le vrai
enseignement de la mesure : **une voix sur six qui change d'un demi-ton ne se
mesure pas sur le mix entier**. Il faut regarder là où le mécanisme agit.

### La palette de boss TRANSFORME le rack, elle ne le remplace pas

Poser un rack fixe aurait effacé l'identité de la matrice au moment précis où
le joueur en reconnaît le mieux le décor — un boss du lait cru doit garder le
lead acide qui fait le lait cru, assombri. `rackBoss(base)` applique donc
quatre gestes au rack courant : coupure de nappe divisée par deux, désaccord
porté de 8 à 26 cents, sub tenu, ostinato en FM métallique, tension descendue
de 220 à 150 Hz. Elle passe par `appliquerRack`, le même chemin que le studio.

**Aucun niveau de patch n'est touché, et pourtant elle sort +1,9 dB plus fort**
(rms ×1,26). L'écart vient de la matière : la FM remplit la bande de
l'ostinato et le sub tenu ne se vide plus entre deux frappes. Crête mesurée à
0,21, très loin de l'écrêtage. La règle à retenir est l'inverse de l'intuition :
ici, **monter un `niveau` serait ce qui casserait tout**, puisqu'il s'ajouterait
à un +1,9 dB déjà acquis.

### Le NEP : huit secondes rendues au joueur

Le cycle prévient 8 s à l'avance (`TELEGRAPHE`, `pipe.js`). La montée est un
bruit qui **se resserre** — d'une frappe toutes les quatre doubles croches à
une par double croche — et qui monte en fréquence. La rampe est en *m²* et non
linéaire : une rampe régulière s'entend comme un décor, le carré garde la
montée discrète les cinq premières secondes et la précipite sur les trois
dernières, ce qui est la forme d'une alarme.

L'impact porte le **timbre du biocide**. Les quatre chimies ont quatre contres
différents ; reconnaître laquelle arrive à l'oreille rend au joueur les huit
secondes qu'il passait à lire la bannière.

| Biocide | Contre | Timbre |
|---|---|---|
| Soude | s'abriter | grave, sourd, octave basse, bruit à 120 Hz |
| Acide nitrique | tolérance à l'acide | **un demi-ton au-dessus de la tonique** — le frottement le plus dur ; l'abri ne sert à rien, et ça s'entend |
| Hypochlorite | catalase | quinte, bruit métallique à 2,6 kHz |
| Acide peracétique | catalase + efflux | le plus haut, le plus long, le plus brillant : le seul que l'abri ne sauve pas |

La table est **locale à l'audio** et nommée par identifiant : le moteur de son
n'importe rien de `pipe.js`, c'est tout le principe d'`observe()`. Le prix est
qu'un biocide ajouté là-bas doit l'être ici ; un `defaut` évite que l'oubli
fasse un silence, et le banc le signale.

### Le défaut que le banc a trouvé, et qu'aucune oreille n'aurait trouvé

La couche de tension porte deux choses : le battement de vie basse et la
montée du NEP. Son gain suivait le seul `danger`. **Un joueur à pleine vie
voyait donc la montée planifiée dans un bus à gain nul** — rms ×1,00 entre le
début et la fin de la montée. Le riser existait, personne ne pouvait
l'entendre, et rien n'aurait levé d'exception. Le gain suit désormais la plus
forte des deux causes : ×1,53 mesuré.

C'est la règle 1 du dépôt dans sa forme la plus nue : un moteur audio qui ne
lève pas d'exception peut très bien ne produire que du silence.

### Les cinq verdicts, chacun vérifié en remettant son défaut

`npm run son:check` en compte désormais **17**. Les cinq nouveaux ont tous été
vus échouer, un par un, le défaut remis — un verdict qu'on n'a pas vu échouer
ne garde rien :

| Verdict | Valeur | Défaut remis | Échoue à |
|---|---|---|---|
| la couleur acide affaisse l'accord | 0,75 | altération neutralisée | 0,09 |
| la couleur acide est conditionnée au senseur | 0 → 2 | verrou retiré | 2 → 2 |
| la palette de boss change le son sans saturer | 0,43 / crête 0,21 | palette neutralisée | 0,11 |
| la montée du NEP monte | ×1,53 | bus sourd au NEP | ×1,00 |
| les quatre biocides diffèrent | 0,32 | un seul timbre | 0,00 |

### Les deux abandons

- **L'ostinato de biofilm** : écarté par l'auteur, l'idée ne lui plaît pas.
- **L'automate cellulaire** : écarté faute d'avoir convaincu. C'était le plus
  spéculatif — faire émerger les motifs d'une simulation microbienne au lieu
  de les tirer d'un générateur pseudo-aléatoire. La graine compose déjà une
  matière distincte et mesurée (3/3, écart ×1,13) ; l'automate n'aurait pas
  ajouté une capacité, seulement une autre façon de produire la même.

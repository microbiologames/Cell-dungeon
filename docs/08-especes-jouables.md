# Espèces jouables

Quatre souches se pilotent. Elles partagent le moteur, le catalogue
d'évolutions et la boucle de jeu ; elles diffèrent par **quatre choses
seulement**, et c'est délibéré :

| | stats de base | toxine | morphologie | caractéristique unique |
|---|---|---|---|---|
| *L. plantarum* | la référence | acide lactique | bacille fin | — |
| *B. cereus* | plus gros, plus lent | céréulide | gros bacille à bouts droits | **sporulation** |
| *S. aureus* | coque compact | alpha-hémolysine | grappe dorée | **division multiplan** |
| *S. cerevisiae* | massive, lente | éthanol | levure bourgeonnante | **bourgeonnement** |

Tout le reste — inertie de nage, mise au point, acides aminés, niveaux,
directeur de vagues — est commun. Une souche est **un jeu de nombres et un
trait**, pas un second personnage à maintenir.

Le catalogue est dans `src/data/especes.js`, les traits dans
`src/game/player.js`, le dessin dans `src/render/organisms.js`, et tout est
vérifié par `npm run especes`.

---

## La règle qui commande

> **La caractéristique unique n'est pas une évolution.**

Elle est acquise à la première seconde, ne se tire jamais et ne se perd
jamais. Ce sont des **évolutions dédiées**, réservées à la souche, qui la
musclent. Une carte réservée ne sort **que** pour sa souche : elle serait une
carte morte dans la main des trois autres.

> **Toutes les souches piochent dans le même catalogue.**

Ce qui change est la **probabilité**. Fermer des cartes aurait produit quatre
listes à maintenir et tué le seul argument du jeu — qu'une cellule finit par ne
plus ressembler à son espèce. Un coque immobile tire donc *moins* de flagelles,
pas zéro. Mesuré sur 1500 mains (`npm run especes`) :

| souche | part des cartes « flagelle » tirées |
|---|---|
| *L. plantarum* | 17,5 % |
| *B. cereus* | 15,4 % |
| *S. aureus* | **8,7 %** |
| *S. cerevisiae* | **8,9 %** |

> **Le joueur a le droit de briser le réalisme, les mobs non.**

C'est pour ça qu'un staphylocoque immobile peut nager, et qu'un *Bacillus*
peut former six spores quand la cellule réelle n'en fait qu'une. La
justification est celle du jeu depuis le début : le transfert horizontal de
gènes.

---

## Stats de départ

Relevées par `npm run especes`, pas estimées :

| souche | DPS | × réf | PV | vitesse | portée | hitbox |
|---|---|---|---|---|---|---|
| *L. plantarum* | 22,0 | 1,00 | 100 | 68 | 96 | 3,4 |
| *B. cereus* | 21,8 | 0,99 | 132 | 62 | 112 | 4,3 |
| *S. aureus* | 19,0 | 0,86 | 118 | 58 | 84 | 3,0 |
| *S. cerevisiae* | 17,5 | 0,80 | 210 | 46 | 104 | 6,0 |

L'égalité de DPS **n'est pas le but** : le banc n'exige qu'une bande
`[0,70 ; 1,30]`. En dessous, une souche ne tue plus assez vite pour récolter
ses acides aminés, et la spirale est sans retour — c'est ce qui fixe la borne
basse, pas une idée d'équité.

Les écarts suivent la biologie. Une cellule de *B. cereus* fait 1,0 à 1,2 µm
de large contre 0,5 à 1 µm pour un lactobacille : plus de PV, plus
d'encombrement. Une levure fait 5 à 10 µm — un eucaryote, dix à cent fois le
volume d'une bactérie : beaucoup de PV, une grosse cible, une nage lourde.

---

## Les toxines

Le tir n'est pas un décor. Chaque toxine se comporte selon la **chimie** de la
molécule, et c'est ce qui différencie les souches autant que leurs stats.

| | acidifie le terrain | arrêtée par un globule gras | force gardée à bout de portée | à l'impact |
|---|---|---|---|---|
| acide lactique | **oui** | oui | 50 % | — |
| céréulide | non | **non** | **100 %** | — |
| alpha-hémolysine | non | oui | 75 % | **pore : 3,2 dgt/s pendant 3,5 s** |
| éthanol | non | **non** | 65 % | **−30 % de vitesse pendant 1,4 s** |

Trois conséquences de jeu, toutes issues de la molécule :

- **Seul l'acide lactique fabrique son terrain.** Mesuré en capture de
  contrôle : après une minute de jeu, le pH local est à 5,1 avec le
  lactobacille contre 6,2 à 6,4 avec les trois autres. Le confort acide,
  qui donne de la cadence, n'existe donc que pour lui — et il est **négatif**
  pour *B. cereus*, qui ne pousse plus sous pH 4,9.
- **Les globules gras n'abritent pas de tout le monde.** L'acide lactique est
  hydrosoluble et ne pénètre pas la phase grasse ; la céréulide et l'éthanol
  sont lipophiles, la graisse est leur solvant et non leur mur. Deux souches
  traversent donc un décor qui protège les autres.
- **Ce qui ne se dilue pas garde toute sa puissance.** Un depsipeptide
  cyclique thermostable ne s'étale pas en vol : la céréulide mord aussi fort
  à bout de portée qu'au départ, ce qui compense sa cadence lente.

---

## *B. cereus* — la sporulation

**Ce que c'est.** À la lyse, la cellule sporule au lieu de mourir. Chaque
spore est une vie. Crédit épuisé, la partie est finie.

**Ce que ça coûte.** La cellule mère est perdue — l'écran montre la spore, pas
le bacille. Elle est **dormante** 1,8 s : immobile, muette, elle ne tire pas.
Elle est invulnérable pendant toute la germination (mesuré : 1,8 s de dormance
pour 3,3 s d'invulnérabilité), puis repart à **70 % des PV**.

**Où ça se lit.** Sur le corps : l'endospore réfringente est visible **dans**
le bacille tant qu'il en a une en réserve, exactement comme chez les mobs
*Bacillus*. Et dans le HUD, une pastille par spore.

**Les évolutions dédiées.**

| carte | rangs | effet |
|---|---|---|
| Sporulation multiple | 3 | +1 spore de réserve par rang |
| Germination rapide | 2 | sortie plus rapide, davantage de PV rendus |

La dormance VBNC, qui est la réponse des *non* sporulants au même problème,
voit sa probabilité divisée par quatre chez cette souche : elle ferait doublon.

---

## *S. aureus* — la division multiplan

**Ce que c'est.** On commence **unicellulaire**. L'amas se gagne : une cellule
de plus par rang de l'évolution dédiée, jusqu'à six. Chaque cellule ajoute de
la toxine.

**Ce que ça coûte.** L'amas **se déconstruit proportionnellement aux PV**.
Mesuré à six cellules :

| PV | 100 % | 80 % | 50 % | 30 % | 10 % | 1 % |
|---|---|---|---|---|---|---|
| cellules | 6 | 5 | 3 | 2 | 1 | 1 |

Les dégâts suivent : **18,1 à plein contre 9,5 blessé**. C'est un personnage
en boule de neige qui fond — la spirale de la mort est *visible sur le corps*
avant d'être subie. Contrepartie inverse : la hitbox suit aussi la grappe
(4,5 px à six cellules contre 3,0 seul), donc un amas complet est une grosse
cible.

**Les évolutions dédiées.**

| carte | rangs | effet |
|---|---|---|
| Division multiplan | 5 | +1 cellule et +16 PV par rang |
| Quorum accessoire (agr) | 2 | +8 % de dégâts par cellule vivante et par rang |

**La couleur.** Elle est **dorée**, et c'est un caractère d'identification
réel : la staphyloxanthine, un caroténoïde qui pigmente les colonies et
protège la bactérie des espèces réactives de l'oxygène. C'est littéralement ce
que dit son nom d'espèce.

---

## *S. cerevisiae* — le bourgeonnement

**Ce que c'est.** Un bourgeon mûrit en continu, en **50 s** (mesuré : 50,0 s
pour 50 annoncées, boucle de jeu réelle). À la lyse, si le bourgeon est mûr,
la cellule fille prend la place de la mère : **PV pleins**, et le personnage
se déplace d'un rayon — la fille naît sur le flanc.

**Ce que ça coûte.** **La moitié des rangs d'évolution acquis, au hasard**
(mesuré : 8 rangs → 4). On tire rang par rang et non carte par carte : perdre
d'un coup les cinq rangs d'une commune et rien d'autre serait une loterie bien
plus violente que la moitié annoncée.

Bourgeon vert, la lyse tue. C'est ce qui fait de la maturation une horloge que
l'on surveille.

**Où ça se lit.** Sur le corps : la taille du bourgeon *est* la jauge. Il part
d'un renflement à peine visible et finit à 60 % de la mère, avec un liséré
clair qui pulse quand il est armé.

**Les évolutions dédiées.**

| carte | rangs | effet |
|---|---|---|
| Ségrégation fidèle | 2 | la perte tombe à 34 %, puis 22 % |
| Bourgeonnement précoce | 3 | le bourgeon mûrit 25 % plus vite par rang |

La ségrégation **n'annule jamais** la perte : une division gratuite ferait du
trait une seconde vie sans contrepartie, et le personnage n'aurait plus de
prix à payer.

---

## Le choix de la souche : la niche

Il se fait **en nageant**, comme le choix de la matrice — mais dans une
**pièce à part**. Une petite maison de biofilm est posée au bas de la boîte de
Petri ; on y entre, on trouve les quatre souches endormies chacune dans son
alvéole, on va au contact de celle qu'on veut, on la **devient**, et on
ressort par la porte.

Le maintien est de 0,3 s partout dans la niche — entrer, changer de souche,
sortir. C'est la moitié des 0,65 s d'un départ en matrice : tout ce qui se
passe ici est réversible et gratuit. La souche choisie **survit** au retour au
lobby et aux parties suivantes.

### Pourquoi une pièce, et pas quatre colonies sur la gélose

La version précédente semait les quatre colonies entre les puits. Elle
marchait, mais elle mélangeait deux gestes de nature différente : on nageait
dans une colonie pour changer de corps et dans un puits pour partir en
mission, **avec la même commande et à dix pixels d'écart**. Les rassembler
dans une pièce sépare les deux — dedans on s'habille, dehors on part.

### Le lobby est un cadran de montre, la niche au centre

Six positions à 60° sur un anneau de **78 px**, et la maison au milieu.

| Heure | Contenu |
|---|---|
| 12 h | lait cru |
| 2 h | conduite |
| 4 h | kombucha |
| **6 h** | **bestiaire** |
| 8 h | levain |
| 10 h | sang (à venir) |

Le rayon 78 vient de deux contraintes qui se rejoignent : à 60° l'entraxe vaut
exactement le rayon, donc il reste **33 px de gélose** entre deux puits
voisins une fois leurs anneaux déduits ; et le bord extérieur d'un puits tombe
à 99 px pour un champ de 124, donc **25 px de gélose derrière**.

La niche a mis trois essais à trouver sa place : quatre colonies semées entre
les puits, puis une maison coincée au bas de la couronne où elle frôlait le
kombucha — 2,3 px entre les deux anneaux au premier essai, 6,2 au second,
jamais confortable. **Au centre le problème disparaît** : le puits le plus
proche est à 78, son anneau s'arrête à 55,5, la maison à 23. Il reste 32 px
tout autour. Et c'est la bonne place au sens du jeu — le centre est là où
l'œil tombe, et ce qu'on y met est ce qu'on fait en premier.

Les alvéoles à l'intérieur ont eu le même genre de correction : à 50 px de
rayon sur 140°, leurs bourrelets d'EPS se recouvraient et les quatre fondaient
en une guirlande. À 56 px sur 150°, il reste 7,3 px de mur entre deux voisines
et chacune se lit seule.

### La fiche de souche dit la MÉCANIQUE, pas les chiffres

Devant une alvéole, le HUD donne le nom, la sous-catégorie, la caractéristique
unique et **une phrase** : celle qui dit ce qu'on gagne et ce qu'on perd.

```
S. CEREVISIAE
LEVURE DE BIERE
BOURGEONNEMENT
UN BOURGEON MURIT EN CONTINU. A LA LYSE, LA CELLULE FILLE
PREND LA PLACE DE LA MERE : PV PLEINS, MAIS LA MOITIE DES
EVOLUTIONS ACQUISES EST PERDUE AU HASARD.
```

Un premier jet listait trois atouts et trois faiblesses **dérivés des stats**
— « ENCAISSE », « GROSSE CIBLE », « CADENCE LENTE ». C'était juste, calculé,
impossible à laisser diverger de l'équilibrage… et inutile : ça décrivait un
**profil**, pas une **façon de jouer**. On ne choisit pas *S. cerevisiae*
parce qu'elle encaisse, on la choisit parce qu'elle renaît en perdant la
moitié de son génome.

La phrase vient de `trait.desc`, qui existait déjà et n'était affichée nulle
part — elle ne servait qu'à la carte d'évolution réservée. Aucune duplication :
c'est le même texte aux deux endroits.

Seule la référence, qui n'a **pas** de trait, a besoin qu'on écrive la sienne
(`resume` dans `especes.js`) : *« Aucune capacité de secours : ni spore, ni
amas, ni bourgeon. En échange elle prospère dans l'acide qu'elle fabrique, et
c'est la souche sur laquelle tout le jeu est calé. »*

### Le paragraphe se coupe tout seul

`sceneText().paragraphe()` coupe aux espaces à la largeur réelle de la
colonne. Le chiffre ne peut pas être codé en dur : en paysage la colonne va de
**64 à 110 px** selon la fenêtre (16 à 27 caractères à 4 px le glyphe), en
portrait c'est presque toute la largeur — 62 caractères. Coder l'un donnerait
faux dans l'autre, ce qui est précisément le défaut que `hud-anchor.js` existe
pour corriger.

Vérifié sur capture dans les deux orientations, avec la phrase la plus longue
des quatre (celle de la référence, 172 caractères) et la fenêtre qui donne la
colonne la plus mince, 620 × 590 : treize lignes, aucune ne mord sur le disque
ni ne sort par le bas.

---

## La couleur du joueur

La règle du jeu est *la forme porte l'espèce, la couleur porte la menace* :
elle s'applique aux **mobs**. Le joueur est seul de son espèce à l'écran ; sa
couleur peut donc dire **qui il est**, et c'est la seule information qui
manquerait sinon.

| souche | teinte | pourquoi |
|---|---|---|
| *L. plantarum* | vert | la couleur historique du personnage |
| *B. cereus* | violet | le cristal violet du Gram, qui colore tous les Gram + |
| *S. aureus* | **or** | la staphyloxanthine, caractère réel |
| *S. cerevisiae* | sépia | mesuré : en doré, elle se confondait avec la teinte `yeast` des mobs splitter, à deux cases d'elle |

Le **boss** *S. aureus* du lait cru, lui, reste **rouge** : c'est un mob, et
pour les mobs la couleur porte la menace, pas l'espèce. Les deux se croisent
pourtant dans la même partie si l'on joue cette souche — une grappe dorée de
six cellules face à une grappe rouge de vingt-six pixels. C'est lisible
justement parce que la règle n'est pas la même des deux côtés.

---

## Le banc

```
npm run especes            # tous les verdicts
node tools/especes.mjs 4   # 4 runs par souche au lieu de 2
node tools/player-look.mjs souches   # la planche des quatre corps
```

Il vérifie quatre familles de choses :

1. **les stats** tiennent dans la bande, chaque souche a sa propre toxine ;
2. **le tirage** est cloisonné (aucune carte réservée ne fuit chez une autre
   souche) et les biais annoncés se voient dans les chiffres ;
3. **la chimie** des toxines dans le moteur : acidification, phase grasse,
   pore, ralentissement, dilution ;
4. **les caractéristiques uniques**, déclenchées pour de vrai dans la boucle
   de jeu, et ce qu'elles ont fait ensuite.

> **Ce que la construction du banc a appris.** Les attentes de la table
> `ATTENDU` vivent **dans le banc**, pas dans `especes.js`. Mesure faite en
> remettant huit défauts : les deux qui *supprimaient* un champ de `TIRS`
> passaient tranquillement, parce que le verdict disparaissait avec le champ
> qu'il gardait. Un verdict qui lit son attente dans la donnée qu'il vérifie
> ne garde rien.

Deuxième leçon du même genre, côté harnais : la première mesure de maturation
du bourgeon annonçait 75 s pour 50. Le défaut n'était pas dans le jeu — le
temps du banc continuait de courir pendant les montées de niveau, où la boucle
est gelée. Le banc coupe donc le gain d'acides amines pendant cette mesure.

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

## Le choix de la souche

Il se fait comme le choix de la matrice : **en nageant**. Quatre petites
colonies sont posées sur la gélose du lobby, entre les puits et la paroi. On
entre dans l'une, on **devient** la cellule qu'elle contient — morphologie et
couleur changent sur-le-champ, et le HUD annonce la caractéristique.

Le maintien est deux fois plus court que pour entrer dans une matrice (0,3 s
contre 0,65 s) : changer de souche est réversible et gratuit, y entrer ne
l'est pas. La souche choisie **survit** au retour au lobby et aux parties
suivantes.

Géométrie : les colonies sont à 84 px du centre, dans les intervalles de la
couronne des puits. Mesure : la plus serrée garde 13 px de marge avec le puits
voisin, et reste à 83 px du centre pour 92 px de nage. Les poser sur la
couronne elle-même les collait aux puits — et un choix de souche déclenchait
alors un départ de partie.

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

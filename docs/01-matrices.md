# Matrices (stages)

Chaque matrice = un biotope réel, donc une flore réelle, des paramètres
physico-chimiques réels, et des dangers qui en découlent. Le joueur démarre
en *Lactococcus lactis* et traverse les matrices dans l'ordre.

Format commun : **12 minutes**, mini-boss à 4:00 et 8:00, boss à 12:00.

---

## 1 — Lait cru (tank réfrigéré, 36 h)

> Tutoriel de luxe. Votre matrice d'origine : vous y êtes chez vous.

| Paramètre | Valeur | Effet de jeu |
|---|---|---|
| Température | 6 → 12 °C | Les psychrotrophes (*Pseudomonas*) sont rapides, les mésophiles lents |
| pH | 6.7 → 5.0, **localement** | Voir ci-dessous |
| Oxygène | microaérophile | Neutre |
| Encombrement | fort | Globules gras (1–8 µm) : obstacles dérivants qui **bloquent les tirs** et masquent |

**Observation : fond clair.** Le lait est blanc, on le regarde donc comme un
frottis coloré — organismes sombres sur fond crème. C'est la seule matrice
dans ce mode ; les trois autres sont en fond noir.

**Le décor n'est pas un fond.** Deux éléments remplissent le champ et se
comportent à l'opposé l'un de l'autre :

| Élément | Comportement | Fondement |
|---|---|---|
| **Globule gras** | On s'y **adsorbe** : on ralentit à 42 %, on est retenu, on se détache. Il **arrête les gouttes d'acide** — donc c'est un abri, pour vous comme pour les mobs | Les bactéries s'associent réellement à la phase grasse du lait, retenues par la membrane du globule (MFGM). L'acide lactique est hydrosoluble et ne pénètre pas une phase lipidique |
| **Bulle d'air** | On **rebondit** dessus | Le lait est aéré pendant le pompage |

Les deux interactions sont volontairement opposées pour que le champ se lise
d'un coup d'œil : ce qui est doré colle, ce qui est clair repousse.

**Les effets ne sont pas des cercles.** L'EPS et les gels sont rendus en
**bouffées** : une poignée de lobes décalés, figés par l'identifiant de la
zone. Une traînée d'EPS s'étend, s'enroule et se dilue comme de la fumée ;
un coagulum prend, ne bouge presque pas, et garde un bord grumeleux. Chaque
dépôt d'EPS a son rayon et sa durée propres, sinon la traînée se lit comme un
chapelet de perles.

**La lyse est un événement.** Trois couches superposées : une onde de choc
brève qui donne le coup, des **fragments de paroi** allongés et tournoyants
qui portent la couleur de l'espèce — donc on voit *qui* vient d'éclater — et
des gouttelettes de cytoplasme. Tout est dimensionné sur le rayon du mob :
un coque fait un petit nuage, un boss fait un événement.

Les **acides aminés partent avec l'explosion** : ils héritent de la vitesse
de la gerbe, s'amortissent, puis dérivent avec le courant du milieu et son
agitation brownienne. Rien ne reste posé sur place dans un bouillon.

**La faune neutre.** Des **cellules somatiques** (leucocytes de la vache)
dérivent dans le champ, souvent floues, et ne vous veulent rien. Leur
numération cellulaire est un critère réglementaire de qualité du lait : elles
sont réellement là, et elles donnent au champ sa profondeur.

**Signature — le pH est un terrain, pas un compteur.**

Le pH n'est pas une valeur globale : c'est une **carte** (grille 96 × 96 sur
l'arène). Chaque goutte d'acide lactique dépose sa charge là où elle crève —
sur la cellule touchée, ou au sol en fin de course — puis l'acide diffuse
lentement et le milieu le tamponne encore plus lentement. Les poches
d'acidité **persistent** et suivent les endroits où l'on s'est battu.

| Seuil | Effet |
|---|---|
| pH < 5.6 | Les coliformes (*E. coli*) perdent 25 % de vitesse |
| pH < 5.2 | Les *Pseudomonas* subissent 3 dégâts/s |
| pH < 5.7 | **Vous** gagnez jusqu'à +14 % de cadence : une bactérie lactique est chez elle dans l'acide qu'elle produit |

Fabriquer son terrain devient donc une tactique : tenir une poche acide, c'est
tirer plus vite pendant que la flore indésirable y ralentit et y brûle. Le
`Senseur de pH` révèle la carte en fausses couleurs.

Le champ est par ailleurs saturé de globules gras très réfringents, qui
bloquent les tirs et masquent.

**Mécanique introduite** : la mise au point (les phages arrivent à `z ≈ +0.5`
et n'en bougent pas).

**Flore** : `lc` *Lactococcus lactis* sauvage · `leu` *Leuconostoc mesenteroides* ·
`ec` *Escherichia coli* · `ps` *Pseudomonas fragi* · `kl` *Kluyveromyces marxianus* ·
`geo` *Geotrichum candidum* · `bc` *Bacillus cereus* · `phg` phage lactococcique 936

**Mini-boss 4:00** — *Staphylococcus aureus* (grappe) : coagulase.
**Mini-boss 8:00** — *Bacillus cereus* sporulé (vague de spores).
**Boss 12:00** — *Listeria monocytogenes* : culbute, trois phases.

---

## 2 — Conduite industrielle (acier 316L, biofilm) — **implémentée**

> Ce n'est pas une arène, c'est un **couloir**. On n'y tourne pas autour de la
> horde : on l'affronte de face, dos au courant.

**Valeurs réellement codées** (`src/data/matrices.js`, `src/game/pipe.js`) :

| Constante | Valeur | Où |
|---|---|---|
| Forme de l'arène | tube `halfX 1400`, `halfY 112` | `PIPE.arena` |
| Écoulement | 34 px/s au centre, profil `1 − (y/hy)²` | `PIPE.pipe.flow` |
| Période du NEP | 150 s, dont 8 s de télégraphe | `PERIODE`, `TELEGRAPHE` |
| Vitesse du front | 230 px/s, demi-lame 64 px | `VITESSE_NEP`, `DEMI_FRONT` |
| Plaques | tous les 230 px, alternées haut/bas, repousse 45 s | `PAS_PLAQUE`, `REPOUSSE` |
| pH | 5.4 → 3.6 | `PIPE.chem` |
| Budget de menace | ×0.68 du budget commun | `PIPE.budgetScale` |
| Plafonds de rôle | `runner 4`, `tank 3`, `predator 1` | `PIPE.roleCaps` |

**Pourquoi le budget est réduit et les plafonds abaissés.** Un couloir de
224 px de large concentre : à budget égal, la pression au pixel visible y est
bien plus forte que dans une goutte de 2800 px, et surtout **on n'y décroche
pas** — un nageur rapide reste collé, faute de place pour le semer. Mesuré
sans ces deux garde-fous : *P. aeruginosa* faisait à lui seul **96 % des
dégâts subis** et le pilote automatique mourait 3 à 12 fois plus que dans le
lait cru. Ce ne sont pas des réglages de difficulté, ce sont des propriétés
de la **forme** de l'arène.

| Paramètre | Effet de jeu |
|---|---|
| Forme de l'arène | Le déplacement est **essentiellement gauche-droite** |
| Écoulement laminaire | Poussée permanente ; remonter le courant coûte cher. Le courant emporte aussi les gouttes d'acide (à 60 %) et les acides aminés libres (à 45 %) : rien ne reste où on l'a laissé |
| Couche limite | Le courant y tombe à zéro : les 11 px le long de chaque paroi sont un refuge, matérialisé par un liseré pointillé |
| Surface | Inox rayé + EPS. Les rayures sont des anfractuosités : abri contre le NEP |
| Nettoyage | **NEP toutes les 150 s**, voir plus bas |

### L'axe Z devient la stratification du biofilm

C'est ce qui distingue cette matrice de toutes les autres. On n'observe pas
une goutte, on observe **une paroi en coupe**, et la profondeur cesse d'être
seulement optique :

```
z = +1   acier, base du biofilm     mobs denses, abri total contre le NEP
z =  0   matrice d'EPS              votre plan par défaut
z = -1   lumière de la conduite     courant maximal, balayé par le NEP
```

Descendre dans le biofilm (`z > 0`) met à l'abri du courant et des biocides,
mais c'est là que la population est la plus dense et que les persistants
vivent. Remonter dans le flux (`z < 0`) dégage le champ, mais vous expose.
La molette n'est donc plus seulement une arme de ciblage : c'est un
**déplacement**.

> **Écart d'implémentation, assumé.** La molette reste pour l'instant un plan
> d'*observation*, pas un déplacement : le joueur n'a pas de coordonnée `z`.
> Les plaques vivent à `z = +0.55`, donc il faut **descendre la mise au point
> pour les voir et les toucher** — la profondeur sert déjà, et c'est déjà une
> décision. Mais l'abri (courant, NEP) est calculé en 2D : on est protégé si
> l'on est *dans* le rayon d'une plaque, ou dans les 11 px de couche limite
> contre la paroi. Donner un `z` au joueur change le modèle de collision du
> jeu entier ; ce sera un chantier à part, pas un effet de bord de la
> conduite.

### Logique de biofilm

La paroi porte des **plaques de biofilm** colonisables, visibles comme des
amas d'EPS accrochés en haut et en bas du couloir.

- Chaque plaque **émet** des mobs à intervalle régulier, indéfiniment.
- Détruire une plaque tarit sa source, mais elle **se reforme** en 45 s si un
  *P. aeruginosa* survit à proximité (c'est lui qui sécrète l'alginate).
- Se tenir dans une plaque : immunité au courant, immunité au NEP, mais
  dégâts de contact continus et vision réduite.

Le jeu consiste donc à arbitrer entre nettoyer les sources et survivre à ce
qu'elles produisent — exactement le problème d'un atelier réel.

### Le Nettoyage En Place, et ses biocides

Toutes les 150 s, un cycle démarre : 8 s de télégraphe (le champ vire, le
courant s'accélère), puis **une vague traverse le couloir de bout en bout**.

Les biocides **tournent**, et chacun a un contre différent. C'est là que le
build construit dans le lait cru se révèle bon ou mauvais :

| Cycle | Biocide | Mécanisme réel | Ce qui vous sauve |
|---|---|---|---|
| 1 | **Soude 2 %** | Saponifie les lipides membranaires | S'abriter (anfractuosité ou biofilm) |
| 2 | **Acide nitrique** | Choc de pH, déminéralise | `Réponse de tolérance à l'acide` |
| 3 | **Hypochlorite** | Oxydant, génère des ROS | `Catalase / SOD` |
| 4 | **Acide peracétique** | Oxydant fort, pénètre l'EPS | `Catalase` **et** `Efflux multidrogue` |

Le cycle 4 est le seul que l'abri ne sauve pas : l'acide peracétique traverse
l'EPS, ce qui est sa qualité industrielle réelle. Il faut l'encaisser
chimiquement ou pas du tout.

Les mobs meurent aussi dans le NEP. C'est donc une arme, si on sait se placer.

**Mécanique introduite** : la **phagocytose subie**. *Acanthamoeba* broute le
biofilm et vous gobe. Sans `Endolysine`, c'est 4 s d'impuissance et 35 dégâts.
Avec, vous le tuez de l'intérieur — c'est le moment où l'évolution paie.

**Flore** : *Pseudomonas aeruginosa* (alginate, quorum sensing) ·
*Listeria monocytogenes* persistante · *Sphingomonas* (adhésion) ·
spores de *Bacillus* adhérées · *Acanthamoeba castellanii* ·
cellules en *swarming* lâchées par les plaques.
Neutre : *Methylobacterium*, méthylotrophe rose des réseaux d'eau.

**Mini-boss 4:00** — *P. aeruginosa* mucoïde (mutation `mucA`).
**Mini-boss 8:00** — *Acanthamoeba* géante (phagocytose, broutage, kyste).

**Boss 12:00** — **Le biofilm mature** : une masse immobile occupant tout le
fond du couloir, quatre points d'ancrage à détruire. Elle se rétracte quand on
l'acidifie et envoie des essaims. Fenêtre de dégâts pendant le NEP.

> **Écart d'implémentation, assumé.** Le boss est pour l'instant une **masse
> unique** (3200 PV, trois phases : essaimage, rétraction, dispersion), pas
> quatre ancrages indépendants. La fenêtre de dégâts pendant le NEP est bien
> là : le NEP inflige 26 dps au boss au lieu des 95 qu'il inflige à la flore
> ordinaire — il l'entame sans le tuer, donc il ouvre une fenêtre au lieu de
> faire le travail. Les quatre ancrages demandent un boss multi-entités, ce
> que le moteur ne sait pas encore faire.

## 3 — Kombucha (jarre, jour 7) — *spécifiée, pas encore jouable*

> Vous entrez en territoire hostile : à pH 2.8, une bactérie lactique n'a rien
> à faire là. C'est le stage « survie chimique ».

| Paramètre | Valeur | Effet de jeu |
|---|---|---|
| pH | 2.8 | 5 dps sans ATR ; l'ATR devient obligatoire |
| Éthanol | 0.5 → 2 % v/v | Nuages qui **inversent les commandes** 2 s |
| Acide acétique | fort | Vos propres tirs lactiques font **moitié moins** (le milieu est déjà saturé) |
| Oxygène | gradient vertical | Zone aérobie en surface (`z < -0.4`) : les AAB y sont deux fois plus rapides |
| Cellulose | pellicule (SCOBY) | **Murs** de cellulose bactérienne qui poussent en temps réel et referment l'arène |

**Signature** : l'arène **rétrécit**. *Komagataeibacter xylinus* tisse de la
cellulose en continu ; si on ne tue pas les tisseurs, on finit emmuré.
Priorité de cible imposée par la matrice, pas par le HUD.

**Mécanique introduite** : le **gradient d'oxygène sur l'axe Z**. Pour la
première fois, la profondeur a une valeur intrinsèque, pas seulement optique.

**Flore** : *Acetobacter pasteurianus* · *Gluconacetobacter* ·
*Komagataeibacter xylinus* (tisseur) · *Brettanomyces bruxellensis* ·
*Zygosaccharomyces bailii* (osmophile, très résistante) · *Saccharomyces cerevisiae*

**Boss 12:00** — **Le SCOBY** : la pellicule entière s'anime. Régénère tant
qu'un tisseur est vivant.

---

## 4 — Sang (in vivo) — *spécifiée, pas encore jouable*

> La matrice où tout ce que vous avez volé aux autres se retourne contre vous.

| Paramètre | Valeur | Effet de jeu |
|---|---|---|
| Écoulement | pulsatile 1.2 Hz | Le courant **bat** ; se déplacer à contre-temps coûte 40 % de vitesse |
| Température | 37 °C | Tout le monde est rapide |
| Complément | actif | **CAM** : rayon qui se charge 1.5 s puis inflige 40 dégâts. Contré par la capsule |
| Opsonisation | cumulative | Les anticorps marquent : +20 % de dégâts reçus par pile, 8 piles max |
| Antibiotiques | 3 vagues (6:00, 9:00, 11:00) | β-lactame → **vos évolutions Peptidoglycane deviennent une faiblesse** |

**Signature — la punition du build** : la β-lactamine cible la synthèse du
peptidoglycane. Chaque évolution `Réticulation du peptidoglycane` prise
multiplie les dégâts de la vague d'antibiotique par 1.25. Le tank pur meurt
ici s'il n'a pas pris `β-lactamase`. C'est la seule contre-incitation forte
du jeu, et elle est scientifiquement exacte.

**Mécanique introduite** : l'**immunité adaptative**. Les neutrophiles
apprennent : chaque mort d'un neutrophile augmente de 4 % la vitesse des
suivants, pour tout le reste du run.

**Faune** : neutrophiles (phagocytose, NETs) · macrophages (tank, phagocytose
longue) · plaquettes (coagulation) · *Staphylococcus aureus* (coagulase, SCV) ·
*Streptococcus pyogenes* (protéine M, streptolysine O) ·
*Neisseria meningitidis* (capsule, résiste au complément)

**Boss 12:00** — **La réponse immunitaire coordonnée** : pas un organisme, un
système. Trois neutrophiles liés par des NETs, plus une pression de complément
qui monte. Il faut casser les NETs (ADNase — une vraie enzyme de *S. aureus*).

---

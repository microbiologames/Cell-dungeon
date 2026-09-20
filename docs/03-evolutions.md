# Évolutions

## Boucle

Tuer → **ADN extracellulaire** au sol → absorbé dans le rayon de captation
(transformation naturelle) → niveau → **3 cartes tirées au sort** → on en garde une.

Un **plasmide** (butin rare, garanti sur mini-boss) court-circuite tout : il
accorde **immédiatement** une évolution de rareté ≥ Rare, sans niveau et sans choix.
C'est la récompense qui fait dévier un build.

### Courbe d'expérience

```
ADN requis pour le niveau n :  X(n) = 8 + 6n + 0.55 n²
```

Un chaff lâche 1 à 3 brins, un tank 6 à 10, un boss 60.
Cela place le joueur autour du **niveau 26-30** à la fin d'un run de 12 min.

### Table de rareté

| Rareté | Poids | Probabilité par carte | Couleur HUD |
|---|---|---|---|
| Commune | 100 | ≈ 62.5 % | gris |
| Peu commune | 42 | ≈ 26.3 % | vert |
| Rare | 14 | ≈ 8.8 % | cyan |
| Épique | 4 | ≈ 2.5 % | violet |
| Légendaire | 1 | ≈ 0.6 % | or |

Le tirage est **sans remise** dans une main (pas de doublon) et exclut les
évolutions déjà prises à leur rang maximal. `Hypermutateur` multiplie les
poids des raretés ≥ Rare par 1.35 et fait tirer **4** cartes.

---

## Les six voies (classes implicites)

Aucune classe n'est annoncée au joueur. Elles émergent des synergies.
Chaque voie possède une **clé de voûte** (Épique ou Légendaire) qui ne
devient forte que si l'on a déjà investi dans la voie.

| Voie | Fantasme | Clé de voûte |
|---|---|---|
| **Acidophile** | Gros dégâts, petite portée, on fond le milieu | Nanotubes intercellulaires |
| **Diffuseur** | Petits dégâts, énorme zone, on sature | Phage lytique |
| **Cuirassé** | Lent, increvable, on encaisse | Spore |
| **Flagellé** | Vitesse, esquive, hit-and-run | Motilité en essaim |
| **Nécromancien** | Les phages retournent les mobs contre eux-mêmes | Conjugaison massive |
| **Prédateur** | Contact, absorption, vol de vie | Prédation périplasmique |

Les voies **Cuirassé** et **Flagellé** s'annulent mécaniquement
(peptidoglycane ralentit / flagelles accélèrent et grossissent la hitbox).
C'est voulu : c'est le principal arbitrage du jeu.

---

## Catalogue

Les valeurs ci-dessous sont la source de vérité et sont reprises
telles quelles dans `src/data/evolutions.js`.

### Communes — poids 100

| # | Nom | Effet | Rangs | Fondement |
|---|---|---|---|---|
| C1 | Lactate déshydrogénase | +12 % dégâts | 5 | LDH, enzyme terminale de la fermentation lactique |
| C2 | Pompe à protons (F₁F₀) | +8 % vitesse | 5 | ATPase membranaire, force proton-motrice |
| C3 | Ribosomes surnuméraires | +10 % cadence | 5 | Plus de ribosomes = plus de débit protéique |
| C4 | Flagelle supplémentaire | +9 % vitesse, **+4 % hitbox** | 6 | Chaque flagelle ajoute de la poussée et de l'encombrement |
| C5 | Réticulation du peptidoglycane | +14 PV, **−3 % vitesse** | 6 | Pontages peptidiques : paroi plus épaisse, plus lourde |
| C6 | Fluidité membranaire | +9 % cadence, **−6 % résistance** | 5 | Insaturation des acides gras : membrane fluide mais fragile |
| C7 | Perméase lactose (LacY) | +15 % d'ADN ramassé | 4 | Symport lactose/H⁺, l'opéron lac |
| C8 | Chimiotactisme (Che) | +25 % rayon de captation | 4 | Système Che, migration vers un gradient |
| C9 | Osmorégulation (bétaïne) | +10 PV | 4 | Soluté compatible accumulé en stress osmotique |
| C10 | Sécrétion Sec | +10 % vitesse de projectile | 4 | Translocon SecYEG |
| C11 | Diffusion acide | +10 % rayon des tirs | 4 | — |
| C12 | Acidification locale | Aura pH : 2 dps dans 22 px | 3 | L'acide s'accumule autour de la cellule |
| C13 | Réponse SOS (RecA) | +0.4 PV/s | 4 | Réparation de l'ADN induite par le stress |
| C14 | Cardiolipine | +6 % résistance | 4 | Phospholipide des pôles, stabilise la membrane |
| C15 | Homofermentaire strict | +15 % dégâts, **−8 % rayon** | 3 | Voie d'Embden-Meyerhof : lactate seul, rendement max |

### Peu communes — poids 42

| # | Nom | Effet | Rangs | Fondement |
|---|---|---|---|---|
| U1 | **Bactériocine (nisine)** | Les tirs ignorent 35 % de la résistance des Gram+ | 2 | La nisine de *L. lactis* forme des pores via le lipide II |
| U2 | **Hétérofermentation** | +1 projectile en éventail, −20 % dégâts / projectile | 3 | Voie des pentoses phosphates : lactate **+ CO₂ + éthanol** |
| U3 | Gélatinase (GelE) | Immunité à la coagulation, +5 % vitesse | 1 | Gélatinase d'*Enterococcus faecalis*, hydrolyse la gélatine |
| U4 | **Coagulase** | Les impacts déposent un gel (−45 % vitesse, 3 s) | 3 | Volée à *S. aureus* par transfert horizontal |
| U5 | Catalase / SOD | −40 % dégâts des espèces réactives de l'oxygène | 2 | Détoxification H₂O₂ et O₂⁻ |
| U6 | Capsule polysaccharidique | −35 % de chance d'être phagocyté, −5 % vitesse | 3 | Capsule antiphagocytaire |
| U7 | Protéase (PrtP) | Les tirs appliquent une corrosion (DoT 4 s) | 3 | Protéinase de paroi des lactocoques |
| U8 | Lipase / estérase | +25 % dégâts contre levures et moisissures | 3 | Hydrolyse des lipides membranaires |
| U9 | Pili de type IV | **Dash** (motilité par saccades), 6 s | 1 | *Twitching motility* par rétraction du pilus |
| U10 | Réponse de tolérance à l'acide | −50 % dégâts d'acide du milieu | 3 | ATR : adaptation réelle des lactiques au pH bas |
| U11 | Transformation naturelle | ADN compté double sous 40 % PV | 2 | Compétence naturelle, capture d'ADN libre |
| U12 | Exopolysaccharide (EPS) | Traînée visqueuse qui ralentit les poursuivants | 3 | EPS des lactiques (texturants du yaourt) |
| U13 | Autolysine régulée | +10 % dégâts, −10 % PV max | 3 | Hydrolases de paroi, remodelage au prix de la solidité |
| U14 | Profondeur de champ *(optique)* | −30 % de pénalité de netteté, +20 % zone nette | 3 | Ouverture du diaphragme |
| U15 | Transposon (élément IS) | Relance la main une fois par niveau | 1 | Éléments d'insertion, réarrangement génomique |

### Rares — poids 14

| # | Nom | Effet | Rangs | Fondement |
|---|---|---|---|---|
| R1 | **Prédation périplasmique** | Au contact, absorbe les mobs ≤ 60 % de votre taille (soin + ADN) | 2 | *Bdellovibrio bacteriovorus* pénètre le périplasme de sa proie |
| R2 | **Endolysine (LLO)** | Si phagocyté, lyse l'hôte de l'intérieur en 1.5 s | 1 | Listériolysine O : *Listeria* s'échappe du phagosome |
| R3 | **Phage tempéré** | Convertit un mob en allié 8 s (recharge 14 s) | 3 | Lysogénie, conversion phagique |
| R4 | **Spore** | Ressuscite une fois à 40 % PV, 6 s d'invulnérabilité | 1 | Endospore de *Bacillus* : survie à tout |
| R5 | β-lactamase | Immunité aux antibiotiques β-lactames | 1 | Hydrolyse du cycle β-lactame — la résistance historique |
| R6 | Efflux multidrogue | −30 % de tous les dégâts de zone du milieu | 2 | Pompe AcrAB-TolC |
| R7 | Quorum sensing (AI-2) | +6 % dégâts par mob net dans le champ (max +60 %) | 2 | Autoinducteur-2, décision collective selon la densité |
| R8 | Biofilm inductible | 1.5 s immobile → bouclier absorbant | 2 | Passage planctonique → sessile sous stress |
| R9 | Contraste de phase *(optique)* | Les mobs flous laissent un halo traceur visible | 1 | Anneau de phase de Zernike |
| R10 | Sidérophores | Chaque kill : +2 % cadence 8 s (max 10 piles) | 2 | Chélateurs de fer, captation en milieu carencé |

### Épiques — poids 4

| # | Nom | Effet | Rangs | Fondement |
|---|---|---|---|---|
| E1 | **Phage lytique** | Les mobs tués explosent en 6 capsides infectieuses | 2 | Cycle lytique : la cellule éclate et libère les virions |
| E2 | **Injectisome (T3SS)** | Tir perforant traversant toute la profondeur (ignore la netteté) | 2 | Seringue moléculaire du système de sécrétion de type III |
| E3 | **Hypermutateur (ΔmutS)** | +1 carte, ×1.35 sur les raretés hautes ; toutes les 45 s une stat varie de ±10 % | 1 | Souches mutatrices déficientes en réparation des mésappariements |
| E4 | Îlot de pathogénicité (SaPI) | Vole 2 capacités au hasard à un mob vaincu | 1 | Îlots de pathogénicité mobiles de *S. aureus* |
| E5 | Nanotubes intercellulaires | Draine 1.5 PV/s à tout mob net à moins de 90 px | 2 | Nanotubes d'échange cytoplasmique entre bactéries |

### Légendaires — poids 1

| # | Nom | Effet | Fondement |
|---|---|---|---|
| L1 | **Conjugaison massive (pilus F)** | Toutes les 30 s, un mob devient allié **définitif** | Conjugaison bactérienne, transfert du plasmide F |
| L2 | **CRISPR-Cas** | Immunité aux phages ennemis ; chaque phage détruit donne +1 % dégâts définitif | Immunité adaptative procaryote par mémoire de spacers |
| L3 | Symbiose (consortium) | Deux *L. lactis* satellites tirent à 50 % | Consortiums lactiques des ferments mixtes |
| L4 | Objectif à immersion *(optique)* | Tout le champ est net, mais le champ **rétrécit de 25 %** | Immersion à huile : n=1.515, résolution maximale, champ minimal |

---

## Note : « Phagocytose » vs prédation

Tu proposais *Phagocytose : absorbe au contact les micro-organismes plus petits*
et *Endolyse : lyse un micro-organisme de l'intérieur s'il nous a phagocyté*.

J'ai gardé **les deux mécaniques à 100 %**, en réattribuant les noms :

- **La phagocytose reste une capacité ennemie.** C'est un mécanisme
  eucaryote (remaniement d'actine) : aucun procaryote ne phagocyte. Elle est
  portée par *Acanthamoeba* (matrice 2), les neutrophiles et les macrophages
  (matrice 4). Ça rend ta mécanique d'**Endolyse** parfaitement juste : elle
  devient la réponse à *être* phagocyté, exactement comme la listériolysine O
  permet à *Listeria* de sortir du phagosome.
- **L'absorption au contact du joueur s'appelle « Prédation périplasmique »**,
  d'après *Bdellovibrio bacteriovorus*, qui fait réellement ça : il pénètre
  dans le périplasme d'une proie Gram négative, la digère de l'intérieur et
  ressort. Même effet de jeu, nom exact, et c'est une bestiole qui mérite
  d'être connue.

Si tu préfères le mot « Phagocytose » pour sa lisibilité auprès des joueurs,
il suffit de changer `label` dans `src/data/evolutions.js` — la mécanique ne
bouge pas. Mais mon vote va à Bdellovibrio.

## Note : l'optique dans un arbre de mutations

Les quatre évolutions marquées *(optique)* ne sont pas des mutations : elles
règlent le **microscope**, pas la bactérie. Assumé et limité à 4 entrées, en
brisant volontairement le quatrième mur — c'est l'observateur qui s'ajuste.
Si ça te gêne, elles sortent sans casser l'équilibrage (elles ne portent
aucune synergie de voie).

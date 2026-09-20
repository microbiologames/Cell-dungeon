# Vagues et équilibrage

## Le problème posé

> « Il faut que ce soit très équilibré entre les progressions du joueur et des
> mobs pour que l'**intensité** augmente sans pour autant augmenter la
> **difficulté réelle**, jusqu'à ce que ce soit trop intense et qu'on perde. »

Intensité et difficulté sont deux grandeurs distinctes, et c'est la clé :

- **Intensité** = combien il se passe de choses par seconde. Nombre d'ennemis
  à l'écran, de projectiles, de kills/s, d'effets. C'est ce qui *excite*.
- **Difficulté** = probabilité de mourir dans les 10 prochaines secondes.
  C'est ce qui *frustre*.

On veut : intensité **×5** sur le run, difficulté **plate** puis verticale à la fin.

## Les deux invariants

### Invariant 1 — TTK maîtrisé

Le temps nécessaire pour tuer un mob de référence (`chaff`) doit rester
constant **pour qui choisit bien**. C'est ce qui rend la progression
*ressentie* : le joueur tape toujours aussi fort, alors que les PV ennemis
montent aussi.

```
TTK(t) = PV_ref × H(t) / DPS_joueur(t)
```

| Politique de choix | Fenêtre exigée (p ≤ 0.8) | Mesuré |
|---|---|---|
| Joueur qui optimise | 0.42 – 1.25 s | **0.48 → 0.52 s**, plat |
| Joueur qui pioche au hasard | 0.42 – 1.90 s | 0.82 → 1.25 s, dérive |

L'écart entre les deux lignes **est** la récompense du choix : jouer au
hasard coûte jusqu'à 75 % de temps de tuerie en plus. C'est voulu, et c'est
mesuré plutôt qu'espéré.

### Invariant 2 — Pression : plateau puis décrochage

```
P(t) = menace entrante(t) / capacité d'encaissement(t)
```

où `menace entrante` tient compte de la **mitigation** : la vitesse du joueur
est une défense réelle (on distance la foule) et le contrôle de foule
(coagulase, EPS, aura acide) retire des mobs de l'équation.

La difficulté n'est pas testée sur des valeurs absolues — il suffirait de
déplacer les bornes jusqu'à ce que ça passe. Elle est testée sur la **forme**,
qui est la vraie affirmation de design :

| Invariant | Exigence | Mesuré (optimisateur) |
|---|---|---|
| **Plateau** : pression sur la 1ʳᵉ moitié | ne double pas (× ≤ 1.9) | **× 1.79** |
| **Décrochage** : pression sur la 2ᵈᵉ moitié | au moins double (× ≥ 2.0) | **× 3.62** |
| **Foule** : population sur le run | au moins × 3 | **× 4.40** |
| Garde-fous absolus | 0.25 ≤ P ≤ 3.2 | 0.39 … 2.58 |

Courbe obtenue, pour un joueur qui optimise :

```
0:00 ----------- 5:00 ----------- 9:00 ----------- 12:00
P =  0.40  →  0.60   |   0.60 → 1.33   |   1.33 → 2.58
     plateau         |   ça se tend    |   le sol se dérobe
foule : 9.6 mobs     |   12.5          |   24  →  42
```

Pendant que la foule **quadruple**, la difficulté ne bouge presque pas
sur la première moitié. C'est exactement la commande : l'intensité monte,
la difficulté attend.

Le décrochage final n'est pas un pic de PV : c'est une **saturation du champ**.
On meurt parce qu'il n'y a plus de place pour se déplacer, pas parce que les
mobs frappent plus fort. C'est la mort honnête.

## Les formules

Avec `p = t / T` et `T = 720 s` :

```
Population de menace  B(p) = 13 × (1 + 3.4 p^2.8)    crédits présents  →  13 … 57
PV des mobs           H(p) = 1 + 1.9 p^1.20                            →  1 … 2.9
Dégâts des mobs       D(p) = 1 + 0.9 p
Vitesse des mobs      V(p) = 1 + 0.35 p
Expérience            X(n) = 6 + 5n + 0.32 n²        → niveau 26 en fin de run
Palier de rôles       tier(p) = floor(p × 5)
```

> **`B` est une population, pas un débit.** Le directeur maintient ce nombre
> de crédits *présents simultanément* et remplace les morts. Une première
> version traitait `B` comme un nombre d'apparitions par seconde : la
> population divergeait et le joueur était submergé dès la deuxième minute.
> Le simulateur l'a montré tout de suite.

### Pourquoi l'exposant 2.8

C'est la constante la plus sensible du jeu. Avec un exposant proche de 1, la
foule grossit régulièrement du début à la fin — et la pression monte
régulièrement avec elle, donc la difficulté croît tout du long. On perd le
plateau. Avec 2.8, la foule reste sage pendant les huit premières minutes
puis **double sur les quatre dernières** : plateau, puis falaise.

| Exposant | Plateau mesuré | Verdict |
|---|---|---|
| 1.35 | × 3.6 | difficulté croissante du début à la fin |
| 2.2 | × 2.07 | presque |
| **2.8** | **× 1.79** | ✅ |

### Pourquoi `H` monte moins vite que `B`

`H(p)` (× 2.9) suit la courbe de DPS du joueur, ce qui tient l'invariant 1.
`B(p)` (× 4.4) monte **plus vite**, donc c'est la **densité** qui porte la
montée d'intensité. Les mobs ne deviennent jamais des murs : ils deviennent
une foule.

### Calendrier d'une matrice (720 s)

| Temps | Événement |
|---|---|
| 0:00 | Ouverture, chaff seul, budget bas |
| 0:30 | Première vague nommée, `runner` débloqué |
| 2:00 | `ranged` débloqué (phages) — leçon de mise au point |
| 3:00 | `tank` débloqué |
| **4:00** | **Mini-boss** — budget coupé à 25 % pendant le combat, plasmide garanti |
| 5:00 | `splitter` et `denier` débloqués |
| 6:00 | **Accalmie 20 s** : budget à 10 %, l'ADN au sol reste. Respiration. |
| **8:00** | **Mini-boss 2** |
| 9:00 | `predator` débloqué (matrices 2+) |
| 10:00 | Pression 1.0, le champ se sature |
| 11:30 | **Accalmie 15 s** avant le boss |
| **12:00** | **Boss** |

Les deux accalmies ne sont pas de la générosité : sans elles, la montée est
une rampe plate et le joueur s'habitue. Avec elles, le retour de la horde est
ressenti comme une accélération. **Le contraste porte l'intensité, pas le niveau absolu.**

### Composition des vagues

Une vague n'est pas une liste, c'est un **profil d'achat**. À chaque palier,
le directeur reçoit des poids par rôle :

| Palier | chaff | runner | ranged | tank | splitter | denier | predator |
|---|---|---|---|---|---|---|---|
| 0 | 100 | — | — | — | — | — | — |
| 1 | 70 | 30 | 8 | — | — | — | — |
| 2 | 55 | 30 | 12 | 15 | — | — | — |
| 3 | 40 | 28 | 12 | 18 | 14 | 10 | — |
| 4 | 30 | 25 | 10 | 20 | 16 | 14 | 8 |

Contrainte anti-frustration : **jamais plus de 2 `ranged` simultanés**, et
**jamais plus de 3 `denier`** (sinon l'arène devient injouable, pas difficile).

### Spawn et mise au point

Un mob n'apparaît pas au bord de l'écran : il apparaît **hors plan focal**,
à `z = ±(0.55 … 1.0)`, dans le champ ou juste à son bord, puis **dérive vers
`z = 0`** en 3 à 6 s. Le joueur qui utilise sa molette voit donc littéralement
la vague se former avant qu'elle n'existe. C'est le rendu du télégraphe :
pas d'indicateur de HUD, juste de l'optique.

## Vérification

`tools/balance-sim.mjs` simule 400 runs pour deux politiques de choix
(joueur qui optimise, joueur qui pioche au hasard), calcule le TTK et la
pression toutes les 30 s, et vérifie les invariants de forme.

```
npm run balance      # ou : node tools/balance-sim.mjs
```

Le script sort en code 1 dès qu'un invariant est rompu, en nommant lequel.
Il partage ses constantes avec `src/data/matrices.js` et `src/game/stats.js` :
il n'y a **pas** de second jeu de nombres à tenir à jour, donc le test ne peut
pas diverger du jeu.

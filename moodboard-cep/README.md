# Moodboard — Extension Adobe Illustrator (CEP)

**Moodboard** est une table de travail spatiale pour designers, intégrée à Adobe Illustrator sous forme de panneau CEP. Il permet de composer des moodboards de marque, rassembler des références, construire des palettes, comparer des typographies et annoter des pistes créatives — le tout dans un canvas infini avec caméra libre.

**Modèle mental :** `GRAB → DRAG → DROP → ORGANIZE → ZOOM → PAN`
on attrape une ressource, on la dépose sur le canvas, on organise l'espace, on zoome sur le détail et on se déplace librement.

---

## 🖥️ Application autonome (v1.1.0+)

Depuis la **v1.1.0**, le même moteur existe en **application de bureau
installable** (Electron) pour Windows 10/11 et macOS 11+, sans Illustrator —
voir `../moodboard-desktop/`. Le dossier de données est partagé
(`<USER_DATA>/Moodboard`) : l'autosave et les projets passent de l'extension
à l'application et réciproquement. Si le panneau CEP reste inutilisable sur
votre machine, l'application autonome est la voie garantie (mêmes
fonctions canvas ; l'intégration Illustrator reste réservée au panneau).

## ⚠️ Choix technologique : CEP (et non UXP)

Ce projet utilise **CEP uniquement**, par décision explicite de l'utilisateur (une migration UXP est envisagée plus tard, à sa seule décision — voir *Roadmap*).

Point d'honnêteté : **Adobe recommande UXP pour tout nouveau développement d'extension**. CEP n'en reste pas moins supporté par Illustrator et fonctionne de façon pleinement satisfaisante pour ce cas d'usage. Ce projet a été construit et testé pour :

- **Illustrator 2021+** (hôte `ILST [25.0, 99.9]` déclaré dans le manifeste) ;
- **CEP 10 / 11** (runtime CSXS 10 requis) — Chromium 88+ intégré, donc **ES2020** ;
- Aucune API UXP, aucune API legacy CEP 8/9 : uniquement la **CSInterface officielle** (`client/js/lib/CSInterface.js`).

---

## Fonctionnalités

### Canvas spatial
- Canvas infini avec **caméra découplée** : zoom focalisé sur le curseur (molette), zoom 100 % / ajuster à l'écran / zoom sur la sélection, pan (Espace + glisser, bouton milieu, outil Main `H`).

### Objets — 16 types éditables + groupes
Texte, note, commentaire, image, couleur, palette, typographie, lien, fichier, **ligne attachable** (avec flèches, raccordable aux autres éléments), forme, **colonne conteneur** (mini-canvas vertical), tableau, checklist, croquis (tracé à main levée), **carte assignées** (cartes existantes ; l'outil de création a été remplacé par l'outil Preview en v1.14) — plus le **groupe** (`⌘/Ctrl + G`) comme conteneur logique.

### Sélection et transformation
- Sélection multiple, **marquee** (lasso sur zone vide), `Maj + clic` pour ajouter/retirer.
- Resize par poignées avec **ratio préservé**, redimensionnement ancré (le côté opposé reste fixe).
- **Rotation** par poignée, `Maj` = pas de 15°.
- **Aimantage intelligent** (bords et centres) avec guides visuels ; `⌘/Ctrl` pendant le drag pour le désactiver temporairement.
- Verrouillage et masquage d'éléments, réorganisation z (avant/arrière).

### Édition et flux de travail
- **Historique Undo/Redo transactionnel** (80 entrées, 1 entrée par geste).
- **OUTIL PREVIEW (v1.14)** (`U`) : configurer les **couleurs par rôles** (principale, secondaire, accent + autant de couleurs supplémentaires que voulu, ou une palette entière de la bibliothèque) puis **prévisualiser un vrai site web** (template Clearwave embarqué) recoloré **en direct** — responsive Bureau / Tablette / Mobile, retour au canvas d'Échap, rien n'est ajouté au moodboard.
- Presse-papiers (copier / couper / coller), `⌘/Ctrl + D` pour dupliquer.
- `Alt + glisser` = **duplication rapide** ; sur une section/colonne, `Alt + glisser` déplace **le conteneur seul** (sans son contenu).
- **Alignement / distribution** de la sélection ; **disposition automatique** d'un lot d'images : grille, masonry ou collage.
- **Bibliothèque latérale ÉDITABLE** (v1.13) : Médias, Couleurs, Palettes et Typo acceptent des **ajouts** et des **retraits** — même les assets de démo (masqués, restaurables d'un clic) ; tout est persistant (`library.json`) et les couleurs, palettes et typos du canvas y retournent par clic droit. Drag-out vers le canvas depuis chaque entrée.
- **Import par drop multi-fichiers** : déposez plusieurs images d'un coup, elles arrivent en cascade depuis le curseur.
- Double-clic : édition (texte, note, cellule de tableau, image → recadrage).

### Persistance et export
- **Autosave 800 ms** après la dernière modification (jamais pendant un geste), + Enregistrer / Enregistrer sous / Ouvrir.
- Format projet **`.moodboard`** (JSON versionné, voir plus bas).
- **Export SVG** (vectoriel, ouvrable directement dans Illustrator) et **export PNG** (rastérisation 2×).

### Intégration Illustrator (via ExtendScript)
- **Importer les nuances** du document Illustrator → élément Palette sur le canvas.
- **Envoyer des couleurs** (éléments couleur/palette sélectionnés) → nouvelles nuances dans le document AI.
- **Placer une image** du moodboard dans le document Illustrator (fichier temporaire + `placedItem`).
- Informations du document (nom, mode colorimétrique, calques, nuances).

### Raccourcis principaux

| Raccourci | Action |
|---|---|
| `V` / `H` | Outil Sélection / outil Main |
| `T` `N` `M` `I` `K` `A` `Y` `L` | Texte, Note, Commentaire, Image, Couleur, Palette, Typographie, Lien |
| `S` `C` `P` `R` `B` | Section, Checklist, Ligne, Forme, Croquis |
| Espace + glisser / molette | Pan / zoom focalisé sur le curseur |
| `Maj + clic` / marquee | Étendre la sélection / lasso |
| `Alt + glisser` | Dupliquer (section : déplacer le conteneur seul) |
| `Suppr` / `Retour arr.` | Supprimer la sélection |
| `Échap` | Quitter l'édition → annuler le geste → désélectionner |
| `⌘/Ctrl + Z` / `⌘/Ctrl + ⇧ + Z` | Annuler / rétablir |
| `⌘/Ctrl + C / X / V / D` | Copier / couper / coller / dupliquer |
| `⌘/Ctrl + A` / `⌘/Ctrl + G` | Tout sélectionner / grouper (`⇧` pour dissocier) |
| `⌘/Ctrl + S` / `⌘/Ctrl + O` | Enregistrer / ouvrir |
| `⌘/Ctrl + 0` / `⇧ + 1` / `⇧ + 2` | Zoom 100 % / ajuster à l'écran / zoom sur la sélection |
| `+` / `-` | Zoom avant / arrière |
| `?` | Aide-mémoire complet des raccourcis (dialogue intégré) |
| `⌘/Ctrl` pendant un drag | Désactiver l'aimantage |

---

## Architecture

### Arborescence

```
moodboard-cep/
├── CSXS/
│   └── manifest.xml            # Manifeste CEP : hôte ILST [25.0,99.9], CSXS 10, Panel
├── .debug                      # Port de débogage CEF pour Illustrator (8098)
├── client/
│   ├── index.html              # Point d'entrée du panneau
│   ├── css/
│   │   └── panel.css           # Styles du panneau (thème sombre)
│   ├── js/
│   │   ├── main.js             # Bootstrap, raccourcis clavier, actions globales
│   │   ├── lib/
│   │   │   └── CSInterface.js  # API officielle Adobe CEP
│   │   ├── core/
│   │   │   ├── store.js        # Store à événements + mutations transactionnelles
│   │   │   ├── history.js      # Undo/Redo (80 entrées, 1 par geste)
│   │   │   ├── camera.js       # Caméra (zoom, pan, fit)
│   │   │   ├── factory.js      # Création des types d'éléments
│   │   │   ├── diaglog.js      # Journal de diagnostic persistant (erreurs, événements, gestes)
│   │   │   ├── storage.js      # Persistance .moodboard, autosave, dialogues fichiers
│   │   │   ├── utils.js        # Géométrie, clone, échappement…
│   │   │   ├── icons.js        # Icônes SVG inline (aucune ressource réseau)
│   │   │   └── demo.js         # Tableau de démonstration « Café Aurora »
│   │   ├── board/
│   │   │   ├── board.js        # Rendu du canvas, réconciliation des vues
│   │   │   ├── elementView.js  # Vue DOM d'un élément (réutilisée par id)
│   │   │   ├── content.js      # Rendu du contenu par type d'élément
│   │   │   ├── interactions.js # Gestes : drag, resize, rotation, snap, marquee…
│   │   │   └── export.js       # Export SVG et PNG (rastérisation 2×)
│   │   ├── ui/
│   │   │   ├── topbar.js       # Barre supérieure (projet, actions Illustrator)
│   │   │   ├── toolbar.js      # Barre d'outils latérale
│   │   │   ├── library.js      # Bibliothèque Médias (session) avec drag-out
│   │   │   ├── inspector.js    # Inspecteur (propriétés de la sélection)
│   │   │   ├── contextbar.js  # Barre contextuelle (alignement, disposition…)
│   │   │   ├── contextmenu.js # Menu contextuel clic droit
│   │   │   ├── overlays.js    # Dialogues, toasts, aide-mémoire raccourcis
│   │   │   └── controls.js    # Contrôles réutilisables
│   │   └── adobe/
│   │       ├── cep.js          # Pont CSInterface → Illustrator (protégé hors AI)
│   │       └── host.script.jsx # ExtendScript : nuances, placement d'images, doc
│   └── assets/
│       └── demo/               # 5 images PNG de la démo « Café Aurora »
├── scripts/
│   ├── validate.mjs            # Validation statique (npm run check)
│   └── package.mjs             # Construction du zip (npm run package)
├── dist/                       # Archive générée : moodboard-cep-1.0.1.zip
├── package.json                # Scripts npm, aucune dépendance
└── README.md
```

### Couches

| Couche | Modules | Rôle |
|---|---|---|
| **UI** | `ui/*` | Panneaux, barres, dialogues, feedback (toasts) |
| **Canvas Engine** | `board/*`, `core/camera` | Rendu, vues, gestes, caméra, export |
| **State** | `core/store`, `core/history`, `core/factory` | Source de vérité à événements, undo/redo, création |
| **Persistence** | `core/storage` | Autosave 800 ms, `.moodboard` v1, ouverture/enregistrement |
| **Adobe Integration** | `adobe/cep.js`, `adobe/host.script.jsx`, `lib/CSInterface.js` | Pont vers Illustrator |

### Décisions techniques

- **Vanilla ES2020, sans bundler** : les fichiers sont chargés directement par le Chromium embarqué (CEF). Zéro dépendance npm au runtime, chargement **100 % hors-ligne** (la validation vérifie l'absence de référence CDN).
- **Store à événements** (`MB.store`) : mutations transactionnelles (`mutate(label, fn)`) qui alimentent l'historique — 1 entrée par geste utilisateur.
- **Vues DOM avec réconciliation** : chaque élément possède une vue DOM réutilisée entre les rendus, plutôt qu'un re-render complet du canvas.
- **Overlay de sélection en espace écran** : la sélection, les poignées et les guides sont dessinés dans un calque au-dessus du canvas, en coordonnées écran — l'épaisseur des traits reste constante quel que soit le zoom.
- **Protocole JSX à chaînes délimitées** : ExtendScript n'a pas de JSON natif ; les échanges passent par des chaînes `nom|valeur;…` avec préfixe `ERR|` en cas d'échec.
- **Hors Illustrator, le client reste fonctionnel** (aperçu navigateur) : `storage.js` bascule sur `localStorage` et `cep.js` désactive proprement les actions Illustrator.

---

## Installation

### 1. Construire l'archive

```bash
npm run package
# → dist/moodboard-cep-1.3.0.zip
```

(L'archive contient `CSXS/`, `.debug`, `client/`, `README.md`, `package.json`.)

### 2. Déployer dans le dossier des extensions

Dézipper l'archive **à la racine** du dossier extensions, de sorte que `CSXS/` soit visible :

- **macOS** : `~/Library/Application Support/Adobe/CEP/extensions/moodboard-cep/`
- **Windows** : `%APPDATA%\Adobe\CEP\extensions\moodboard-cep\`

> **Mise à jour d'une installation existante** — Illustrator peut conserver une version
> en cache de l'ancien panneau. Procédure sûre :
> 1. **Quitter complètement Illustrator** ;
> 2. supprimer l'ancien dossier `…/extensions/moodboard-cep/` ;
> 3. (optionnel, macOS) purger le cache CEP : `rm -rf ~/Library/Caches/Adobe/CEP/*` ;
>    (Windows : `%LOCALAPPDATA%\Adobe\CEP\Cache`) ;
> 4. dézipper la nouvelle archive ;
> 5. relancer Illustrator.
>
> **Vérifiez la version installée** : le badge en bas à droite de la barre d'état
> du panneau doit afficher **v1.14.1**. S'il affiche autre chose, l'ancienne
> installation est encore active.

### 3. Activer le PlayerDebugMode

L'extension n'étant pas signée (voir note ci-dessous), il faut autoriser le chargement des extensions non signées :

**macOS** (Terminal) — fonctionne aussi sur Apple Silicon :

```bash
# Illustrator 2023+ (CEP 11)
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
# Illustrator 2021–2022 (CEP 10) : remplacer CSXS.11 par CSXS.10
```

**Windows** (regedit ou Invite de commandes) :

```
HKEY_CURRENT_USER\Software\Adobe\CSXS.11\PlayerDebugMode = "1"  (valeur STRING)
```

```bat
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f
```

(Adaptez `CSXS.11` en `CSXS.10` pour CEP 10.)

### 4. Lancer

Relancez Illustrator, puis **Fenêtres ▸ Extensions ▸ Moodboard**.

> **Note — distribution** : aucun `.zxp` signé n'est produit (l'outil `ZXPSignCmd` d'Adobe n'est pas disponible ici). Le zip est destiné à une **distribution interne / débogage**. Pour une diffusion externe via Adobe Add-ons ou ZXPInstaller, il faudrait signer le package.

---

## Développement / débogage

```bash
npm install     # aucune dépendance à installer — crée seulement le lockfile
npm run check   # validation statique
```

`npm run check` (alias `npm run validate`) vérifie :
1. `CSXS/manifest.xml` bien formé, champs requis, cohérence `MainPath`/`ScriptPath` ;
2. la syntaxe de **chaque fichier JS** (`node --check`) ;
3. la présence des ressources référencées par `index.html` ;
4. l'absence de **références réseau externes** (CDN interdits : CEP doit fonctionner hors-ligne).

### Débogage du panneau (DevTools Chrome)

Le port **8098** est déclaré dans `.debug`. Avec le panneau ouvert dans Illustrator, ouvrez dans Chrome :

```
http://localhost:8098
```

Vous accédez alors aux DevTools du panneau (console, DOM, réseau). Hors Illustrator, le client tourne aussi directement dans un navigateur (mode dégradé : `localStorage` au lieu de `cep.fs`, actions Illustrator désactivées).

#### Diagnostic intégré (v1.0.2+)

Si un jour les **drags ne répondent plus alors que le zoom molette fonctionne** :

- **Sans DevTools** : menu **Aide ▸ Diagnostics…** du panneau — rapport complet
  (version, hôte Illustrator, moteur Chromium, familles d'événements livrées,
  erreurs JS, journal des gestes) avec un bouton **Copier le rapport** ;
- **Fichier** : tout est aussi journalisé en continu dans
  `<dossier de données>/diagnostic.log`
  (macOS : `~/Library/Application Support/Moodboard/diagnostic.log` —
  Windows : `%APPDATA%\Moodboard\diagnostic.log`) ;
- **Console DevTools** : `MB.interact.diag()` (état brut) et `MB.diaglog.report()`.

#### Diagnostic des événements (v1.0.1)

`MB.interact.diag()` retourne le nombre d'événements **réellement livrés** par le moteur de chaque famille (`pointerdown`, `mousedown`, `pointermove`, `mousemove`, `blur`, `pointercancel`…) ainsi que l'état de la machine à gestes (`gesture`, `spaceDown`, `tool`). Depuis la v1.0.1, la couche d'interaction est **adaptive** : elle branche à la fois les Pointer Events et les événements souris, et bascule automatiquement sur la souris si le moteur CEP hôte ne livre pas les Pointer Events (cas observé selon les versions d'Illustrator).

Depuis la **v1.0.2**, les gestes **survivent** aux événements `blur` / `pointercancel` parasites que certains hôtes CEP émettent au milieu d'un drag (symptôme typique : « le zoom marche mais rien ne se déplace ») : le geste continue s'il reçoit encore des événements, et n'est annulé proprement (avec rollback) que si plus rien n'arrive pendant 600 ms.

#### Nouveautés v1.14.1 — six correctifs d'usage

1. **Typo : toutes les polices de l'ordinateur.** L'onglet Typo de la
   bibliothèque liste désormais **chaque famille installée** — celles
   d'Illustrateur dans le panneau CEP, celles du système dans l'application
   de bureau (les retirer est réversible : ré-ajouter le nom les ramène).
   La source est indiquée discrètement sous le bouton d'ajout.
2. **Panneau de couleurs du Preview redessiné** : titre, texte, rangées et
   boutons respirent (marges cohérentes de 18 px — plus rien de collé au
   conteneur).
3. **Palettes de la bibliothèque en ronds qui se chevauchent** : le sélecteur
   « Depuis la bibliothèque… » montre chaque palette par ses **couleurs**
   (ronds de 28 px, recouvrement de 10 px — le design de l'outil Palette),
   plus de noms à l'écran.
4. **Fenêtre Preview pleinement interactive** (application de bureau) : la
   fenêtre couvrait la zone de déplacement native — les pastilles, le « + »
   et les boutons responsive ne répondaient pas au clic. Toutes les
   couches déclarent désormais `no-drag` ; la **bibliothèque reste en plus
   atteignable pendant l'aperçu** (bouton palette dans la barre — la
   palette s'applique au site en direct).
5. **Boutons responsive en icônes** : ordinateur, tablette, téléphone
   (les libellés localisés restent dans les info-bulles).
6. **Barre supérieure épurée** : une fois un moodboard ouvert, le logo et
   le nom « Moodboard » quittent la barre (à côté de Fichier & co) — ils
   reviennent sur l'écran d'accueil de l'application.

Vérifié par **706 assertions E2E** (16 suites : v102→v1141, dont la
nouvelle suite v1141 ×44 couvrant les six demandes) + **114 assertions
de simulation de stockage**, zéro erreur console.

#### Nouveautés v1.14.0 — outil Preview, bibliothèque recentrée

1. **Nouvel outil « Preview »** (raccourci **U**, à la place de l'outil
   Assignées) : tester l'identité colorimétrique du moodboard sur un **vrai
   site web**. Le clic ouvre d'abord la **configuration des couleurs** —
   trois rôles par défaut (**Principale** : structure, titres, marque ;
   **Secondaire** : fonds et surfaces ; **Accent** : boutons, CTA, éléments
   interactifs), et autant de couleurs supplémentaires que nécessaire
   (« + Ajouter une couleur » → Couleur 4, 5, 6…). Chaque ligne offre
   pastille, code **HEX**, sélecteur et suppression ; une **palette de la
   bibliothèque** se charge d'un clic (« Depuis la bibliothèque… »). Le bouton
   **Prévisualiser** rend le template fourni (**TemplateMo 622 Clearwave**,
   embarqué) comme un vrai site — **recoloré en direct** par variables CSS
   (`--preview-primary/secondary/accent/…`) : modifier une pastille pendant
   l'aperçu recolore le site **instantanément**, sans rechargement. L'aperçu
   est **responsive** (Bureau / Tablette 768 / Mobile 390), le **contraste**
   du texte sur les couleurs est calculé (WCAG), et **Échap** ramène au canvas
   — aucun élément du moodboard n'est touché. La dernière configuration est
   conservée (prefs).
2. **Bibliothèque recentrée** : l'onglet **Formes** est retiré (les formes se
   créent avec l'outil Forme de la barre d'outils — rectangle, cercle,
   triangle) ; les quatre onglets restants (Médias, Couleurs, Palettes, Typo)
   sont inchangés.
3. **Outil Assignées retiré du rail** : remplacé par Preview. Les cartes
   déjà posées sur les planches existantes **continuent de se rendre** et
   de s'exporter (aucune perte de données).

Le moteur de Preview est **extensible par rôles** (primary, secondary,
accent, extra-4/5/6… — les rôles personnalisés restent possibles) : un
futur template n'aura qu'à consommer d'autres variables.

Vérifié par **662 assertions E2E** (15 suites : v102→v1140, dont la
nouvelle suite v1140 ×84 couvrant les 18 tests demandés) + **114 assertions
de simulation de stockage**, zéro erreur console.

#### Nouveautés v1.13.0 — bibliothèque éditable, note réparée, chargement liquide, cercles parfaits

1. **Bibliothèque entièrement éditable** : les quatre onglets — **Médias**,
   **Couleurs**, **Palettes** et **Typo** — acceptent désormais des **ajouts**
   (bouton « + », sélecteur de couleur / créateur de palette avec pastilles /
   saisie de famille avec suggestions des polices du système) et des
   **retraits** (bouton ✕ au survol de chaque entrée). **Même les assets de
   démo se suppriment** — ils sont masqués, pas détruits, et « Restaurer les
   images de démo » les ramène. Couleurs, palettes et typographies posées
   sur le canvas rejoignent la bibliothèque par **clic droit ▸ Ajouter à la
   bibliothèque**. Tout vit dans `library.json` v2 (rétrocompatible avec la
   v1 : aucune image n'est perdue à la migration).
2. **Bug Note corrigé** : redimensionner une carte **pendant l'édition** ne
   fait plus disparaître le texte écrit — l'édition ouverte est **toujours
   committée avant tout geste** (poignée, pivot, extrémité, recadrage), et un
   re-rendu pendant l'édition **préserve la frappe vivante** au lieu de
   réinjecter le modèle (double filet de sécurité).
3. **Barre de chargement repensée** : la progression des mises à jour adopte
   le design « liquid loader » (uiverse.io/ShaikhWahid99) — piste sombre
   creusée, remplissage en **dégradé animé** (hue-rotate), libellé lumineux
   aux **points clignotants** ; la largeur suit la progression réelle du
   téléchargement.
4. **Cercles parfaits** : l'outil Forme en mode cercle naît **carré** (160×160
   — l'ancien 170×130 produisait une ovale écrasée) ; le tracé à main levée
   **montre un carré** pendant le geste et pose un cercle ; le
   redimensionnement **garde le ratio 1:1** (`Maj` le libère pour une ovale
   libre) ; les anciennes ovales redeviennent rondes dès qu'on les retaille.

Vérifié par **580 assertions E2E** (14 suites : v102→v1130, dont la nouvelle
suite v1130 ×40) + **114 assertions de simulation de stockage**, zéro erreur
console.

#### Nouveautés v1.12.0 — palette « picker », section retirée, colonnes réparées, garde de fermeture

1. **Outil Palette — nouveau design « picker » (Bencho)** : la carte
   adopte le langage du composant Assignees — une **pastille** qui se
   remplit de **ronds de couleur empilés** et ouvre une **liste
   cochable** (rond + nom + code hex + coche). La pastille referme et
   rouvre la liste ; décocher une rangée retire le rond de la
   pastille (la palette garde toutes ses couleurs) ; **cliquer le code
   hex le copie** (le geste historique). Boîte 264 px de large,
   hauteur réservée pour la liste ouverte.
2. **Panneau Projet — codes couleurs** : les rangées de la palette
   montrent les **codes hex** (plus les noms) et le champ **modifie la
   couleur** ; le nom de la palette vit désormais dans le panneau
   (champ dédié).
3. **Outil Section retiré** : plus de bouton, plus de création, plus
   d'icône — la **colonne** reste le seul conteneur à pile verticale.
   Les **anciens projets sont migrés** au chargement (sections →
   colonnes, titre et couleurs conservés, rien n'est perdu).
4. **Colonnes — empilement réparé** : la hauteur d'une colonne ne
   **rétrécit** plus à la taille exacte de son contenu (le bug : une
   colonne de 380 px s'effondrait à 220 en recevant une note, et le
   dépôt suivant visait « là où la colonne n'était plus ») ; un dépôt
   **à cheval** sur le bord bas rejoint la pile ; les cartes prennent
   **la largeur de la colonne** dès qu'elles y entrent ; et elles
   **suivent en direct** le redimensionnement de la colonne.
5. **Fermeture de l'application** : quitter avec du travail non
   enregistré propose **« Enregistrer » / « Annuler »** — Enregistrer
   écrit le projet (chemin connu = écriture directe, sinon choix de
   l'emplacement) puis ferme ; un dialogue annulé laisse l'application
   ouverte. *(Application autonome.)*

*Vérifications : 540 assertions E2E (v102→v1120) + 114 simulation, VLM
conforme, zéro erreur console.*

#### Nouveautés v1.11.0 — images système, bibliothèque persistante, Assignees

1. **Croquis & ligne — tracé temps réel fidélisé** : l'épaisseur du
   trait temporaire suit **exactement le zoom** (autant de pixels écran
   que l'élément créé) et la **flèche de fin** de la ligne se dessine
   pendant le geste.
2. **Images ouvertes au reste du système** : clic droit sur une image →
   **Copier l'image** (bitmap PNG dans le presse-papiers — collable
   dans Photoshop, Discord, Mail…), **Enregistrer l'image…** (dialogue
   natif dans l'extension et l'application, téléchargement dans le
   navigateur), **Ajouter à la bibliothèque**. Sur le canvas :
   **Coller une image** depuis le presse-papiers du système — et le
   collage (⌘V / Ctrl+V) d'une image copiée ailleurs atterrit
   directement sur la planche.
3. **Bibliothèque Médias persistante** : les images ajoutées
   (importées, déposées, ou depuis le canvas) **survivent aux projets
   et aux sessions** — fichier `library.json` du dossier de données,
   partagé par l'application et l'extension. Chaque vignette porte son
   **bouton de suppression** au survol ; les images de démonstration
   (non supprimables) sont marquées « démo ».
4. **Barre de mise en forme des en-têtes** : le **titre des colonnes
   et des sections** s'édite avec la barre flottante — gras, italique,
   souligné, surlignage, **couleur du texte** (nouveau bouton « A »
   dans la barre, disponible aussi pour les notes) et police de la
   sélection. La mise en forme vit dans le document (sanitisée) et
   l'export reste correct.
5. **Outil Palette redessiné** : carte **portrait en bandes
   verticales** pleine surface — une bande par couleur (le survol
   l'élargit), **code hex en pied de bande** dans l'encre lisible,
   bandeau de nom au-dessus. La hauteur ne dépend plus du nombre de
   couleurs ; l'export SVG suit le nouveau design.
6. **Composant Assignees** (porté de [Bencho](https://bencho.dev),
   MIT) : nouvelle carte **« Assignées »** (outil U) — une **pastille
   qui se remplit de visages** à mesure qu'on assigne les personnes,
   et la liste qui les choisit. Les commentaires d'origine du
   composant sont conservés dans `client/js/ui/assignees.js`.

#### Nouveautés v1.10.0 — cartes de lien relookées, mini-canvas, cadenas

1. **Cartes de lien relookées** (design fourni par l'utilisateur) :
   carte **portrait** — **hero blanc** portant le **LOGO du site**
   (favicon haute résolution) et le nom du service, zone d'infos sombre
   (couleur de carte modifiable) avec **favicon + URL** gris, **titre
   orange souligné** et **description** gris clair. **Le site n'est
   jamais chargé ni capturé** : le logo vient du favicon, le
   titre/description des métadonnées HTML en lecture légère (best
   effort, toujours éditables sur place). Titre et description de la
   carte sont **éditables au double-clic**.
2. **Préférences épurées** : le texte d'explication du dossier de
   caches (« Ce choix s'applique à tous vos moodboards… ») est retiré.
3. **Indicateur clavier** : à côté de la version, une **icône de
   clavier** — **verte** quand les raccourcis sont actifs, **rouge**
   quand ils ne le sont pas (plus de texte « raccourcis actifs »).
4. **Typographie** : le **sélecteur de police s'ouvre directement sur
   la carte** à la création (plus besoin de passer par le panneau
   Projet) ; la barre contextuelle le propose aussi à chaque sélection.
5. **Carte Importer épurée** : juste l'icône d'import de média et
   « **Cliquez pour importer un fichier** » au milieu — la zone
   centrale est un bouton (les bords déplacent la carte, le
   double-clic et le glisser-déposer de fichiers restent actifs).
6. **Couleur des checklists** : fond de carte modifiable (inspecteur,
   barre contextuelle) avec encre adaptée.
7. **Colonnes & sections en deux zones** : **couleur d'en-tête** et
   **couleur de corps** séparées + titre **mis en forme** (police,
   taille, **gras**, **italique**, couleur).
8. **Mini-canvas verticaux** : les cartes **glissées dans une colonne
   ou une section s'empilent verticalement** (alignées, sans
   chevauchement) ; déposer une carte au milieu de la pile l'y insère,
   la suppression re-compacte, le conteneur grandit si besoin.
9. **Cadenas cliquable** : cliquer un élément **verrouillé** fait
   apparaître un **cadenas dans son coin supérieur** — cliquer ce
   cadenas le **déverrouille**.
10. **Miniatures de l'accueil nettes** : chaque projet récent montre
    **un seul élément représentatif** (image, note, lien…) rendu plein
    cadre en 640×400 — net, là où le tableau entier réduit paraissait
    flou.
11. **Croquis & ligne en direct** : le tracé temporaire est **fidèle**
    (couleur, épaisseurs et arrondis réels, trait plein) — on voit
    exactement ce qu'on dessine pendant le geste.
12. **Outil Image repensé** : posé sur le canvas, il crée une **carte
    d'attente** (icône d'import d'image + « Cliquez pour choisir une
    image ») ; le clic ouvre le sélecteur et l'image choisie **remplit
    la carte** (dimensions adaptées).

#### Nouveautés v1.9.0 — langue, liens, formes, barre riche réparée

1. **Langue de l'interface** (Préférences ▸ Langue) : « Langue du
   système » par défaut — l'application ET l'extension suivent la langue
   du système d'exploitation — ou forçage **Français / English**.
   Menus, outils, panneaux, dialogues et écran d'accueil traduits ;
   la préférence vit dans `prefs.json` (partagée).
2. **Barre de mise en forme réparée** : un appui sur ses boutons ne
   quittait plus l'édition en cours (le clic remontait au canvas et
   validait l'élément avant l'action) — la sélection survit et le
   formatage s'applique vraiment.
3. **Cartes de lien repensées** : **couleur de carte** modifiable
   (inspecteur, avec encre adaptée), **aperçu STATIQUE** du site —
   capture d'écran par l'application (WebContentsView hors écran,
   jamais animé), `og:image` dans l'extension, favicon en repli — et
   **flèche d'ouverture moderne** (diagonale fine).
4. **Miniatures de l'écran d'accueil** retravaillées : cadrage
   resserré (le contenu remplit la carte), fond papier chaud, JPEG 0.85,
   léger zoom au survol.
5. **Bouton Police** : libellé « Police » (l'ancien rendu affichait la
   source de la fonction : « function () { … } ») ; la police courante
   reste dans l'info-bulle.
6. **Mises à jour sans lien externe** : les dialogues ne montrent plus
   aucun lien vers le dépôt GitHub (boutons retirés, notes de release
   filtrées) — la mise à jour reste automatique.
7. **Outil Forme** : **sélecteur Rectangle / Cercle / Triangle** —
   double-clic ou appui long sur le bouton d'outil, ou sélecteur ouvert
   directement au point de dépôt sur le canvas. Le **triangle** est un
   polygone régulier dont le **nombre de branches** (3, 4, 5, 6, 8, 12
   ou libre 3-24) se règle dans le panneau Projet.
8. **Préférences** : section langue + dossier des fichiers temporaires
   (v1.7/v1.8) dans un dialogue repensé, sans texte parasite.

#### Nouveautés v1.8.0 — notes riches, groupes, import, tableaux, favoris

1. **Notes (et textes) riches** : pendant l'édition, une **barre de mise en
   forme** apparaît au-dessus de la carte — **gras, italique, souligné,
   barré, surlignage, listes à puces / numérotées et police de la
   sélection**. L'inspecteur convertit aussi toute une note en liste à
   puces (ou retire la mise en forme). Le HTML est sanitisé (liste
   blanche), le collage insère du texte brut, et le formatage survit à
   l'enregistrement (`data.html` + repli texte).
2. **Groupes réparés** : glisser un **groupe** déplace désormais ses
   éléments (correctif de la fermeture de sélection), la suppression et le
   copier-coller emportent le contenu au complet.
3. **Outil Importer repensé** : **double-clic sur l'outil → explorateur /
   Finder** ; glisser l'outil sur le canvas crée une **carte d'import**
   (icône au centre, dépôt de fichiers dessus). Tout s'importe — y compris
   les **moodboards** : un `.moodboard` déposé devient une **planche liée**
   qui reprend son nom et son nombre d'éléments.
4. **Tableaux** : couleurs de **toutes les cellules**, de la **ligne
   d'en-têtes**, d'une **ligne** ou d'une **colonne** précise (ainsi que la
   couleur du texte) + **police et taille** du tableau.
5. **Police partout** : chaque outil qui écrit du texte expose la police —
   notes, textes, commentaires, checklists, tableaux, titres de sections,
   colonnes, planches et liens (bouton police de l'inspecteur).
6. **Favoris de polices** : épinglez vos familles (♥ dans le popover) puis
   filtrez la liste avec le bouton **Favoris** — mémorisé pour tous les
   moodboards.
7. **Dossier des caches global** : le dossier choisi dans les Préférences
   s'applique à **tous vos moodboards**, avec un **autosave par projet**
   (plus jamais écrasé par un autre) ; ouvrir un projet restaure sa version
   non enregistrée si elle est plus récente.
8. **Nom du projet ↔ nom du fichier** : « Enregistrer sous… » prend le nom
   saisi en barre supérieure et le fichier renommé met à jour le projet.
9. **Panneau Projet** : les éléments masqués avec l'œil restent **listés**
   (bouton œil pour réactiver, « Tout révéler »).
10. **Notes stables** : le redimensionnement par le bas ne replie plus la
    carte (hauteur minimum lisible) et la taille choisie n'est plus écrasée
    par la hauteur automatique.

#### Nouveautés v1.6.1 — planches : création sans entrée, retour par le nom, carte compacte

1. **Création sans ouverture** : l'outil **Planche (E)** laisse la nouvelle
   carte dans le moodboard actif — le titre passe en **édition immédiate**
   (nommez-la sur place). Elle ne s'ouvre que par **sa flèche** ; le
   double-clic ne déclenche plus l'entrée.
2. **Retour par le nom** : cliquer le **nom du moodboard parent** dans le fil
   d'Ariane (barre supérieure) ramène à son niveau — nouveau bouton retour ‹
   en tête du fil ; Alt+← reste actif.
3. **Carte compacte** : plus de grand rectangle d'aperçu ni de badge bleu —
   nom **centré** dans sa barre, flèche d'ouverture dans la barre du bas
   (à la place de l'ancien libellé bleu « → planche » ; SVG export aligné).

#### Nouveautés v1.6.0 — planches liées, édition texte, polices du système

1. **Outil Planche (E)** : crée un moodboard lié DANS le moodboard ouvert.
   La carte (miniature du contenu + compteur) s'ouvre par double-clic ou sa
   flèche ; **Alt+←** ou le fil d'Ariane racine ▸ planche permettent de
   revenir. Imbrication récursive ; l'arbre complet est enregistré dans le
   fichier du moodboard racine (une seule sauvegarde embrasse tout) ;
   suppression d'une planche non vide = confirmation.
2. **Édition texte** : ⌘/Ctrl+A/C/X explicites pendant l'édition (fonctionnent
   même quand l'hôte intercepte les raccourcis), hauteur vivante du texte
   multi-paragraphes (la boîte grandit à la frappe — l'ancienne mesure ne
   voyait jamais le contenu), navigation ↑/↓ entre paragraphes.
3. **Polices du système** : le sélecteur liste toutes les polices de
   l'ordinateur (TextFonts d'Illustrator dans le panneau CEP, Local Font
   Access dans l'application, repli web au navigateur) avec recherche
   instantanée et police **par défaut** (★, persistée dans `prefs.json`)
   appliquée aux nouveaux textes/notes.
4. **Liens** : boutons **Coller** (normalisation `https://`) et **Copier**
   dans l'inspecteur ; ⌘A/⌘C/⌘X explicites dans tous les champs d'interface.

#### Nouveautés v1.3.0 — enregistrement, écran d'accueil, liens

1. **Enregistrer / Enregistrer sous… / ⌘-Ctrl+S** : le dialogue natif du
   système (Finder, Explorateur) s'ouvre à CHAQUE enregistrement pour choisir
   l'emplacement du fichier. Le dossier du dernier enregistrement est
   mémorisé (`prefs.json` dans le dossier de données — partagé entre
   l'application et l'extension) : le dialogue s'ouvre directement au bon
   endroit la fois suivante. Le nom proposé est celui du fichier courant.
2. **Écran d'accueil (application de bureau)** : au lancement, la fenêtre
   ouvre sur un écran d'accueil au lieu du canvas — bouton **Nouveau
   moodboard**, **Ouvrir…**, **Charger la démonstration**, carte **Reprendre
   la session** (travail non enregistré) et les **20 fichiers récents**
   (clic = réouverture ; `recent.json`). Un bouton Accueil (icône maison)
   dans la barre supérieure y revient à tout moment. Panneau CEP et aperçu
   web : comportement inchangé (restauration de l'autosave).
3. **Liens du canvas** : un clic sur la carte d'un lien la sélectionne/déplace
   comme n'importe quel élément ; le navigateur ne s'ouvre QUE par la
   **flèche dédiée** (coin supérieur droit de la carte).
4. `Nouveau moodboard` efface aussi l'autosave sur disque (fichier), pas
   seulement le stockage local — l'ancien travail ne ressuscite plus au
   prochain lancement.

#### Corrections v1.2.0 — drag & drop + raccourcis clavier

Deux pannes racine corrigées, diagnostiquées sur les rapports v1.1.x (`ghostStart=9, ghostDrop=4, ghostCancel=0` et `keydown=0, keyup=0`) :

1. **Drag & drop bibliothèque/outils → canvas** : la couche adaptative masquait un `mouseup` dès qu'un `pointermove` était arrivé dans les 50 ms précédentes. Or certains moteurs CEP livrent `pointermove` mais **jamais** `pointerup` — tout relâchement en mouvement (le cas général d'un drag !) était avalé : le ghost ne se posait jamais, et 5 ghosts sur 9 fuyaient en silence (un ghost fantôme peut ensuite déposer son objet au prochain clic innocent). La couverture pointer→souris est désormais **par nature d'événement** (un `mouseup` n'est masqué que par un `pointerup` récent) ; un `buttons=0` reçu pendant le ghost l'annule proprement, un chien de garde anti-fuite le nettoie après 8 s de silence, et un nouvel appui annule tout ghost obsolète.
2. **Raccourcis clavier morts dans Illustrator** : un panneau CEP ne reçoit **aucun** `keydown` tant que le document ne porte pas le focus — et cliquer un élément non focusable (canvas, bibliothèque) ne le lui donne pas. Le document porte désormais `tabindex` (`<body tabindex="0">`), chaque appui dans le panneau rend le focus au document, et la **pastille ⌨ de la barre d'état** affiche l'état réel (cliquer dedans réarme). Cliquer dans Illustrator désactive les raccourcis (comportement attendu), cliquer dans le panneau les réactive.
3. **Rapport de diagnostic enrichi** : compteurs `keydown` / `keyup` / `focusInInput` / `ghostStart` / `ghostDrop` / `ghostCancel` (+ `focus`, `wheel`), ligne **Focus clavier**, ligne **Hôte** corrigée (le moteur CEP renvoie une chaîne JSON qui n'était pas analysée — d'où les « ? ? » dans les rapports v1.1.x), et comptage des événements **une seule fois** (les anciens rapports comptaient `mouseup` ≈ 2 × `mousedown` car chaque module incrémentait de son côté).

---

## Format de projet `.moodboard`

Un projet est un simple fichier JSON versionné :

```json
{
  "version": 1,
  "name": "Café Aurora",
  "savedAt": "2025-09-29T10:00:00.000Z",
  "camera": { "x": 0, "y": 0, "zoom": 1 },
  "elements": [
    {
      "id": "el_8f21…",
      "type": "color",
      "x": 120, "y": 80, "w": 140, "h": 140,
      "rotation": 0,
      "locked": false,
      "hidden": false,
      "parentId": null,
      "data": { "name": "Espresso", "hex": "#3B2A20" }
    }
  ],
  "settings": { "snap": true, "grid": false }
}
```

Le lecteur valide `version === 1` et la présence de `elements[]` (chaque élément devant avoir `id` et `type`). **Le champ `data` est libre par type** : chaque type d'élément y range ses propriétés propres (contenu texte, hex des couleurs, cellules du tableau, points du croquis…), ce qui rend le format extensible sans casser les projets existants — de nouveaux champs peuvent y être ajoutés sans modifier la structure globale.

---

## Limites connues (honnêteté)

- **CEP est figé par Adobe** (plus d'évolution, maintenance minimale). Pour un projet destiné à durer, UXP est la cible recommandée à terme — la migration attend la décision de l'utilisateur.
- **Export PNG** : rastérisation du SVG exporté (échelle 2×) ; le rendu du texte y est approximatif (polices système, pas de métriques exactes).
- **Images importées** : stockées en data URL **dans le fichier projet** — un moodboard riche en photos produit un `.moodboard` volumineux (l'autosave web peut même saturer `localStorage` ; le message d'erreur invite alors à enregistrer sous forme de fichier).
- **Bibliothèque Médias** : par session uniquement (non persistée entre deux lancements).
- **Recadrage d'image** : purement visuel (destructif) — pas de recadrage non destructif rééditable.
- **Non implémentés (roadmap)** : mode présentation, « brand mode », command palette, tags, recherche.

---

## Roadmap

- **Migration UXP** — quand l'utilisateur le décidera.
- **Tags** et **recherche** dans le tableau.
- **Couches** (layers).
- **Mode présentation** (brand mode).
- **Templates** de moodboards.

---

## Licence

Usage interne / projet de démonstration. Non affilié à Adobe ; Illustrator et CEP sont des marques d'Adobe.

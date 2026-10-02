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
Texte, note, commentaire, image, couleur, palette, typographie, lien, fichier, **ligne attachable** (avec flèches, raccordable aux autres éléments), forme, **section conteneur**, colonne, tableau, checklist, croquis (tracé à main levée) — plus le **groupe** (`⌘/Ctrl + G`) comme conteneur logique.

### Sélection et transformation
- Sélection multiple, **marquee** (lasso sur zone vide), `Maj + clic` pour ajouter/retirer.
- Resize par poignées avec **ratio préservé**, redimensionnement ancré (le côté opposé reste fixe).
- **Rotation** par poignée, `Maj` = pas de 15°.
- **Aimantage intelligent** (bords et centres) avec guides visuels ; `⌘/Ctrl` pendant le drag pour le désactiver temporairement.
- Verrouillage et masquage d'éléments, réorganisation z (avant/arrière).

### Édition et flux de travail
- **Historique Undo/Redo transactionnel** (80 entrées, 1 entrée par geste).
- Presse-papiers (copier / couper / coller), `⌘/Ctrl + D` pour dupliquer.
- `Alt + glisser` = **duplication rapide** ; sur une section/colonne, `Alt + glisser` déplace **le conteneur seul** (sans son contenu).
- **Alignement / distribution** de la sélection ; **disposition automatique** d'un lot d'images : grille, masonry ou collage.
- **Bibliothèque latérale** (images importées dans la session) avec **drag-out** vers le canvas.
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
> du panneau doit afficher **v1.6.0**. S'il affiche autre chose, l'ancienne
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

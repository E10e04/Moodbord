# Moodboard

> **Table de travail spatiale pour designers.** Un canvas infini où l'on
> attrape une ressource, on la dépose, on organise l'espace, on zoome sur le
> détail : **GRAB → DRAG → DROP → ORGANIZE → ZOOM → PAN**.

Moodboard rassemble moodboards de marque, références, palettes, typographies
et annotations dans un espace libre — avec caméra découplée (zoom focalisé
sur le curseur, pan Espace+glisser), **17 types d'éléments**, undo/redo
transactionnel et autosave.

Le projet existe sous **deux formes** qui partagent exactement le même moteur
(une seule base de code HTML/CSS/JS — CEP, application bureau et web
exécutent les mêmes fichiers) :

| | 🧩 Extension Illustrator | 🖥️ Application autonome |
|---|---|---|
| Dossier | [`moodboard-cep/`](moodboard-cep/) | [`moodboard-desktop/`](moodboard-desktop/) |
| Technologie | Panneau CEP (CSXS 10/11) | Electron |
| Hôte | Illustrator 2021+ | Aucun — fonctionne seule |
| Windows | ✔ | ✔ 10 / 11 (64 bits) |
| macOS | ✔ | ✔ 11 Big Sur et + (Intel + Apple Silicon) |
| Pont Illustrator (nuances, placement d'images) | ✔ ExtendScript | — (export SVG/PNG à la place) |

> Les données sont **partagées** entre les deux formes sur une même machine
> (`<USER_DATA>/Moodboard`) : l'autosave et les projets `.moodboard` passent
> de l'extension à l'application et réciproquement.

---

## 📥 Démarrage rapide

### Application autonome Windows

1. Ouvrez la page **[Releases](https://github.com/E10e04/Moodbord/releases)**
   du dépôt.
2. Téléchargez `Moodboard-Setup-1.1.0.exe` (installateur 1-clic) ou
   `Moodboard-…-portable.zip` (aucune installation, aucun droit
   administrateur).
3. Lancez `Moodboard.exe` — c'est tout.

> Aucun Release visible ? Voir [« Générer les installateurs »](#-générer-les-installateurs-github-actions)
> ci-dessous — deux clics sur GitHub, **sans rien installer sur votre
> machine**, y compris le `.dmg` macOS.

### Application autonome macOS

1. Page **[Releases](https://github.com/E10e04/Moodbord/releases)** →
   téléchargez `Moodboard-1.1.0-arm64.dmg` (Apple Silicon) ou
   `Moodboard-1.1.0-x64.dmg` (Intel).
2. Glissez « Moodboard » dans Applications.
3. Premier lancement : **clic droit ▸ Ouvrir** (application non signée — voir
   [Limites](#-limites-connues)).

### Extension Adobe Illustrator

1. Téléchargez [`moodboard-cep/dist/moodboard-cep-1.1.0.zip`](moodboard-cep/dist/moodboard-cep-1.1.0.zip)
   depuis ce dépôt (bouton *Download raw file*).
2. Dézippez le contenu dans le dossier des extensions CEP :
   - **macOS** : `~/Library/Application Support/Adobe/CEP/extensions/moodboard-cep/`
   - **Windows** : `%APPDATA%\Adobe\CEP\extensions\moodboard-cep\`
   (le dossier doit contenir `CSXS/` et `client/` visibles à sa racine)
3. Activez le mode debug CEP (une fois) :
   - **macOS** :
     ```bash
     defaults write com.adobe.CSXS.11 PlayerDebugMode 1   # Illustrator 2025
     defaults write com.adobe.CSXS.10 PlayerDebugMode 1   # Illustrator 2021-2024
     ```
   - **Windows** (regedit, `HKEY_CURRENT_USER\Software\Adobe\CSXS.11`) :
     valeur chaîne `PlayerDebugMode` = `1`
4. Relancez Illustrator → **Fenêtres ▸ Extensions ▸ Moodboard**.
5. Le badge en bas à droite du panneau doit afficher **v1.1.0**.

Documentation complète (installation, débogage, diagnostic) :
[`moodboard-cep/README.md`](moodboard-cep/README.md).

---

## 🚀 Générer les installateurs (GitHub Actions)

Les binaires (`.exe`, `.dmg`, `.zip`) ne sont **pas** versionnés dans le dépôt
(limite GitHub : 100 Mo par fichier). Ils sont **construits automatiquement**
par [GitHub Actions](.github/workflows/build.yml) sur des machines GitHub —
**aucun Mac ni Windows requis chez vous** :

### À la demande (bouton)

1. Onglet **[Actions](https://github.com/E10e04/Moodbord/actions)** du dépôt.
2. Flèche ▾ à droite de « Build & Release » → **Run workflow** → bouton vert.
3. ~10 minutes plus tard : résumé du run → section **Artifacts** —
   `Moodboard-Setup-1.1.0.exe`, zip portable Windows, `.dmg` x64 + arm64,
   zip de l'extension CEP.

### Release publique (tag)

```bash
git tag v1.1.0
git push origin v1.1.0
```
→ un **Release** public est créé automatiquement avec tous les installateurs
en pièces jointes (c'est la façon d'obtenir une page Releases téléchargeable
par n'importe qui).

---

## 📁 Contenu du dépôt

```
Moodbord/
├── moodboard-cep/                # Extension Adobe Illustrator (CEP)
│   ├── CSXS/manifest.xml         #   Manifeste d'hôte (ILST 25.0–99.9)
│   ├── client/                   #   Panneau : index.html, css/, js/, assets/
│   │   └── js/                   #     core/ (store, history, camera, storage,
│   │                             #       diaglog…), ui/ (toolbar, library,
│   │                             #       inspector…), board/ (interactions,
│   │                             #       export…), adobe/ (CSInterface, jsx)
│   ├── scripts/                  #   validate.mjs, package.mjs
│   └── dist/                     #   moodboard-cep-1.1.0.zip (prêt à installer)
├── moodboard-desktop/            # Application autonome (Electron)
│   ├── main.js                   #   Processus principal (fenêtre, IPC fs,
│   │                             #     dialogues natifs, garde de fermeture)
│   ├── preload.js                #   contextBridge → window.mbDesktop
│   ├── renderer/                 #   Copie du client + CSP stricte (générée
│   │                             #     par scripts/sync-client.mjs)
│   ├── build/                    #   Icônes (icon.png 1024, icon-multi.ico)
│   ├── scripts/                  #   sync-client.mjs, set-win-icon.mjs
│   └── package.json              #   electron-builder (nsis Win / dmg mac 11+)
└── .github/workflows/build.yml   # CI : builds + Releases automatiques
```

**Source unique** : `moodboard-cep/client/` est la référence ;
`moodboard-desktop/renderer/` en est la copie générée (avec CSP) —
`npm run sync` la régénère à partir du client.

---

## 🛠️ Construire depuis les sources

Prérequis : [Node.js](https://nodejs.org) ≥ 18.

```bash
# Extension CEP (vérification syntaxique + zip)
cd moodboard-cep
node scripts/validate.mjs
node scripts/package.mjs        # → dist/moodboard-cep-1.1.0.zip

# Application bureau
cd ../moodboard-desktop
npm install
npm start                      # lance l'app en développement
npm run dist:win               # → dist/Moodboard-Setup-1.1.0.exe (sur Windows)
npm run dist:mac               # → dist/Moodboard-1.1.0-x64.dmg + arm64.dmg (sur Mac)
```

> Astuce Windows : retirez `"signAndEditExecutable": false` du
> `package.json` pour que rcedit intègre nativement l'icône
> (sur Linux, le script `set-win-icon.mjs` fait ce travail en pur JS).

---

## 💾 Où sont mes données ?

- **macOS** : `~/Library/Application Support/Moodboard`
- **Windows** : `%APPDATA%\Moodboard`
- Partagées avec l'extension CEP (`<USER_DATA>/Moodboard` côté Adobe).
- Autosave ~800 ms après la dernière modification (jamais pendant un geste) ;
  projets au format `.moodboard` (JSON versionné).
- Supprimer ce dossier = réinitialisation complète.

---

## ✨ Fonctionnalités

- **Canvas infini** : zoom molette focalisé curseur, pan (Espace+glisser,
  bouton milieu, outil Main `H`), Ajuster à l'écran `⇧1`.
- **17 types d'éléments** : image, texte, note, commentaire, couleur, palette,
  typographie, lien, fichier, ligne attachable (flèches), forme, section
  conteneur, colonne, tableau, checklist, croquis à main levée + groupes.
- **Sélection & transformation** : marquee, multi-sélection ⇧clic, resize à
  ratio préservé, rotation (⇧ = 15°), aimantage intelligent avec guides.
- **Flux** : undo/redo transactionnel (80 entrées), presse-papiers, `⌘/Ctrl+D`,
  `Alt+glisser` duplication, alignement/distribution, disposition automatique
  (grille, masonry, collage).
- **Bibliothèque latérale** + import par drop multi-fichiers (cascade depuis
  le curseur).
- **Export** : SVG vectoriel (ouvrable dans Illustrator) et PNG 2×.
- **Diagnostics intégrés** : badge de version, menu Aide ▸ Diagnostics…,
  journal persistant `diagnostic.log`.
- **Résilience des gestes** : couche d'événements adaptative (pointer **et**
  souris — certains hôtes CEP ne livrent pas les Pointer Events), survie
  600 ms aux blur/pointercancel parasites, diagnostic `MB.interact.diag()`.

---

## 🧪 Vérifications effectuées

- **Web/CEP — 54/54 tests E2E** (suites navigateur) : drags au 1/100 de pixel,
  simulation CEP sans Pointer Events, survie blur/pointercancel, undo exact.
- **Bureau — 10/10 tests E2E** sous Electron headless (Xvfb) : déplacement
  d'élément delta monde exact, autosave persisté sur disque via IPC, CSP
  acceptée, zéro erreur console.
- **Stockage — 44/44 assertions** (simulation fidèle du moteur CEP : chemins,
  permissions, replis).
- Syntaxe : `node --check` sur l'ensemble des fichiers JS.

## ⚠️ Limites connues

1. **Applications non signées** : Windows SmartScreen / macOS Gatekeeper
   peuvent demander une confirmation (« Plus d'infos ▸ Exécuter quand même » /
   clic droit ▸ Ouvrir). Une signature exige des certificats payants.
2. L'extension CEP requiert `PlayerDebugMode` (voir installation) — c'est une
   contrainte Adobe, pas du projet.
3. Les ponts Illustrator (nuances du document, placement d'images sur le
   plan de travail) existent uniquement dans le panneau CEP ; l'application
   autonome exporte SVG/PNG à la place.
4. Les images de démonstration (`assets/demo/`) sont des visuels de
   placeholder générés par IA.

## 📄 Licence

Projet Moodboard — usage libre. Le moteur est partagé entre l'extension CEP
et l'application bureau du même dépôt.

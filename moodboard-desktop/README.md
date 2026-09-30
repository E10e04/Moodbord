# Moodboard — Application autonome (Windows / macOS)

Moodboard est une **table de travail spatiale pour designers** : un canvas
infini où l'on glisse, déplace, organise, zoome et explore (GRAB → DRAG →
MOVE → DROP → ORGANIZE → ZOOM → PAN → EXPLORE).

Cette version est une **application de bureau installable**, indépendante
d'Illustrator — construite avec [Electron](https://www.electronjs.org/) à
partir du même moteur que l'extension CEP (source unique :
`../moodboard-cep/client`).

- **Windows** : 10 / 11 (64 bits)
- **macOS** : 11 Big Sur et ultérieur (Intel x64 + Apple Silicon arm64)

---

## 1. Installation

### Windows — version portable (aucune installation)

1. Dézippez `Moodboard-1.1.0-Windows-x64-portable.zip` où vous voulez.
2. Double-cliquez sur `win-unpacked\Moodboard.exe`.
3. C'est tout — aucun droit administrateur, aucune inscription.

> L'application stocke ses données dans `%APPDATA%\Moodboard`
> (projets, autosave). Supprimer ce dossier = réinitialisation complète.

### Windows — installateur classique (Setup.exe)

L'installateur NSIS doit être produit **sur une machine Windows** (ou
Linux/macOS avec wine) :

```bash
npm install        # dans ce dossier moodboard-desktop/
npm run dist:win   # → dist/Moodboard-Setup-1.1.0.exe (installateur 1-clic)
```

### macOS — image disque (.dmg)

Le `.dmg` doit être construit **sur un Mac** (exigence d'Electron) :

```bash
npm install        # Node.js 18+ requis — https://nodejs.org
npm run dist:mac   # → dist/Moodboard-1.1.0-x64.dmg + dist/Moodboard-1.1.0-arm64.dmg
```

Glissez « Moodboard » dans Applications, lancez-le. Au premier lancement,
clic droit ▸ Ouvrir (application non signée — voir §6).

### Lancer sans construire (développement)

```bash
npm install
npm start          # synchronise le client puis ouvre l'app
```

---

## 2. Fonctionnalités

Identiques au moteur de l'extension CEP (vérifié par les mêmes harnais) :

- **Canvas spatial infini** : zoom molette focalisé curseur, pan
  Espace+glisser / bouton milieu / outil Main, Ajuster à l'écran (⇧1) ;
- **17 types d'éléments** : images, textes, notes, commentaires, nuances,
  palettes, typographies, liens, fichiers, lignes, formes, sections,
  colonnes, tableaux, checklists, croquis, groupes ;
- **Sélection & transformation** : marquee, multi-sélection ⇧clic,
  poignées de redimensionnement (ratio ⇧), rotation (⇧ = 15°),
  verrouillage, masquage, ordre, alignement ;
- **Flux de travail** : undo/redo (⌘/Ctrl+Z), presse-papiers interne,
  duplication ⌘D, groupes ⌘G, drag + Alt = duplication ;
- **Bibliothèque de médias** : glissez-déposez des images depuis le
  Finder / l'Explorateur (lecture directe du disque via `file.path`) ;
- **Persistance** : autosave 800 ms + projets `.moodboard`
  (Fichier ▸ Enregistrer / Ouvrir / Enregistrer sous) ;
- **Export** : PNG (rastérisé 2×) et **SVG vectoriel** ;
- **Aide ▸ Diagnostics…** : rapport complet autonome.

### Différences avec l'extension Illustrator

| | Extension CEP | Application autonome |
|---|---|---|
| Canvas, éléments, organisation, undo/redo | ✓ | ✓ (même code) |
| Autosave + projets .moodboard | ✓ | ✓ (IPC disque) |
| Export PNG / SVG | ✓ | ✓ (dialogues natifs) |
| Nuances du document Illustrator | ✓ | — |
| Envoyer des couleurs dans Illustrator | ✓ | — |
| Placer une image dans le document AI | ✓ | — |
| Dépend d'Illustrator / PlayerDebugMode | oui | **non** |

Le pont Illustrator repose sur ExtendScript, disponible uniquement dans le
panneau CEP. L'export SVG reste la passerelle naturelle vers Illustrator.

---

## 3. Où sont mes données ?

- macOS : `~/Library/Application Support/Moodboard`
- Windows : `%APPDATA%\Moodboard`

C'est **le même dossier que l'extension CEP** (`<USER_DATA>/Moodboard`
côté Adobe) : sur une même machine, l'autosave et les projets créés dans
l'extension sont repris par l'application, et réciproquement.

---

## 4. Architecture

```
moodboard-desktop/
├── main.js               # Processus principal (fenêtre, menu natif,
│                         #   IPC fs {err,data} parité cep.fs, dialogues,
│                         #   garde de fermeture, mode E2E headless)
├── preload.js            # contextBridge → window.mbDesktop (fs sync +
│                         #   dialogues async) — isolé, sans Node côté page
├── scripts/
│   ├── sync-client.mjs   # Copie ../moodboard-cep/client → ./renderer
│   │                     #   (source unique) + injection CSP stricte
│   └── set-win-icon.mjs  # resedit : icône + VersionInfo de Moodboard.exe
│                         #   en pur JavaScript (remplace rcedit+wine)
├── build/icon.png        # Icône 1024 (convertie en .icns/.ico)
├── renderer/             # GÉNÉRÉ par sync-client — ne pas éditer
└── package.json          # electron-builder : dmg x64+arm64 (macOS 11+),
                          #   nsis x64 (Windows)
```

**Le renderer est identique au panneau CEP** : `core/desktop.js` active le
mode application quand `window.mbDesktop` est présent (injecté par le
preload), et `storage.js` route vers l'adaptateur IPC — sinon CEP, sinon
web. Une seule base de code, trois cibles.

### Sécurité

- `contextIsolation: true`, `nodeIntegration: false` ;
- CSP stricte injectée dans le renderer desktop uniquement
  (`default-src 'none'`, scripts `'self'`, styles `'unsafe-inline'`
  nécessaires à l'interface) ;
- IPC fichiers limités aux chemins absolus.

---

## 5. Vérifications réelles effectuées

- **E2E headless Electron (Xvfb)** — 10/10 PASSÉS : version 1.1.0, mode
  desktop, dossier de données, démo 17 éléments, **déplacement d'élément
  par événements pointeur (delta monde exact au 1/100)**, autosave
  persisté sur disque via IPC, journal de diagnostic écrit, menu natif →
  dialogue, zéro erreur console ;
- **Régression web/CEP** — 54/54 PASSÉS (suites `tests/
  moodboard-cep-v102-e2e.js` 31/31 + `tests/moodboard-cep-events-e2e.js`
  23/23), 0 erreur console ;
- **Syntaxe** — `node --check` sur tous les fichiers ;
- **Zip Windows portable** — 76 fichiers, archive vérifiée, icône
  multi-résolutions + VersionInfo injectées.

*Limite honnête : le `.dmg` macOS et le `Setup.exe` Windows n'ont pas pu
être produits dans l'environnement Linux de développement (Electron
l'exige sur la plateforme cible — voir §1). Le code est identique et
vérifié.*

---

## 6. Limites connues

1. **Application non signée** : Windows SmartScreen et macOS Gatekeeper
   peuvent demander une confirmation (« Plus d'infos ▸ Exécuter quand
   même » / clic droit ▸ Ouvrir). Une signature nécessite des
   certificats payants (Apple Developer, EV Windows).
2. L'icône du `.exe` portable est intégrée par `set-win-icon.mjs`
   (resedit) ; si vous construisez le `Setup.exe` sur Windows avec
   `npm run dist:win`, retirez `signAndEditExecutable: false` du
   `package.json` pour que rcedit fasse ce travail nativement.
3. Pas d'intégration Illustrator (voir tableau §2).
4. Un seul dossier de données pour l'app ET l'extension CEP sur la même
   machine (partage volontaire — voir §3).

---

## 7. Licence

Projet Moodboard — usage libre. Le moteur est partagé avec l'extension
CEP du même projet.

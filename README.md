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
   `Moodboard-Setup-1.6.1.exe`, zip portable Windows, `.dmg` x64 + arm64,
   zip de l'extension CEP.

### Release publique (tag)

```bash
git tag v1.6.1
git push origin v1.6.1
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
│   └── dist/                     #   moodboard-cep-1.4.0.zip (prêt à installer)
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
node scripts/package.mjs        # → dist/moodboard-cep-1.4.0.zip

# Application bureau
cd ../moodboard-desktop
npm install
npm start                      # lance l'app en développement
npm run dist:win               # → dist/Moodboard-Setup-1.4.0.exe (sur Windows)
npm run dist:mac               # → dist/Moodboard-1.4.0-x64.dmg + arm64.dmg (sur Mac)
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
  conteneur, colonne, tableau, checklist, croquis à main levée, carte
  assignées (composant personnes) + groupes.
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

- **Web/CEP — 486/486 tests E2E navigateur** (9 suites : v1.8.0, v1.6.1, v1.6.0, v1.5.0 ×2 phases, v1.4.0 ×2 phases, v1.3.0, v1.2.0, events, v1.0.2) + **114/114 assertions de stockage** (83 v1.4-1.7 + 31 v1.8 : slots par projet, noms synchronisés) : drags au 1/100 de pixel,
  simulation CEP sans Pointer Events, survie blur/pointercancel, undo exact.
- **Bureau — 10/10 tests E2E** sous Electron headless (Xvfb) : déplacement
  d'élément delta monde exact, autosave persisté sur disque via IPC, CSP
  acceptée, zéro erreur console.
- **Stockage — 83/83 assertions** (simulation fidèle du moteur CEP : chemins,
  permissions, replis, vues/favoris/corbeille/miniatures).
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

## 📜 Changelog

## 🆕 v1.12.0 — palette « picker », section retirée, colonnes réparées, garde de fermeture

- **Outil Palette** redessiné d'après le bloc **« picker » de Bencho** :
  pastille à ronds de couleur empilés + liste cochable (nom + code hex +
  coche) ; cliquer le **code hex le copie**.
- **Panneau Projet** : les rangées de palette montrent les **codes
  couleurs** (plus les noms) et le champ modifie la couleur ; nom de la
  palette éditable au même endroit.
- **Outil Section retiré** — la colonne reste le seul conteneur vertical ;
  les anciens projets sont **migrés** (sections → colonnes, rien de perdu).
- **Colonnes réparées** : la hauteur ne rétrécit plus (le bug
  « l'empilement ne marche pas ») ; les cartes prennent **la largeur de la
  colonne** et **suivent son redimensionnement en direct** ; un dépôt à
  cheval sur le bord bas rejoint la pile.
- **Fermeture** : quitter avec du travail non enregistré propose
  **« Enregistrer » / « Annuler »** (application autonome).
- 540 assertions E2E (v102→v1120) + 114 simulation, zéro erreur console.

### v1.11.0 — images système, bibliothèque persistante, composant Assignees

1. **Images ouvertes au reste du système** : clic droit sur une image →
   **Copier l'image** (bitmap PNG dans le presse-papiers du système,
   collable partout), **Enregistrer l'image…** (dialogue natif dans
   l'extension et l'application), **Ajouter à la bibliothèque**. Sur le
   canvas : **Coller une image** depuis le presse-papiers, et ⌘V d'une
   image copiée ailleurs (navigateur, capture d'écran) atterrit sur la
   planche.
2. **Bibliothèque Médias persistante** : les images ajoutées survivent
   aux projets et aux sessions (`library.json` dans le dossier de
   données, partagé application/extension). Suppression au survol de
   chaque vignette ; les images de démo (non supprimables) sont
   marquées.
3. **Barre de mise en forme des en-têtes** : le **titre des colonnes et
   des sections** s'édite avec la barre flottante — gras, italique,
   souligné, surlignage, **nouveau bouton couleur du texte** (disponible
   aussi pour les notes) et police de la sélection ; la mise en forme
   vit dans le document (sanitisée), l'export reste correct.
4. **Outil Palette redessiné** : carte portrait en **bandes verticales**
   pleine surface, code **hex en pied de bande** dans l'encre lisible,
   bandeau de nom, survol qui élargit la bande ; hauteur indépendante du
   nombre de couleurs ; export SVG au nouveau design.
5. **Croquis & ligne en direct, fidélisés** : l'épaisseur du tracé
   temporaire suit exactement le zoom et la **flèche de fin** se dessine
   pendant le geste.
6. **Composant Assignees** (porté de [Bencho](https://bencho.dev), MIT —
   commentaires d'origine conservés dans
   [`assignees.js`](moodboard-cep/client/js/ui/assignees.js)) :
   nouvelle carte **« Assignées »** (outil U) — une **pastille qui se
   remplit de visages** à mesure qu'on assigne les personnes, et la
   liste qui les choisit (avatars inclus, 4 personnes de la distribution).

### v1.10.0 — cartes de lien relookées, mini-canvas, cadenas cliquable

1. **Cartes de lien relookées** (design fourni par l'utilisateur) :
   carte **portrait** — **hero blanc** avec le **LOGO du site**
   (favicon haute résolution) et le nom du service, zone d'infos
   sombre (couleur modifiable) : **favicon + URL** gris, **titre
   orange souligné**, **description** gris clair. **Le site n'est
   jamais chargé ni capturé** (le favicon vient du service public ;
   titre/description en lecture légère des métadonnées, best effort
   et toujours éditables sur place).
2. **Préférences épurées** : le texte d'explication du dossier de
   caches (« Ce choix… ») est retiré.
3. **Indicateur clavier** : **icône de clavier** à côté de la version —
   **verte** quand les raccourcis sont actifs, **rouge** sinon.
4. **Typographie** : le **sélecteur de police s'ouvre sur la carte**
   dès la création ; la barre contextuelle le propose aussi.
5. **Carte Importer épurée** : icône d'import + « **Cliquez pour
   importer un fichier** » au milieu (zone centrale cliquable).
6. **Couleur des checklists** : fond de carte modifiable, encre adaptée.
7. **Colonnes & sections** : **couleur d'en-tête** + **couleur de
   corps** séparées, **titre mis en forme** (police, taille, gras,
   italique, couleur).
8. **Mini-canvas verticaux** : les cartes **glissées dans une colonne
   ou une section s'empilent verticalement** (insertion au point de
   dépôt, re-compactage après suppression, croissance automatique).
9. **Cadenas cliquable** : cliquer un élément **verrouillé** montre un
   **cadenas dans son coin supérieur** — le clic le **déverrouille**.
10. **Miniatures de l'accueil nettes** : **un seul élément
    représentatif** par projet, rendu plein cadre en 640×400.
11. **Croquis & ligne en direct** : tracé temporaire **fidèle**
    (couleur, épaisseur, arrondis réels).
12. **Outil Image** : carte d'attente (« Cliquez pour choisir une
    image ») — l'image choisie **remplit la carte**.

### v1.9.0 — langue de l'interface, liens repensés, sélecteur de formes

1. **Langue de l'interface** (Préférences ▸ Langue) : « Langue du
   système » par défaut — l'application ET l'extension suivent la
   langue du système — ou forçage **Français / English** (menus,
   outils, panneaux, dialogues, écran d'accueil traduits ; préférence
   partagée dans `prefs.json`).
2. **Barre de mise en forme réparée** (bug v1.8) : un appui sur ses
   boutons ne quitte plus l'édition — le clic remontait au canvas et
   validait l'élément avant l'action du bouton ; la sélection survit
   et le formatage s'applique.
3. **Cartes de lien** : couleur de carte modifiable + **aperçu
   STATIQUE** du site visé (capture d'écran dans l'application via
   WebContentsView hors écran ; `og:image` dans l'extension CEP ;
   favicon en repli) + **flèche d'ouverture moderne**.
4. **Miniatures de l'écran d'accueil** : cadrage resserré, fond papier
   chaud, JPEG 0.85, zoom au survol.
5. **Bouton Police** : libellé « Police » (l'ancien affichait la source
   de la fonction `current()`).
6. **Dialogues de mise à jour** : plus aucun lien vers le dépôt GitHub
   (boutons retirés, notes filtrées) — la mise à jour reste automatique.
7. **Outil Forme** : sélecteur **Rectangle / Cercle / Triangle**
   (double-clic ou appui long sur l'outil, ou directement au point de
   dépôt sur le canvas) ; le triangle devient un **polygone régulier**
   dont le nombre de **branches** (3-24) se règle dans le panneau Projet.
8. Vérifications : **360 assertions E2E** (v102→v190) + 114 simulation
   stockage au vert, zéro erreur console, VLM conforme.

### v1.8.0 — notes riches, groupes réparés, outil Importer, tableaux, favoris

1. **Notes et textes riches** : pendant l'édition, une **barre de mise en
   forme** apparaît au-dessus de la carte — **gras, italique, souligné,
   barré, surlignage, listes à puces / numérotées et police de la
   sélection**. L'inspecteur convertit aussi une note entière en liste à
   puces (ou retire la mise en forme). HTML sanitisé (liste blanche),
   collage en texte brut, formatage persistant (`data.html` + repli
   texte pour la recherche/export).
2. **Éléments groupés réparés** : glisser un groupe déplace désormais
   ses éléments ; suppression et copier-coller emportent le contenu
   (correctif de la fermeture de sélection qui excluait les enfants).
3. **Outil Importer repensé** : **double-clic sur l'outil → explorateur /
   Finder** ; glisser l'outil sur le canvas crée une **carte d'import**
   (icône au centre, glisser-déposer de fichiers dessus). Tout
   s'importe — y compris les **moodboards** : un fichier `.moodboard`
   devient une **planche liée** qui reprend son nom et son nombre
   d'éléments.
4. **Tableaux** : couleurs de toutes les cellules, de la ligne
   d'en-têtes, d'une ligne ou d'une colonne précise + couleur du texte,
   police et taille du tableau (inspecteur enrichi).
5. **Police de tous les outils** : chaque outil qui écrit du texte
   expose la police — notes, textes, commentaires, checklists,
   tableaux, titres de sections, colonnes, planches et liens.
6. **Favoris de polices** : épinglez vos familles (♥) puis filtrez le
   popover avec le bouton **Favoris** — mémorisé pour tous les
   moodboards (prefs partagées).
7. **Dossier des caches global** : le dossier des Préférences
   s'applique à **tous les moodboards** avec un **autosave par projet**
   (jamais écrasé par un autre) ; ouvrir un projet restaure sa version
   non enregistrée si elle est plus récente.
8. **Nom du projet ↔ nom du fichier** : « Enregistrer sous… » propose le
   nom saisi en barre supérieure et le fichier renommé met à jour le nom
   du projet (barre supérieure, fil d'Ariane, contenu du fichier).
9. **Panneau Projet** : les éléments masqués avec l'œil restent listés
   avec un bouton de réactivation (et « Tout révéler »).
10. **Notes stables** : le redimensionnement par le bas ne replie plus
    la carte (hauteur minimum lisible) et la taille choisie n'est plus
    écrasée par la hauteur automatique.

### v1.7.0 — mises à jour GitHub, préférences, enregistrement direct, carte planche redessinée

1. **Mises à jour depuis le dépôt GitHub** : à chaque démarrage, si la
   machine est connectée à internet, l'application et l'extension
   vérifient les **releases du dépôt**. Une nouvelle version déclenche un
   **popup de proposition** : « Mettre à jour maintenant » télécharge puis
   installe **avec la progression à l'écran** (application : l'installateur
   de la plateforme est téléchargé en streaming puis lancé ; extension :
   les fichiers sont remplacés dans le dossier d'installation puis le
   panneau se recharge). « Plus tard » reste sans conséquence — le
   **numéro de version** (barre d'état, en bas) devient cliquable à tout
   moment pour relancer ou vérifier manuellement la mise à jour (il
   s'illumine quand une mise à jour est disponible).
2. **Fichier ▸ Préférences… (⌘/Ctrl+,)** : choix du **dossier des fichiers
   temporaires et des enregistrements automatiques** (autosave, récents,
   journaux) — sélecteur natif, migration des fichiers existants au
   changement, retour au dossier par défaut en un clic. La préférence est
   partagée par l'application et l'extension (elles suivent le même
   dossier), et reste visible/révélable depuis le dialogue.
3. **Enregistrement intelligent** : **⌘/Ctrl+S réécrit directement le
   fichier déjà enregistré** (plus de dialogue à chaque fois). Le
   **premier** enregistrement choisit l'emplacement ; **Enregistrer
   sous… (⇧⌘S)** choisit toujours un nouvel emplacement.
4. **Carte planche redessinée** (design demandé) : grande zone principale
   où le **nom de la planche est centré au milieu de son conteneur** ;
   barre du bas avec le **compteur d'éléments à gauche** et la **flèche
   d'ouverture à droite, au niveau de l'ancien libellé bleu « → planche »**
   (flèche bleue, SVG export aligné : séparateur, nom centré au-dessus de
   la barre, compteur et flèche en bas).

### v1.6.1 — planches : création sans entrée, retour par le nom, carte compacte

1. **Création sans ouverture automatique** : l'outil **Planche (E)** crée
   la carte **dans le moodboard actif** (plus d'entrée immédiate). Le nom
   est **éditable sur place** — le titre passe en édition dès la création,
   tapez le nom puis Échap/Entrée. La planche ne s'ouvre **que par sa
   flèche** (l'inspecteur et le menu contextuel restent des chemins
   explicites ; le double-clic ne déclenche plus l'entrée).
2. **Retour au moodboard principal par le nom** : dans la barre supérieure,
   **cliquer le nom du moodboard parent** dans le fil d'Ariane ramène à son
   niveau — plus besoin du seul Alt+←. Nouveau **bouton retour ‹** en tête
   du fil d'Ariane, et correctif macOS : le fil d'Ariane est désormais une
   zone cliquable de la barre (il était avalé par le déplacement de
   fenêtre).
3. **Carte planche compacte** : le grand rectangle d'aperçu et le badge
   bleu disparaissent — le **nom est centré** dans sa barre, la flèche
   d'ouverture vit dans la barre du bas **à la place de l'ancien libellé
   bleu « → planche »** (SVG export aligné : flèche au lieu du texte bleu,
   nom centré). Les cartes hautes héritées des fichiers v1.6.0
   s'affichent centrées.

### v1.6.0 — planches liées, édition texte corrigée, polices du système, presse-papiers des liens

1. **Outil Planche — moodboards liés** : l'outil **Planche (E)** crée un
   moodboard DANS le moodboard ouvert — la carte apparaît sur le canvas et
   on y entre immédiatement pour travailler. Double-clic (ou flèche de la
   carte) pour l'ouvrir, **Alt+←** ou **fil d'Ariane** (Racine ▸ Planche ▸ …)
   pour revenir. L'imbrication est récursive (planche dans planche), la carte
   affiche une **miniature réelle** de son contenu + son compteur, et tout
   l'arbre est enregistré DANS le fichier du moodboard racine (une seule
   sauvegarde embarque tout). La suppression d'une planche non vide demande
   confirmation ; l'autosave et l'écran d'accueil sont cohérents avec l'arbre.
2. **Édition de texte réparée** :
   - **⌘/Ctrl+A, ⌘C, ⌘X** pendant l'édition d'une note/texte sont désormais
     traités explicitement (sélection totale, copie, coupe) — ils fonctionnent
     identiquement dans le panneau CEP, l'application et le navigateur même
     quand l'hôte (Illustrator, macOS sans menu d'édition) les intercepte ;
   - **hauteur vivante** : la boîte du texte/note/commentaire grandit à
     mesure qu'on écrit (mesure du contenu — l'ancienne métrique mesurait la
     boîte, jamais le contenu : le texte multi-paragraphes débordait
     silencieusement, et la navigation aux flèches semblait morte) ;
   - les flèches ↑/↓ naviguent entre les paragraphes et l'élément ne bouge
     plus quand on écrit.
3. **Polices du système** : le sélecteur de police (inspecteur Texte, Note,
   Typographie) affiche **toutes les polices de l'ordinateur** — énumérées
   via l'API Local Font Access dans l'application et via les TextFonts
   d'Illustrator dans le panneau CEP (repli web dans le navigateur) — avec
   **recherche instantanée** et **police par défaut** (★, persistée dans
   `prefs.json`) appliquée à tout nouveau texte/note.
4. **Presse-papiers des liens** : l'inspecteur Lien gagne **Coller** (lit le
   presse-papiers, normalise `example.com` → `https://example.com`) et
   **Copier** ; ⌘A/⌘C/⌘X fonctionnent aussi explicitement dans les champs
   de l'interface.
5. **Application de bureau** : menu **Édition** natif (rôles Annuler/
   Rétablir/Couper/Copier/Coller/Tout sélectionner — indispensable sur macOS
   pour que les raccourcis atteignent la page) et permission Local Fonts.

### v1.5.0 — identité officielle, accueil #232323, poignée de rotation à droite

1. **Logo officiel** partout : le logo fourni (`assets/logo.png`) remplace
   les anciennes marques — barre latérale et en-tête de l'écran d'accueil,
   marque de la barre supérieure du panneau, dialogue « À propos », icônes
   de l'application de bureau (icône 1024 px + `icon-multi.ico`) et
   **icônes du panneau CEP dans le manifeste** (Std 23 px + HiDPI 46 px,
   visibles dans le menu Fenêtre ▸ Extensions d'Illustrator).
2. **Écran d'accueil : interface #232323** — la palette de l'accueil est
   recentrée sur le gris neutre demandé (fond #232323, barre latérale
   #1E1E1E, cartes #2A2A2A, bordures #3A3A3A), accent bleu conservé.
3. **Accueil épuré** : le bouton « Nouveau moodboard » à côté de la barre
   de recherche est retiré (redondant avec la barre latérale et les
   actions rapides, qui restent intactes).
4. **Poignée de rotation déplacée à droite** : sur chaque élément du
   canvas, la poignée de pivot (et sa ligne de liaison, désormais
   horizontale) se place sur le côté droit de la sélection au lieu du
   dessus — même comportement (⇧ = pas de 15°, badge d'angle).

### v1.4.0 — écran d'accueil redessiné (design à barre latérale)

1. **Nouvel écran d'accueil (application de bureau)** conforme au design
   demandé, accent **bleu** : **barre latérale** (Accueil actif, Nouveau,
   Ouvrir, Importer — puis Récents, Favoris, Corbeille — et Aide en bas),
   **en-tête** (identité, sous-titre « Café des idées — votre table de
   travail spatiale »), **recherche instantanée** et bouton **Nouveau
   moodboard** ; palette plus profonde que le canvas (fond #08080C,
   cartes #12121A).
2. **Cartes de fichiers récents repensées** : miniature du tableau
   (générée en JPEG à chaque enregistrement, `recent.json`), date
   relative + nombre d'éléments, badge étoile des favoris, menu ⋯
   (Ouvrir, Afficher dans le Finder/Explorateur, Ajouter/Retirer des
   favoris, Retirer de la liste).
3. **Favoris et corbeille** : les vues de la barre latérale filtrent les
   récents épinglés et les entrées retirées (restaurables, suppression
   définitive possible) — le fichier projet n'est jamais touché.
4. **Recherche** : filtrage instantané par nom ou chemin, compteur
   dynamique, états vides dédiés (aucun résultat, favoris, corbeille).
5. **Aperçu web de l'écran d'accueil** : `?home=1` (préview Next.js)
   affiche l'accueil avec trois tableaux de démonstration pour
   visualiser le design sans l'application.
6. Panneau CEP et navigateur sans `?home=1` : comportement inchangé.

### v1.3.0 — enregistrement, écran d'accueil, liens

1. **Enregistrer / Enregistrer sous… / ⌘-Ctrl+S** : le dialogue natif du
   système (Finder, Explorateur de fichiers) s'ouvre à chaque
   enregistrement pour choisir où sauvegarder le projet. Le dossier du
   dernier enregistrement est **mémorisé** (`prefs.json` du dossier de
   données, partagé application ↔ extension) : le dialogue s'ouvre
   directement au bon endroit la fois suivante. Le nom proposé est celui
   du fichier courant. Les exports PNG/SVG en profitent aussi.
2. **Écran d'accueil (application de bureau)** : au lancement, la fenêtre
   ouvre sur un écran d'accueil au lieu du canvas — bouton **Nouveau
   moodboard**, **Ouvrir…**, **Charger la démonstration**, carte
   **Reprendre la session** (travail non enregistré) et les **20 fichiers
   récents** (clic = réouverture, `recent.json`). Un bouton Accueil
   (icône maison) dans la barre supérieure y revient à tout moment ;
   les raccourcis canvas sont inertes tant que l'accueil est affiché.
   Panneau CEP et aperçu web : comportement inchangé (l'autosave y est
   restauré comme toujours).
3. **Liens du canvas** : un clic sur la carte d'un lien la
   sélectionne/déplace comme n'importe quel élément ; le navigateur ne
   s'ouvre **que par la flèche dédiée** (coin supérieur droit de la
   carte, toujours visible).
4. `Nouveau moodboard` efface désormais aussi l'autosave **sur disque**
   (et pas uniquement le stockage local) — l'ancien travail ne
   ressuscite plus au prochain lancement.

### v1.2.0 — correctifs racine drag & drop + raccourcis clavier

Deux pannes racine corrigées, diagnostiquées sur les rapports v1.1.x
(`ghostStart=9, ghostDrop=4, ghostCancel=0` et `keydown=0, keyup=0`) :

1. **Drag & drop bibliothèque/outils → canvas** : la couche adaptative
   avalait le `mouseup` de fin de drag sur les moteurs CEP qui livrent
   `pointermove` mais jamais `pointerup` — le ghost ne se posait jamais et
   fuyait en silence. La couverture pointer→souris est désormais **par nature
   d'événement** (un `mouseup` n'est masqué que par un `pointerup` récent),
   avec annulation propre sur `buttons=0`, chien de garde anti-fuite (8 s) et
   invalidation des ghosts obsolètes au nouvel appui.
2. **Raccourcis clavier morts dans Illustrator** : un panneau CEP ne reçoit
   aucun `keydown` tant que le document ne porte pas le focus. Le document
   porte désormais `tabindex` (`<body tabindex="0">`), chaque appui dans le
   panneau rend le focus au document, et la **pastille ⌨ de la barre d'état**
   affiche l'état réel (cliquer dedans réarme).
3. **Rapport de diagnostic enrichi** : compteurs clavier/ghost
   (`keydown`/`keyup`/`focusInInput`/`ghostStart`/`ghostDrop`/`ghostCancel`),
   ligne *Focus clavier*, ligne *Hôte* corrigée (le moteur CEP renvoie une
   chaîne JSON enfin analysée) et comptage des événements **une seule fois**.

Vérifié sur le client fusionné : **177/177 tests** (133 E2E navigateur en 4 suites + 44 assertions de stockage), vraie souris
et vrai clavier pilotés via CDP — 0 erreur console. Le détail complet est
dans [`moodboard-cep/README.md`](moodboard-cep/README.md).

---

## 📄 Licence

Projet Moodboard — usage libre. Le moteur est partagé entre l'extension CEP
et l'application bureau du même dépôt.

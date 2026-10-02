/* =========================================================================
 * boards.js — Planches liées : moodboards imbriqués dans un moodboard (v1.6).
 *
 * Une « planche » est un élément de type `board` sur le canvas : sa carte
 * renferme un document complet (data.doc = { elements, camera }). Double-clic
 * (ou bouton dédié) → on ENTRE dans la planche : le canvas affiche son
 * contenu et un fil d'Ariane apparaît dans la barre supérieure. La
 * navigation est récursive (planche dans planche) — pile de cadres.
 *
 * Le contenu des planches vit DANS le fichier du moodboard racine :
 * une seule sauvegarde embarque tout l'arbre.
 *
 * Cohérence de l'arbre pendant l'édition :
 *  - chaque cadre garde : le tableau d'éléments du parent (référence),
 *    l'élément planche (référence objet), la caméra et le projet parents ;
 *  - syncUp() réécrit le document courant dans l'élément planche du parent
 *    (en cascade jusqu'à la racine) — appelé par serialize() à chaque
 *    enregistrement/autosave et avant chaque sortie ;
 *  - en sortie : miniature générée au mieux (async), titre synchronisé,
 *    le parent est restauré et la planche re-sélectionnée.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  var MAX_DEPTH = 8;

  /* Pile de navigation : [{ parentElements, boardEl, parentCamera,
   * parentProject, title }] — parentElements est la RÉFÉRENCE du tableau
   * d'éléments du document parent (gelé tant qu'on est plus profond). */
  var frames = [];

  var listeners = [];
  function onChange(fn) {
    listeners.push(fn);
    return fn;
  }
  function emitChange() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) { /* jamais bloquant */ }
    }
  }

  function cleanEl(e) {
    var c = U.deepClone(e);
    if (c) {
      delete c._rev;
      delete c._sized;
    }
    return c;
  }

  function docOf(el) {
    if (el.data && el.data.doc && Array.isArray(el.data.doc.elements)) {
      return el.data.doc;
    }
    return null;
  }

  function depth() {
    return frames.length;
  }

  function insideBoard() {
    return frames.length > 0;
  }

  /* Titres du fil d'Ariane : [racine, planche1, planche2, …, actuel]. */
  function crumb() {
    var out = [];
    if (frames.length) out.push(frames[0].parentProject.name || 'Sans titre');
    for (var i = 0; i < frames.length; i++) {
      var t = frames[i].boardEl && frames[i].boardEl.data ? frames[i].boardEl.data.title : '';
      out.push(t || 'Planche');
    }
    return out;
  }

  /* Écrit le document courant dans l'élément planche du parent — en
   * cascade : chaque niveau ancêtre reçoit l'état du niveau inférieur.
   * Idempotent, sans historique : pure cohérence de l'arbre. */
  function syncUp() {
    if (!frames.length) return;
    var st = MB.store.s();
    for (var i = frames.length - 1; i >= 0; i--) {
      var els = i === frames.length - 1 ? st.elements : frames[i + 1].parentElements;
      var cam = i === frames.length - 1 ? st.camera : frames[i + 1].parentCamera;
      var name = i === frames.length - 1 ? st.project.name : frames[i + 1].parentProject.name;
      var target = frames[i].boardEl;
      if (!target || !target.data) continue; /* la planche a été supprimée ? */
      target.data.doc = {
        elements: els.map(cleanEl),
        camera: {
          x: U.round(cam.x, 2),
          y: U.round(cam.y, 2),
          zoom: U.round(cam.zoom, 4)
        },
        name: name
      };
      target.data.elCount = els.length;
      if (name && name !== target.data.title) target.data.title = name;
    }
  }

  /* Tableau d'éléments du document RACINE (utile à serialize() quand
   * une planche est ouverte — le fichier embarque l'arbre complet). */
  function rootElements() {
    return frames.length ? frames[0].parentElements : MB.store.s().elements;
  }

  function rootCamera() {
    return frames.length ? frames[0].parentCamera : MB.store.s().camera;
  }

  /* Réécrit le document courant dans l'élément planche du parent SANS le
   * quitter (utilisé par serialize). Alias public explicite. */
  function commitCurrentIntoParent() {
    syncUp();
  }

  function enter(el) {
    if (!el || el.type !== 'board' || el.locked) return false;
    if (frames.length >= MAX_DEPTH) {
      MB.ui.toast('Profondeur maximale de planches atteinte (' + MAX_DEPTH + ').', 'info');
      return false;
    }
    var st = MB.store.s();
    if (st.ui.editingId && MB.interact) MB.interact.commitEditing();

    frames.push({
      parentElements: st.elements,
      boardEl: el,
      parentCamera: {
        x: st.camera.x,
        y: st.camera.y,
        zoom: st.camera.zoom
      },
      parentProject: {
        name: st.project.name,
        path: st.project.path
      },
      title: (el.data && el.data.title) || 'Planche'
    });

    var doc = docOf(el);
    var fresh = doc
      ? U.deepClone(doc.elements).map(function (e) {
          if (!e._rev) e._rev = 1;
          return e;
        })
      : [];

    MB.store.loadDocument({
      name: (el.data && el.data.title) || 'Planche',
      /* le fichier reste celui du RACINE : ⌘S enregistre tout l'arbre */
      path: st.project.path,
      elements: fresh,
      camera: doc && doc.camera ? doc.camera : undefined
    });
    if (!fresh.length) MB.camera.fit(null);

    MB.ui.toast('Planche « ' + ((el.data && el.data.title) || 'Planche') + ' » ouverte — Alt+← pour revenir', 'success');
    emitChange();
    return true;
  }

  /* Miniature au mieux (asynchrone, jamais bloquante) : la carte de la
   * planche affiche un aperçu de son contenu. */
  function thumbFor(boardEl) {
    try {
      if (!MB.exporter || typeof MB.exporter.thumbnail !== 'function') return;
      if (!MB.store.s().elements.length) return; /* vide : motif par défaut */
      MB.exporter.thumbnail(480, 320, function (dataUrl) {
        if (!dataUrl || !boardEl || !boardEl.data) return;
        boardEl.data.thumb = dataUrl;
        var v = MB.board ? MB.board.viewOf(boardEl.id) : null;
        if (v && v.node.isConnected) v.renderContent(boardEl);
      });
    } catch (e) {
      /* best effort */
    }
  }

  function exit() {
    if (!frames.length) return false;
    var st = MB.store.s();
    if (st.ui.editingId && MB.interact) MB.interact.commitEditing();

    syncUp();
    var f = frames[frames.length - 1];
    thumbFor(f.boardEl);
    frames.pop();

    MB.store.loadDocument({
      name: f.parentProject.name,
      path: f.parentProject.path,
      elements: f.parentElements,
      camera: f.parentCamera
    });
    MB.store.setSelection([f.boardEl.id]);

    /* le document racine a changé (data.doc de la planche) */
    MB.storage.markDirty();
    emitChange();
    return true;
  }

  /* Sortir jusqu'au niveau `level` (0 = racine). */
  function exitTo(level) {
    if (level < 0 || level > frames.length) return false;
    var n = frames.length - level;
    for (var i = 0; i < n; i++) {
      if (!exit()) break;
    }
    return true;
  }

  /* Ouverture d'un AUTRE document / nouvelle table : la pile est vidée
   * (après syncUp, pour ne rien perdre de l'arbre courant en mémoire). */
  function reset() {
    if (frames.length) {
      syncUp();
      frames = [];
      emitChange();
    }
  }

  function init() {
    /* rien à faire au boot : la pile démarre vide. Le module s'injecte
     * dans storage.serialize() et l'écran d'accueil par ses points
     * d'entrée explicites. */
  }

  MB.boards = {
    init: init,
    enter: enter,
    exit: exit,
    exitTo: exitTo,
    syncUp: syncUp,
    commitCurrentIntoParent: commitCurrentIntoParent,
    reset: reset,
    depth: depth,
    insideBoard: insideBoard,
    crumb: crumb,
    rootElements: rootElements,
    rootCamera: rootCamera,
    onChange: onChange
  };
})();

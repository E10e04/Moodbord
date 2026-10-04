/* =========================================================================
 * store.js — État global du moodboard : éléments, sélection, caméra,
 * outil actif, presse-papiers et UI. Source unique de vérité.
 *
 * Modèle d'élément (extensible) :
 *   { id, type, x, y, w, h, rotation, locked, hidden, parentId, data, _rev }
 *
 * L'ordre du tableau `elements` définit l'ordre de peinture entre frères.
 * Les conteneurs sont : section, column, group (via `parentId`).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  /* v1.12 — l'outil SECTION est retiré : la colonne et le groupe
   * restent les seuls conteneurs (les anciennes sections sont migrées
   * en colonnes au chargement — voir loadDocument). */
  var CONTAINERS = { column: true, group: true };

  var state = {
    project: { name: 'Sans titre', path: null },
    elements: [],
    selection: { ids: [] },
    camera: { x: 0, y: 0, zoom: 1 },
    tool: 'select',
    clipboard: null,
    ui: {
      libraryOpen: true,
      inspectorOpen: true,
      editingId: null,
      activeGroupId: null,
      cropId: null,
      snap: true,
      grid: true,
      saveState: 'saved'
    }
  };

  /* ----------------------------------------------------------- events */
  var listeners = {};

  function on(ev, fn) {
    (listeners[ev] = listeners[ev] || []).push(fn);
    return fn;
  }

  function off(ev, fn) {
    var arr = listeners[ev] || [];
    var i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }

  function emit(ev, payload) {
    var arr = listeners[ev];
    if (!arr) return;
    for (var i = 0; i < arr.length; i++) {
      try {
        arr[i](payload);
      } catch (e) {
        console.error('[MB:' + ev + ']', e);
      }
    }
  }

  /* --------------------------------------------------------- requêtes */

  function el(id) {
    if (!id) return null;
    for (var i = 0; i < state.elements.length; i++) {
      if (state.elements[i].id === id) return state.elements[i];
    }
    return null;
  }

  function els(ids) {
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var e = el(ids[i]);
      if (e) out.push(e);
    }
    return out;
  }

  function selected() {
    return els(state.selection.ids);
  }

  function childrenOf(id) {
    var out = [];
    for (var i = 0; i < state.elements.length; i++) {
      if (state.elements[i].parentId === id) out.push(state.elements[i]);
    }
    return out;
  }

  function descendantsOf(id) {
    var out = [];
    var queue = childrenOf(id);
    while (queue.length) {
      var c = queue.shift();
      out.push(c);
      var gc = childrenOf(c.id);
      for (var i = 0; i < gc.length; i++) queue.push(gc[i]);
    }
    return out;
  }

  function ancestorsOf(id) {
    var out = [];
    var cur = el(id);
    var guard = 0;
    while (cur && cur.parentId && guard++ < 200) {
      var p = el(cur.parentId);
      if (!p) break;
      out.push(p);
      cur = p;
    }
    return out;
  }

  function isDescendantOf(id, maybeAncestorId) {
    var chain = ancestorsOf(id);
    for (var i = 0; i < chain.length; i++) {
      if (chain[i].id === maybeAncestorId) return true;
    }
    return false;
  }

  /* Un clic dans un groupe sélectionne le groupe (unité), sauf si
     l'utilisateur est « entré » dans le groupe (activeGroupId). */
  function resolveSelectable(id) {
    var cur = el(id);
    if (!cur) return null;
    var result = cur;
    var guard = 0;
    while (cur && cur.parentId && guard++ < 200) {
      var p = el(cur.parentId);
      if (!p) break;
      if (p.type === 'group' && p.id !== state.ui.activeGroupId) {
        result = p;
      } else if (p.id === state.ui.activeGroupId) {
        break;
      }
      cur = p;
    }
    return result;
  }

  /* Étend une liste d'ids avec les descendants des conteneurs dont le type
     est dans expandTypes (dédupliqués).
     *
     * v1.8 — CORRECTIF DÉPLACEMENT DES GROUPES : l'ancien filtre « retirer
     * les ids couverts par un ancêtre présent dans le set » privait la
     * fermeture de sélection des ENFANTS d'un groupe sélectionné (ils sont,
     * par définition, des descendants d'un ancêtre présent dans le set) :
     * glisser un groupe ne déplaçait que l'élément groupe (invisible —
     * sa carte est dessinée par ses enfants), la suppression laissait des
     * orphelins, le copier-coller perdait le contenu. Les enfants d'un
     * conteneur sélectionné sont le PAYLOAD du geste, jamais une redondance :
     * le filtre est supprimé, seule la déduplication (une entrée par id)
     * subsiste. */
  function expandIds(ids, expandTypes) {
    var set = {};
    var order = [];
    for (var i = 0; i < ids.length; i++) {
      var e = el(ids[i]);
      if (!e) continue;
      if (!set[e.id]) {
        set[e.id] = true;
        order.push(e.id);
      }
      if (expandTypes[e.type]) {
        var desc = descendantsOf(e.id);
        for (var d = 0; d < desc.length; d++) {
          if (!set[desc[d].id]) {
            set[desc[d].id] = true;
            order.push(desc[d].id);
          }
        }
      }
    }
    return order;
  }

  /* Fermeture de la sélection pour drag / copie (les conteneurs
     entraînent leurs enfants). */
  function selectionClosure() {
    return expandIds(state.selection.ids, CONTAINERS);
  }

  /* Ensemble pour suppression : les groupes suppriment leurs enfants,
     les sections / colonnes ne le font pas. */
  function deletionSet() {
    var ids = expandIds(state.selection.ids, { group: true });
    // garde-fou : jamais supprimer un enfant dont le parent est une section sélectionnée
    return ids;
  }

  /* ---------------------------------------------------- géométrie */

  function cornersOf(e) {
    var cx = e.x + e.w / 2;
    var cy = e.y + e.h / 2;
    var rad = U.degToRad(e.rotation || 0);
    var pts = [
      { x: e.x, y: e.y },
      { x: e.x + e.w, y: e.y },
      { x: e.x + e.w, y: e.y + e.h },
      { x: e.x, y: e.y + e.h }
    ];
    for (var i = 0; i < pts.length; i++) {
      var v = { x: pts[i].x - cx, y: pts[i].y - cy };
      var r = U.rot(v.x, v.y, rad);
      pts[i] = { x: r.x + cx, y: r.y + cy };
    }
    return pts;
  }

  function bboxOf(e) {
    if (e.type === 'group') return bboxOfMany(childrenOf(e.id));
    var pts = cornersOf(e);
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    for (var i = 0; i < pts.length; i++) {
      minX = Math.min(minX, pts[i].x);
      minY = Math.min(minY, pts[i].y);
      maxX = Math.max(maxX, pts[i].x);
      maxY = Math.max(maxY, pts[i].y);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function bboxOfMany(list) {
    var rects = [];
    for (var i = 0; i < list.length; i++) rects.push(bboxOf(list[i]));
    return U.unionRects(rects);
  }

  function lineEndpoints(e) {
    var d = e.data || {};
    return {
      x1: d.x1,
      y1: d.y1,
      x2: d.x2,
      y2: d.y2
    };
  }

  function syncLineBox(e) {
    var d = e.data;
    var pad = 6;
    e.x = Math.min(d.x1, d.x2) - pad;
    e.y = Math.min(d.y1, d.y2) - pad;
    e.w = Math.abs(d.x2 - d.x1) + pad * 2;
    e.h = Math.abs(d.y2 - d.y1) + pad * 2;
  }

  /* Point d'ancrage d'un côté d'un élément (pour les lignes attachées). */
  function lineAnchor(target, side) {
    var x = target.x;
    var y = target.y;
    var w = target.w;
    var h = target.h;
    switch (side) {
      case 'left':
        return { x: x, y: y + h / 2 };
      case 'right':
        return { x: x + w, y: y + h / 2 };
      case 'top':
        return { x: x + w / 2, y: y };
      case 'bottom':
        return { x: x + w / 2, y: y + h };
      default:
        return { x: x + w / 2, y: y + h / 2 };
    }
  }

  /* Met à jour les extrémités des lignes attachées aux éléments déplacés. */
  function refreshAttachedLines(movedIds) {
    var byId = {};
    for (var i = 0; i < movedIds.length; i++) byId[movedIds[i]] = true;
    for (var j = 0; j < state.elements.length; j++) {
      var e = state.elements[j];
      if (e.type !== 'line' || !e.data) continue;
      var changed = false;
      var ends = [
        ['startAttach', 'x1', 'y1'],
        ['endAttach', 'x2', 'y2']
      ];
      for (var k = 0; k < ends.length; k++) {
        var att = e.data[ends[k][0]];
        if (att && byId[att.id]) {
          var target = el(att.id);
          if (!target) {
            e.data[ends[k][0]] = null;
          } else {
            var p = lineAnchor(target, att.side);
            e.data[ends[k][1]] = p.x;
            e.data[ends[k][2]] = p.y;
          }
          changed = true;
        } else if (att && !byId[att.id]) {
          // élément non déplacé mais attachement existant : rien à faire
        }
      }
      if (changed) syncLineBox(e);
    }
    return changed;
  }

  /* ---------------------------------------------------- mutations */

  function mutate(label, fn) {
    MB.hist.begin(label);
    var result = fn();
    MB.hist.commit();
    return result;
  }

  function nextRev(e) {
    e._rev = (e._rev || 1) + 1;
    return e._rev;
  }

  function addElements(list, opts) {
    if (!list || !list.length) return [];
    opts = opts || {};
    var run = function () {
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e._rev) e._rev = 1;
        state.elements.push(e);
      }
    };
    if (opts.transaction) {
      run();
    } else {
      mutate(opts.label || 'Créer', run);
    }
    emit('elements');
    return list;
  }

  function updateElement(id, patch, opts) {
    opts = opts || {};
    var e = el(id);
    if (!e) return;
    var contentDirty = false;
    var keys = Object.keys(patch);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === 'data') {
        var d = patch.data;
        var dk = Object.keys(d);
        for (var j = 0; j < dk.length; j++) {
          e.data[dk[j]] = d[dk[j]];
        }
        contentDirty = true;
      } else {
        e[k] = patch[k];
        if (['x', 'y', 'w', 'h', 'rotation', 'locked', 'hidden', 'parentId'].indexOf(k) >= 0) {
          if (k === 'locked' || k === 'hidden' || k === 'parentId') contentDirty = false;
        }
      }
    }
    if (contentDirty || opts.content) nextRev(e);
    if (e.type === 'line') syncLineBox(e);
    emit('element', { ids: [id] });
  }

  /* Translate un élément (les lignes déplacent aussi leurs extrémités). */
  function translateElement(e, dx, dy) {
    e.x += dx;
    e.y += dy;
    if (e.type === 'line' && e.data) {
      e.data.x1 += dx;
      e.data.y1 += dy;
      e.data.x2 += dx;
      e.data.y2 += dy;
      syncLineBox(e);
    }
  }

  /* Déplacement absolu depuis des positions d'origine (idempotent). */
  function applyDelta(origins, dx, dy) {
    var ids = Object.keys(origins);
    for (var i = 0; i < ids.length; i++) {
      var e = el(ids[i]);
      if (!e || e.locked) continue;
      var o = origins[ids[i]];
      e.x = o.x + dx;
      e.y = o.y + dy;
      if (e.type === 'line' && e.data && o.x1 !== undefined) {
        e.data.x1 = o.x1 + dx;
        e.data.y1 = o.y1 + dy;
        e.data.x2 = o.x2 + dx;
        e.data.y2 = o.y2 + dy;
        syncLineBox(e);
      }
    }
    refreshAttachedLines(ids);
    emit('element', { ids: ids });
    return ids;
  }

  function reorder(id, mode) {
    mutate('Ordre', function () {
      var e = el(id);
      if (!e) return;
      var sibs = state.elements.filter(function (s) {
        return s.parentId === e.parentId && s.id !== id;
      });
      // reconstruit l'ordre global des frères
      var globalSibOrder = state.elements.filter(function (s) {
        return s.parentId === e.parentId;
      });
      var myIndex = globalSibOrder.indexOf(e);
      var target;
      if (mode === 'front') target = globalSibOrder.length - 1;
      else if (mode === 'back') target = 0;
      else if (mode === 'forward') target = Math.min(myIndex + 1, globalSibOrder.length - 1);
      else target = Math.max(myIndex - 1, 0);
      if (target === myIndex) return;
      var before = globalSibOrder[target];
      // retire et réinsère à la position globale de `before`
      var gi = state.elements.indexOf(e);
      state.elements.splice(gi, 1);
      var bi = state.elements.indexOf(before);
      if (mode === 'back' || mode === 'backward') {
        state.elements.splice(bi + 1, 0, e);
      } else {
        state.elements.splice(bi, 0, e);
      }
      void sibs;
    });
    emit('elements');
  }

  function setParent(id, parentId) {
    var e = el(id);
    if (!e) return;
    e.parentId = parentId || null;
    emit('elements');
  }

  /* v1.10 — COLONNES = mini-canvas vertical : les cartes enfants
   * s'empilent de haut en bas, alignées à gauche avec une marge ;
   * v1.12 — TROIS corrections majeures :
   *   1. LA TAILLE DES ENFANTS SUIT LA COLONNE : toute carte enfant
   *      prend la LARGEUR INTÉRIEURE de la colonne (marge de chaque
   * côté) — à l'ajout, au drag, à la suppression, et quand la
   * colonne est redimensionnée, les cartes suivent (demande
   * utilisateur v1.12).
   *   2. LA HAUTEUR NE FAIT QUE CROÎTRE : l'ancienne formule
   *      ramenait la colonne à la taille EXACTE de son contenu — une
   *      colonne de 380 px s'effondrait à 220 en recevant une note, et
   *      le dépôt suivant visait « là où la colonne n'était plus » →
   *      l'empilement semblait ne pas marcher. Désormais la colonne
   *      garde la hauteur choisie et ne fait que grandir si la pile
   *      dépasse (le redimensionnement manuel reste maître).
   *   3. keepHeight : le layout peut s'exécuter SANS toucher à la
   *      hauteur (geste de redimensionnement en cours — il ne doit
   *      pas se battre avec la main de l'utilisateur).
   * L'ordre de la pile suit la position verticale du dépôt. */
  function layoutContainerChildren(parentId, opts) {
    var parent = el(parentId);
    if (!parent || parent.type !== 'column') return [];
    var kids = childrenOf(parentId);
    if (!kids.length) return [];
    var o = opts || {};
    kids.sort(function (a, b) {
      return a.y - b.y;
    });
    var d = parent.data || {};
    var headerH = (d.titleSize || 15) + 26;
    var pad = 12;
    var gap = 10;
    /* Largeur intérieure : chaque enfant correspond à la largeur de
     * la colonne (plancher 64 — une carte ne devient pas un trait). */
    var inner = Math.max(64, parent.w - pad * 2);
    var cur = parent.y + headerH + pad - 4;
    kids.forEach(function (k) {
      var b = bboxOf(k);
      translateElement(k, parent.x + pad - k.x, cur - k.y);
      /* v1.12 — la carte prend la largeur de la colonne (sa hauteur
       * reste la sienne). */
      k.w = Math.max(64, inner);
      cur += b.h + gap;
    });
    var needed = cur - gap + pad - parent.y;
    if (!o.keepHeight) {
      var minH = 220;
      /* CROISSANCE SEULE : jamais de rétrécissement automatique (le
       * bug v1.10/v1.11 : la colonne « disparaissait » sous le
       * curseur au moment de viser son bas). */
      if (needed > parent.h) parent.h = Math.ceil(needed);
      if (parent.h < minH) parent.h = minH;
    }
    var ids = kids.map(function (k) {
      return k.id;
    });
    /* v1.12 — les VUES suivent TOUJOURS le layout : la fonction
     * émet elle-même les ids déplacés/élargis (bug : une carte créée
     * DANS une colonne restait affichée à sa position d'avant-pile —
     * le modèle était juste, l'écran non — jusqu'au prochain
     * événement « elements »). Les appelants qui émettent déjà ne
     * paient qu'un second passage idempotent. */
    emit('element', { ids: ids });
    return ids;
  }

  /* Re-compacte les conteneurs (colonnes / sections) concernés par les
   * ids donnés — après un drag, un redimensionnement ou une
   * suppression d'enfant. */
  function relayoutContainersOf(ids) {
    var seen = {};
    for (var i = 0; i < ids.length; i++) {
      var p = el(ids[i]);
      var pid = p && p.parentId;
      if (pid && !seen[pid]) {
        seen[pid] = true;
        layoutContainerChildren(pid);
      }
    }
  }

  /* Conteneur à pile verticale SOUS un point : la colonne la plus
   * haute dans l'ordre de peinture dont la zone couvre le dépôt.
   * v1.12 — détection élargie : le centre de la carte lâchée OU une
   * intersection franche (la moitié de la largeur de la carte couvre
   * la colonne) compte — un dépôt « à cheval » sur le bord bas d'une
   * colonne joint la pile au lieu de tomber à côté (bug rapporté :
   * « la superposition ne marche pas »). */
  function joinsContainer(box, c) {
    var cx = box.x + box.w / 2;
    var cy = box.y + box.h / 2;
    var inside =
      cx >= c.x && cx <= c.x + c.w &&
      cy >= c.y && cy <= c.y + c.h;
    if (inside) return true;
    /* intersection : chevauchement horizontal ≥ 50 % de la largeur de
     * la carte ET chevauchement vertical réel. */
    var ox = Math.min(box.x + box.w, c.x + c.w) - Math.max(box.x, c.x);
    var oy = Math.min(box.y + box.h, c.y + c.h) - Math.max(box.y, c.y);
    return ox > 0 && oy > 0 && ox >= box.w / 2;
  }

  function topmostSectionAt(point, excludeIds, box) {
    var excl = {};
    for (var i = 0; i < excludeIds.length; i++) excl[excludeIds[i]] = true;
    for (var j = state.elements.length - 1; j >= 0; j--) {
      var e = state.elements[j];
      if (e.type === 'column' && !e.hidden && !excl[e.id]) {
        if (joinsContainer(box || { x: point.x, y: point.y, w: 0, h: 0 }, e)) {
          return e;
        }
      }
    }
    return null;
  }

  /* ---------------------------------------------------- sélection */

  function setSelection(ids) {
    state.selection.ids = ids.slice(0, 500);
    if (state.ui.editingId && ids.indexOf(state.ui.editingId) < 0) {
      // l'édition se poursuit uniquement si l'élément reste sélectionné
    }
    emit('selection');
  }

  function select(ids, mode) {
    if (mode === 'toggle') {
      var cur = state.selection.ids.slice();
      for (var i = 0; i < ids.length; i++) {
        var idx = cur.indexOf(ids[i]);
        if (idx >= 0) cur.splice(idx, 1);
        else cur.push(ids[i]);
      }
      setSelection(cur);
    } else if (mode === 'add') {
      var cur2 = state.selection.ids.slice();
      for (var j = 0; j < ids.length; j++) {
        if (cur2.indexOf(ids[j]) < 0) cur2.push(ids[j]);
      }
      setSelection(cur2);
    } else {
      setSelection(ids);
    }
  }

  function clearSelection() {
    setSelection([]);
  }

  function selectAll() {
    var ids = [];
    for (var i = 0; i < state.elements.length; i++) {
      var e = state.elements[i];
      if (e.parentId) continue;
      if (e.hidden || e.locked) continue;
      ids.push(e.id);
    }
    setSelection(ids);
  }

  /* ---------------------------------------------------- presse-papiers */

  function serializeSubtree(ids) {
    var closure = expandIds(ids, CONTAINERS);
    var out = [];
    for (var i = 0; i < closure.length; i++) {
      var e = el(closure[i]);
      if (e) out.push(U.deepClone(e));
    }
    return out;
  }

  function copySelection() {
    var sel = state.selection.ids;
    if (!sel.length) return;
    state.clipboard = serializeSubtree(sel);
    emit('selection');
  }

  function cloneWithNewIds(list, idMap) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var c = U.deepClone(list[i]);
      var oldId = c.id;
      var newId = U.uid();
      idMap[oldId] = newId;
      c.id = newId;
      c._rev = 1;
      out.push(c);
    }
    for (var j = 0; j < out.length; j++) {
      var p = out[j].parentId;
      if (p && idMap[p]) out[j].parentId = idMap[p];
    }
    return out;
  }

  function duplicateSelection(offset, opts) {
    var off = offset === undefined ? 24 : offset;
    var sel = state.selection.ids;
    if (!sel.length) return [];
    var list = serializeSubtree(sel);
    var idMap = {};
    var copies = cloneWithNewIds(list, idMap);
    for (var i = 0; i < copies.length; i++) {
      copies[i].x += off;
      copies[i].y += off;
      if (copies[i].type === 'line') {
        copies[i].data.x1 += off;
        copies[i].data.y1 += off;
        copies[i].data.x2 += off;
        copies[i].data.y2 += off;
        if (copies[i].data.startAttach) copies[i].data.startAttach = null;
        if (copies[i].data.endAttach) copies[i].data.endAttach = null;
        syncLineBox(copies[i]);
      }
    }
    addElements(copies, Object.assign({ label: 'Dupliquer' }, opts || {}));
    setSelection(copies.map(function (c) {
      return c.id;
    }));
    return copies;
  }

  function pasteClipboard(atPoint) {
    if (!state.clipboard || !state.clipboard.length) return;
    var list = state.clipboard;
    var idMap = {};
    var copies = cloneWithNewIds(list, idMap);
    var minX = Infinity;
    var minY = Infinity;
    for (var i = 0; i < copies.length; i++) {
      minX = Math.min(minX, copies[i].x);
      minY = Math.min(minY, copies[i].y);
    }
    var dx = 24;
    var dy = 24;
    if (atPoint) {
      dx = atPoint.x - minX;
      dy = atPoint.y - minY;
    }
    for (var j = 0; j < copies.length; j++) {
      var c = copies[j];
      c.x += dx;
      c.y += dy;
      if (c.type === 'line') {
        c.data.x1 += dx;
        c.data.y1 += dy;
        c.data.x2 += dx;
        c.data.y2 += dy;
        syncLineBox(c);
      }
    }
    addElements(copies, { label: 'Coller' });
    setSelection(copies.map(function (x) {
      return x.id;
    }));
  }

  function cutSelection() {
    if (!state.selection.ids.length) return;
    copySelection();
    deleteSelection();
  }

  function deleteSelection() {
    var sel = state.selection.ids;
    if (!sel.length) return;
    /* v1.10 — mémoriser les conteneurs verticaux touchés : la pile
     * doit se re-compacter après la suppression. */
    var affected = {};
    deletionSet().forEach(function (id) {
      var e = el(id);
      if (e && e.parentId) affected[e.parentId] = true;
    });
    mutate('Supprimer', function () {
      var ids = deletionSet();
      var gone = {};
      for (var i = 0; i < ids.length; i++) gone[ids[i]] = true;
      // détache les lignes pointant vers des éléments supprimés
      for (var j = 0; j < state.elements.length; j++) {
        var e = state.elements[j];
        if (e.type === 'line' && e.data) {
          if (e.data.startAttach && gone[e.data.startAttach.id]) e.data.startAttach = null;
          if (e.data.endAttach && gone[e.data.endAttach.id]) e.data.endAttach = null;
        }
      }
      state.elements = state.elements.filter(function (e) {
        return !gone[e.id];
      });
      Object.keys(affected).forEach(function (pid) {
        layoutContainerChildren(pid);
      });
    });
    clearSelection();
    emit('elements');
  }

  /* ---------------------------------------------------- groupes */

  function groupSelection() {
    var roots = expandIds(state.selection.ids, {});
    if (roots.length < 2) return null;
    var list = els(roots);
    var bbox = bboxOfMany(list);
    var group = MB.factory.create('group', { x: bbox.x, y: bbox.y }, {
      w: bbox.w,
      h: bbox.h,
      parentId: list[0].parentId
    });
    mutate('Grouper', function () {
      state.elements.push(group);
      for (var i = 0; i < list.length; i++) {
        list[i].parentId = group.id;
      }
    });
    emit('elements');
    setSelection([group.id]);
    return group;
  }

  function ungroupSelection() {
    var groups = selected().filter(function (e) {
      return e.type === 'group';
    });
    if (!groups.length) return;
    var freed = [];
    mutate('Dissocier', function () {
      for (var g = 0; g < groups.length; g++) {
        var grp = groups[g];
        var kids = childrenOf(grp.id);
        for (var k = 0; k < kids.length; k++) {
          kids[k].parentId = grp.parentId;
          freed.push(kids[k].id);
        }
      }
      var goneIds = {};
      for (var i = 0; i < groups.length; i++) goneIds[groups[i].id] = true;
      state.elements = state.elements.filter(function (e) {
        return !goneIds[e.id];
      });
    });
    if (state.ui.activeGroupId) {
      var still = el(state.ui.activeGroupId);
      if (!still) state.ui.activeGroupId = null;
    }
    emit('elements');
    setSelection(freed);
  }

  /* ---------------------------------------------------- alignement */

  function alignSelection(mode) {
    var roots = expandIds(state.selection.ids, {});
    var list = els(roots);
    if (list.length < 2) return;
    mutate('Aligner', function () {
      var bounds = bboxOfMany(list);
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        var bb = bboxOf(e);
        var dx = 0;
        var dy = 0;
        if (mode === 'left') dx = bounds.x - bb.x;
        if (mode === 'right') dx = bounds.x + bounds.w - (bb.x + bb.w);
        if (mode === 'centerx') dx = bounds.x + bounds.w / 2 - (bb.x + bb.w / 2);
        if (mode === 'top') dy = bounds.y - bb.y;
        if (mode === 'bottom') dy = bounds.y + bounds.h - (bb.y + bb.h);
        if (mode === 'centery') dy = bounds.y + bounds.h / 2 - (bb.y + bb.h / 2);
        translateElement(e, dx, dy);
        refreshAttachedLines([e.id]);
      }
    });
    emit('element', { ids: roots });
    emit('selection');
  }

  function distributeSelection(axis) {
    var roots = expandIds(state.selection.ids, {});
    var list = els(roots);
    if (list.length < 3) return;
    mutate('Répartir', function () {
      list.sort(function (a, b) {
        return axis === 'h' ? bboxOf(a).x - bboxOf(b).x : bboxOf(a).y - bboxOf(b).y;
      });
      var bboxes = list.map(bboxOf);
      var first = bboxes[0];
      var last = bboxes[bboxes.length - 1];
      var start = axis === 'h' ? first.x + first.w : first.y + first.h;
      var end = axis === 'h' ? last.x : last.y;
      var totalSpace = end - start;
      var sumSizes = 0;
      for (var i = 1; i < bboxes.length - 1; i++) {
        sumSizes += axis === 'h' ? bboxes[i].w : bboxes[i].h;
      }
      var gap = (totalSpace - sumSizes) / (list.length - 1);
      if (gap < 0) gap = 0;
      var cursor = start + gap;
      for (var j = 1; j < list.length - 1; j++) {
        var e = list[j];
        var bb = bboxes[j];
        if (axis === 'h') {
          translateElement(e, cursor - bb.x, 0);
          cursor += bb.w + gap;
        } else {
          translateElement(e, 0, cursor - bb.y);
          cursor += bb.h + gap;
        }
        refreshAttachedLines([e.id]);
      }
    });
    emit('element', { ids: roots });
    emit('selection');
  }

  /* ---------------------------------------------------- setteurs */

  function setCamera(patch) {
    var keys = Object.keys(patch);
    for (var i = 0; i < keys.length; i++) state.camera[keys[i]] = patch[keys[i]];
    emit('camera');
  }

  function setTool(t) {
    if (state.tool === t) return;
    state.tool = t;
    emit('tool', t);
  }

  function setUI(patch) {
    var keys = Object.keys(patch);
    for (var i = 0; i < keys.length; i++) state.ui[keys[i]] = patch[keys[i]];
    emit('ui', patch);
  }

  function setProject(patch) {
    var keys = Object.keys(patch);
    for (var i = 0; i < keys.length; i++) state.project[keys[i]] = patch[keys[i]];
    emit('project', patch);
  }

  /* ---------------------------------------------------- chargement */

  function replaceElements(arr) {
    state.elements = arr || [];
    if (state.ui.editingId && !el(state.ui.editingId)) state.ui.editingId = null;
    if (state.ui.cropId && !el(state.ui.cropId)) state.ui.cropId = null;
    if (state.ui.activeGroupId && !el(state.ui.activeGroupId)) state.ui.activeGroupId = null;
    var keep = [];
    for (var i = 0; i < state.selection.ids.length; i++) {
      if (el(state.selection.ids[i])) keep.push(state.selection.ids[i]);
    }
    state.selection.ids = keep;
    emit('elements');
    emit('selection');
  }

  function loadDocument(doc) {
    state.project = { name: doc.name || 'Sans titre', path: doc.path || null };
    state.elements = doc.elements || [];
    for (var i = 0; i < state.elements.length; i++) {
      if (!state.elements[i]._rev) state.elements[i]._rev = 1;
      /* v1.12 — MIGRATION : l'outil Section est retiré ; les sections
       * des anciens projets deviennent des COLONNES (le titre et les
       * couleurs passent tels quels, showTitle tombe — le mini-canvas
       * vertical affiche toujours son en-tête). Rien n'est perdu. */
      var eL = state.elements[i];
      if (eL.type === 'section') {
        eL.type = 'column';
        if (eL.data) delete eL.data.showTitle;
      }
      /* v1.12 — MIGRATION palette : la carte est passée au design
       * « picker » (264 de large, hauteur réservée pour la liste
       * ouverte, picked par défaut = toutes les couleurs). */
      if (eL.type === 'palette') {
        var pc = MB.ui && MB.ui.paletteCard;
        if (pc) {
          var nCol = (eL.data && Array.isArray(eL.data.colors)) ? eL.data.colors.length : 0;
          if (eL.w < 220) eL.w = 264;
          var hWant = pc.heightOf(Math.max(1, nCol));
          if (eL.h < hWant - 4) eL.h = hWant;
        }
        if (eL.data && !Array.isArray(eL.data.picked) && Array.isArray(eL.data.colors)) {
          eL.data.picked = eL.data.colors.map(function (c) { return c.hex; });
        }
      }
    }
    state.selection.ids = [];
    state.clipboard = null;
    state.ui.editingId = null;
    state.ui.cropId = null;
    state.ui.activeGroupId = null;
    if (doc.camera) {
      state.camera = {
        x: doc.camera.x || 0,
        y: doc.camera.y || 0,
        zoom: doc.camera.zoom || 1
      };
    }
    if (doc.settings) {
      state.ui.snap = doc.settings.snap !== false;
      state.ui.grid = doc.settings.grid !== false;
    }
    MB.hist.reset();
    emit('elements');
    emit('selection');
    emit('camera');
    emit('project', state.project);
    emit('ui', state.ui);
  }

  /* ---------------------------------------------------- exports */

  MB.store = {
    on: on,
    off: off,
    emit: emit,
    s: function () {
      return state;
    },
    el: el,
    els: els,
    selected: selected,
    selectedIds: function () {
      return state.selection.ids.slice();
    },
    childrenOf: childrenOf,
    descendantsOf: descendantsOf,
    ancestorsOf: ancestorsOf,
    isDescendantOf: isDescendantOf,
    resolveSelectable: resolveSelectable,
    selectionClosure: selectionClosure,
    expandIds: expandIds,
    CONTAINERS: CONTAINERS,

    bboxOf: bboxOf,
    bboxOfMany: bboxOfMany,
    lineEndpoints: lineEndpoints,
    syncLineBox: syncLineBox,
    lineAnchor: lineAnchor,
    topmostSectionAt: topmostSectionAt,
    /* v1.10 — mini-canvas vertical (colonnes / sections). */
    layoutContainerChildren: layoutContainerChildren,
    relayoutContainersOf: relayoutContainersOf,

    mutate: mutate,
    addElements: addElements,
    updateElement: updateElement,
    applyDelta: applyDelta,
    reorder: reorder,
    setParent: setParent,

    select: select,
    setSelection: setSelection,
    clearSelection: clearSelection,
    selectAll: selectAll,

    copySelection: copySelection,
    cutSelection: cutSelection,
    pasteClipboard: pasteClipboard,
    duplicateSelection: duplicateSelection,
    deleteSelection: deleteSelection,

    groupSelection: groupSelection,
    ungroupSelection: ungroupSelection,
    alignSelection: alignSelection,
    distributeSelection: distributeSelection,

    setCamera: setCamera,
    setTool: setTool,
    setUI: setUI,
    setProject: setProject,
    replaceElements: replaceElements,
    loadDocument: loadDocument,
    translateElement: translateElement,
    nextRev: nextRev
  };
})();

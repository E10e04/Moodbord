/* =========================================================================
 * interactions.js — Machine à états gestuelle du canvas.
 *
 * Modes : idle | pan | marquee | drag | resize | rotate | line-end |
 *         line-create | sketch | rect-create | create-click | crop
 *
 * Principes :
 *  - pointerdown → hit test (DOM) → capture logique → pointerup = commit
 *    (UNE entrée d'historique par geste, jamais par pixel) ;
 *  - coordonnées canvas partout (Camera.toCanvas) ;
 *  - Alt+drag = dupliquer (Alt+drag sur une section = déplacer le
 *    conteneur seul, sans ses enfants) ;
 *  - Cmd/Ctrl pendant un drag = désactiver l'aimantage temporairement.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  var Store, Camera, Board;

  var gesture = null;
  var spaceDown = false;
  var badgeEl = null;
  var editingItem = null;
  var editingCell = null;
  var editingOriginal = null;

  var CLICK_CREATE = {
    text: 1, note: 1, color: 1, palette: 1, typography: 1,
    link: 1, checklist: 1, comment: 1, table: 1, image: 1, import: 1,
    board: 1
  };
  var RECT_CREATE = { section: 1, column: 1, shape: 1 };

  var TYPE_NAMES = {
    text: 'texte', note: 'note', comment: 'commentaire', image: 'image',
    color: 'couleur', palette: 'palette', typography: 'typographie',
    link: 'lien', file: 'fichier', line: 'ligne', shape: 'forme',
    section: 'section', column: 'colonne', table: 'tableau',
    checklist: 'checklist', sketch: 'croquis', board: 'planche',
    group: 'groupe'
  };

  function wrapEl() {
    return Board.wrapEl();
  }

  function canvasPoint(e) {
    return Camera.toCanvas(e.clientX, e.clientY);
  }

  function typeName(t) {
    return TYPE_NAMES[t] || t;
  }

  /* ======================================================== création */

  function createAt(type, point, extra, opts) {
    var o = opts || {};
    var el = MB.factory.create(type, point, extra);
    Store.addElements([el], { label: 'Créer ' + typeName(type) });
    Store.setSelection([el.id]);
    if (!o.keepTool) Store.setTool('select');
    if (type === 'text' || type === 'note' || type === 'comment') {
      startEditing(el, 'text');
    }
    /* v1.6.1 — planche liée : la nouvelle carte RESTE dans le moodboard
     * actif (pas d’entrée automatique) ; le titre passe immédiatement en
     * édition pour nommer la planche sur place. L’ouverture se fait
     * uniquement par la flèche de la carte (ou l’inspecteur / le menu
     * contextuel). */
    if (type === 'board') {
      startEditing(el, 'title');
    }
    return el;
  }

  function openImportPicker(atPoint) {
    var input = document.getElementById('file-import');
    input.value = '';
    input.onchange = function () {
      if (input.files && input.files.length) {
        importFiles(input.files, atPoint);
      }
    };
    input.click();
  }

  function readAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      if (MB.storage.hasOsPaths() && file.path) {
        var ext = (file.name.split('.').pop() || '').toLowerCase();
        var mime = file.type || 'image/' + (ext === 'jpg' ? 'jpeg' : ext);
        var res = MB.storage.readFileAny(file.path, 'Base64');
        if (!res || res.err !== 0) return reject(new Error('Lecture impossible (' + (res && res.err) + ')'));
        resolve('data:' + mime + ';base64,' + res.data);
      } else {
        var reader = new FileReader();
        reader.onload = function () {
          resolve(String(reader.result));
        };
        reader.onerror = function () {
          reject(new Error('Lecture impossible'));
        };
        reader.readAsDataURL(file);
      }
    });
  }

  function preloadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        resolve({ src: src, w: img.naturalWidth || 1024, h: img.naturalHeight || 1024 });
      };
      img.onerror = function () {
        reject(new Error('Image illisible'));
      };
      img.src = src;
    });
  }

  /* Import de fichiers (drop multi-fichiers avec cascade, §24/§23). */
  function importFiles(fileList, atPoint) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var point = atPoint || screenCenterCanvas();
    var created = [];
    var failures = 0;
    MB.hist.begin('Importer');

    var finish = function () {
      if (created.length) {
        MB.hist.commit();
        Store.setSelection(created.map(function (c) {
          return c.id;
        }));
        MB.ui.toast(
          created.length === 1
            ? '1 élément importé'
            : created.length + ' éléments importés',
          'success'
        );
      } else if (failures) {
        MB.hist.cancel();
        MB.ui.toast('Aucun fichier n’a pu être importé.', 'error');
      } else {
        MB.hist.cancel();
      }
    };

    var pending = files.length;
    files.forEach(function (f, i) {
      var isImg = /^image\//.test(f.type) ||
        /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f.name || '');
      readAsDataURL(f)
        .then(function (dataUrl) {
          if (isImg) {
            return preloadImage(dataUrl).then(function (info) {
              var scale = Math.min(1, 360 / Math.max(info.w, info.h));
              var el = MB.factory.create('image', point, {
                src: dataUrl,
                w: Math.max(48, Math.round(info.w * scale)),
                h: Math.max(48, Math.round(info.h * scale))
              });
              el.x = el.x + i * 26;
              el.y = el.y + i * 26;
              el.data.naturalW = info.w;
              el.data.naturalH = info.h;
              el._sized = true;
              Store.addElements([el], { transaction: true });
              created.push(el);
            });
          }
          var el2 = MB.factory.create('file', point, {
            name: f.name || 'fichier',
            kind: (f.name || '').split('.').pop() || 'fichier',
            size: f.size || 0
          });
          el2.x = el2.x + i * 26;
          el2.y = el2.y + i * 26;
          Store.addElements([el2], { transaction: true });
          created.push(el2);
          return null;
        })
        .catch(function (err) {
          failures++;
          console.warn('Import échoué :', f.name, err);
        })
        .then(function () {
          pending--;
          if (pending === 0) finish();
        });
    });
  }

  function screenCenterCanvas() {
    var vp = Camera.viewport();
    var c = MB.store.s().camera;
    return { x: (vp.w / 2 - c.x) / c.zoom, y: (vp.h / 2 - c.y) / c.zoom };
  }

  /* ======================================================== édition */

  function editableNode(el, field) {
    var view = Board.viewOf(el.id);
    if (!view) return null;
    return view.node.querySelector('[data-field="' + field + '"]');
  }

  /* Échap dans un champ d'édition = valider et sortir (§28).
     Entrée valide les cellules et les tâches ; le texte multiligne garde Entrée.

     v1.6 — PRESSE-PAPIERS EXPLICITE : selon l'environnement (panneau CEP
     dans Illustrator, application sans menu d'édition natif), ⌘A/⌘C/⌘X
     peuvent être avalés par l'hôte AVANT d'atteindre le champ. On les
     traite explicitement (preventDefault + opération manuelle via
     MB.clip) — le comportement devient identique partout.
     Les flèches (navigation paragraphe) et le collage restent natifs. */
  function attachEditingKeys(node, multiline) {
    node.addEventListener('keydown', function (e) {
      var mod = e.metaKey || e.ctrlKey;
      var k = e.key ? e.key.toLowerCase() : '';
      if (mod && (k === 'a' || k === 'c' || k === 'x')) {
        e.preventDefault();
        e.stopPropagation();
        if (k === 'a') MB.clip.selectAllNode(node);
        else if (k === 'c') MB.clip.copySelection();
        else MB.clip.cutSelection(node);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        commitEditing();
      } else if (e.key === 'Enter' && !multiline && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        commitEditing();
      }
      e.stopPropagation(); // les raccourcis globaux ne s'appliquent pas pendant l'édition
    });
  }

  /* v1.6 — hauteur vivante pendant l'édition : le texte multi-paragraphes
   * reste visible (la boîte grandit à mesure qu'on écrit, comme à la
   * sortie). Mesure sur l'événement input + une passe au démarrage. */
  function liveAutoHeight(el) {
    var id = el.id;
    return function () {
      var live = Store.el(id);
      var view = Board.viewOf(id);
      if (!live || !view) return;
      var body = view.node.firstElementChild;
      if (!body || !body.isConnected) return;
      var needed = Math.ceil(body.scrollHeight);
      if (needed > 0 && Math.abs(needed - live.h) > 2) {
        live.h = needed;
        view.node.style.height = live.h + 'px';
        Board.refreshOverlay();
      }
    };
  }

  function startEditing(el, field) {
    if (!el || el.locked) return;
    if (Store.s().ui.editingId) commitEditing();
    var node = editableNode(el, field);
    if (!node) return;
    Store.setUI({ editingId: el.id });
    node.setAttribute('contenteditable', 'plaintext-only');
    node.classList.add('is-editing');
    editingOriginal = field === 'name' ? el.data.name : el.data[field];
    MB.hist.begin('Modifier ' + typeName(el.type));
    node.focus();
    attachEditingKeys(node, true);
    /* v1.6 — hauteur vivante : le contenu existant qui déborde est
     * immédiatement ré-emboîté, puis la boîte suit la frappe. */
    if (field === 'text' && (el.type === 'text' || el.type === 'note' || el.type === 'comment')) {
      var grow = liveAutoHeight(el);
      node.addEventListener('input', grow);
      requestAnimationFrame(grow);
    }
    try {
      var rng = document.createRange();
      rng.selectNodeContents(node);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(rng);
    } catch (err) {
      /* focus au caret */
    }
  }

  function commitEditing() {
    var st = Store.s();
    if (editingItem) return commitItemEditing();
    if (editingCell) return commitCellEditing();
    var id = st.ui.editingId;
    if (!id) return;
    var el = Store.el(id);
    var view = Board.viewOf(id);
    var node = view ? view.node.querySelector('.is-editing') : null;
    if (el && node) {
      var field = node.getAttribute('data-field');
      var text = node.innerText.replace(/\n+$/, '');
      if (field === 'text') el.data.text = text;
      else if (field === 'title') el.data.title = text;
      else if (field === 'name') el.data.name = text;
      var now = field === 'name' ? el.data.name : el.data[field];
      if (now !== editingOriginal) {
        Store.nextRev(el);
        MB.storage.markDirty();
      } else {
        MB.hist.cancel();
      }
    }
    Store.setUI({ editingId: null });
    editingOriginal = null;
    if (view && el) view.renderContent(el);
    if (el) Board.updateViews([el.id]);
  }

  /* Élément de checklist */
  function startEditingItem(el, itemId) {
    if (el.locked) return;
    if (Store.s().ui.editingId) commitEditing();
    var view = Board.viewOf(el.id);
    if (!view) return;
    var node = view.node.querySelector('[data-field="item"][data-item="' + itemId + '"]');
    if (!node) return;
    Store.setUI({ editingId: el.id });
    node.setAttribute('contenteditable', 'plaintext-only');
    node.classList.add('is-editing');
    var item = null;
    el.data.items.forEach(function (it) {
      if (it.id === itemId) item = it;
    });
    editingItem = { elId: el.id, itemId: itemId };
    editingOriginal = item ? item.text : '';
    MB.hist.begin('Modifier la tâche');
    node.focus();
    attachEditingKeys(node, false);
    try {
      var rng = document.createRange();
      rng.selectNodeContents(node);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(rng);
    } catch (err) {
      /* noop */
    }
  }

  function commitItemEditing() {
    var ref = editingItem;
    if (!ref) return;
    editingItem = null;
    var el = Store.el(ref.elId);
    var view = Board.viewOf(ref.elId);
    var node = view ? view.node.querySelector('[data-field="item"][data-item="' + ref.itemId + '"]') : null;
    if (el && node) {
      var text = node.innerText.replace(/\n+$/, '');
      var changed = false;
      el.data.items = el.data.items.filter(function (it) {
        if (it.id === ref.itemId) {
          if (it.text !== text) changed = true;
          it.text = text;
          if (!text.trim() && el.data.items.length > 1) return false; // ligne vide → supprimée
        }
        return true;
      });
      if (changed) {
        Store.nextRev(el);
        MB.storage.markDirty();
      } else {
        MB.hist.cancel();
      }
    }
    Store.setUI({ editingId: null });
    if (view && el) view.renderContent(el);
    if (el) Board.updateViews([el.id]);
    editingOriginal = null;
  }

  /* Cellule de tableau */
  function startCellEdit(el, r, c) {
    if (el.locked) return;
    if (Store.s().ui.editingId) commitEditing();
    var view = Board.viewOf(el.id);
    if (!view) return;
    var node = view.node.querySelector('[data-cell="' + r + '-' + c + '"]');
    if (!node) return;
    Store.setUI({ editingId: el.id });
    node.setAttribute('contenteditable', 'plaintext-only');
    node.classList.add('is-editing');
    editingCell = { elId: el.id, r: r, c: c };
    editingOriginal = (el.data.cells[r] && el.data.cells[r][c]) || '';
    MB.hist.begin('Modifier la cellule');
    node.focus();
    attachEditingKeys(node, false);
    try {
      var rng = document.createRange();
      rng.selectNodeContents(node);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(rng);
    } catch (err) {
      /* noop */
    }
  }

  function commitCellEditing() {
    var ref = editingCell;
    if (!ref) return;
    editingCell = null;
    var el = Store.el(ref.elId);
    var view = Board.viewOf(ref.elId);
    var node = view ? view.node.querySelector('[data-cell="' + ref.r + '-' + ref.c + '"]') : null;
    if (el && node) {
      var text = node.innerText.replace(/\n+$/, '');
      if (!el.data.cells[ref.r]) el.data.cells[ref.r] = [];
      if (el.data.cells[ref.r][ref.c] !== text) {
        el.data.cells[ref.r][ref.c] = text;
        Store.nextRev(el);
        MB.storage.markDirty();
      } else {
        MB.hist.cancel();
      }
    }
    Store.setUI({ editingId: null });
    if (view && el) view.renderContent(el);
    if (el) Board.updateViews([el.id]);
    editingOriginal = null;
  }

  /* ======================================================== recadrage */

  function enterCrop(el) {
    if (!el || el.type !== 'image' || el.locked) return;
    Store.setUI({ cropId: el.id });
    MB.hist.begin('Recadrer');
    Board.renderContent(el.id);
  }

  function exitCrop(apply) {
    var st = Store.s();
    var el = Store.el(st.ui.cropId);
    if (apply) {
      MB.hist.commit();
    } else {
      MB.hist.rollback();
    }
    Store.setUI({ cropId: null });
    if (el) {
      var fresh = Store.el(el.id);
      if (fresh) Board.renderContent(fresh.id);
    }
    Board.refreshOverlay();
  }

  /* ======================================================== badge */

  function showBadge(x, y, text) {
    if (!badgeEl) {
      badgeEl = U.el('div', 'gesture-badge');
      wrapEl().appendChild(badgeEl);
    }
    badgeEl.textContent = text;
    badgeEl.style.left = x + 'px';
    badgeEl.style.top = y + 'px';
  }

  function hideBadge() {
    if (badgeEl && badgeEl.parentNode) {
      badgeEl.parentNode.removeChild(badgeEl);
      badgeEl = null;
    }
  }

  /* ======================================================== gestes */

  function startPan(e) {
    gesture = { mode: 'pan', last: { x: e.clientX, y: e.clientY } };
    wrapEl().classList.add('is-panning');
    if (MB.diaglog) MB.diaglog.trace('geste pan démarré');
  }

  function startMarquee(e, additive) {
    var r = wrapEl().getBoundingClientRect();
    gesture = {
      mode: 'marquee',
      start: { x: e.clientX - r.left, y: e.clientY - r.top },
      additive: !!additive,
      base: additive ? Store.selectedIds() : []
    };
  }

  function startDrag(e) {
    var closureIds = Store.selectionClosure();
    var movable = [];
    closureIds.forEach(function (id) {
      var el = Store.el(id);
      if (el && !el.locked) movable.push(id);
    });
    if (!movable.length) return;

    var st = Store.s();
    var selEls = Store.selected();

    // Alt+drag sur une section/colonne : déplacer le conteneur SEUL (§39)
    var containerOnly = false;
    if (e.altKey && selEls.length === 1 && (selEls[0].type === 'section' || selEls[0].type === 'column')) {
      containerOnly = true;
      closureIds = [selEls[0].id];
    }

    var origins = {};
    closureIds.forEach(function (id) {
      var el = Store.el(id);
      var o = { x: el.x, y: el.y };
      if (el.type === 'line' && el.data) {
        // les lignes se déplacent par leurs extrémités
        o.x1 = el.data.x1;
        o.y1 = el.data.y1;
        o.x2 = el.data.x2;
        o.y2 = el.data.y2;
      }
      origins[id] = o;
    });

    gesture = {
      mode: 'drag',
      pointerStart: canvasPoint(e),
      screenStart: { x: e.clientX, y: e.clientY },
      origins: origins,
      movedIds: closureIds.slice(),
      moved: false,
      begun: false,
      containerOnly: containerOnly,
      alt: !!e.altKey && !containerOnly,
      prevSelection: Store.selectedIds(),
      anchorBBox: Store.bboxOfMany(Store.els(closureIds))
    };
    if (MB.diaglog) {
      MB.diaglog.trace('geste drag démarré (' + closureIds.length + ' objet' + (closureIds.length > 1 ? 's' : '') + ')');
    }

    if (gesture.alt) {
      // duplication immédiate, l'undo la retire si aucun déplacement
      MB.hist.begin('Dupliquer');
      var copies = Store.duplicateSelection(0, { transaction: true });
      if (copies && copies.length) {
        var newOrigins = {};
        copies.forEach(function (c) {
          newOrigins[c.id] = { x: c.x, y: c.y };
        });
        gesture.origins = newOrigins;
        gesture.movedIds = copies.map(function (c) {
          return c.id;
        });
        gesture.anchorBBox = Store.bboxOfMany(copies);
        gesture.begun = true;
      } else {
        MB.hist.cancel();
        gesture = null;
      }
    }
  }

  function handleDir(h) {
    return {
      hx: h.indexOf('e') >= 0 ? 1 : h.indexOf('w') >= 0 ? -1 : 0,
      hy: h.indexOf('s') >= 0 ? 1 : h.indexOf('n') >= 0 ? -1 : 0
    };
  }

  function anchorWorldOf(el, h) {
    var dir = handleDir(h);
    var cx = el.x + el.w / 2;
    var cy = el.y + el.h / 2;
    var local = { x: (-dir.hx * el.w) / 2, y: (-dir.hy * el.h) / 2 };
    var r = U.rot(local.x, local.y, U.degToRad(el.rotation || 0));
    return { x: cx + r.x, y: cy + r.y };
  }

  function startResize(e, h, id) {
    var el = Store.el(id);
    if (!el || el.locked) return;
    var ratio = null;
    if (el.type === 'image' && el.data.ratioLock !== false) {
      var nw = el.data.naturalW || el.w;
      var nh = el.data.naturalH || el.h;
      ratio = nh / nw;
    }
    gesture = {
      mode: 'resize',
      h: h,
      el: el,
      ratio: ratio,
      start: { x: el.x, y: el.y, w: el.w, h: el.h, rot: el.rotation || 0 },
      anchor: anchorWorldOf(el, h)
    };
    MB.hist.begin('Redimensionner');
  }

  function startRotate(e, id) {
    var el = Store.el(id);
    if (!el || el.locked) return;
    var center = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
    var p = canvasPoint(e);
    gesture = {
      mode: 'rotate',
      el: el,
      center: center,
      startRot: el.rotation || 0,
      startAngle: Math.atan2(p.y - center.y, p.x - center.x)
    };
    MB.hist.begin('Pivoter');
  }

  function startLineCreate(e) {
    gesture = { mode: 'line-create', start: canvasPoint(e), cur: canvasPoint(e) };
  }

  function startSketch(e) {
    var p = canvasPoint(e);
    gesture = { mode: 'sketch', points: [p] };
  }

  function startRectCreate(e) {
    gesture = { mode: 'rect-create', type: Store.s().tool, startScreen: localScreen(e) };
  }

  function localScreen(e) {
    var r = wrapEl().getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function startLineEnd(e, end, id) {
    var el = Store.el(id);
    if (!el || el.locked) return;
    gesture = { mode: 'line-end', el: el, end: end };
    MB.hist.begin('Déplacer l’extrémité');
  }

  function startCropDrag(e, corner, id) {
    var el = Store.el(id);
    if (!el) return;
    gesture = { mode: 'crop', el: el, corner: corner };
  }

  /* ------------------------------------------------------ aimantage */

  function computeSnap(box, excludeIds, ev) {
    var st = Store.s();
    if (!st.ui.snap) return null;
    if (ev && (ev.ctrlKey || ev.metaKey)) return null;
    var zoom = st.camera.zoom;
    var thr = 6 / zoom;
    var ex = {};
    excludeIds.forEach(function (id) {
      ex[id] = true;
    });

    var bestX = null;
    var bestY = null;
    var guides = [];
    var elements = st.elements;

    for (var i = 0; i < elements.length; i++) {
      var t = elements[i];
      if (t.hidden || ex[t.id]) continue;
      var b = Store.bboxOf(t);
      var txs = [b.x, b.x + b.w / 2, b.x + b.w];
      var tys = [b.y, b.y + b.h / 2, b.y + b.h];
      var mxs = [box.x, box.x + box.w / 2, box.x + box.w];
      var mys = [box.y, box.y + box.h / 2, box.y + box.h];

      for (var a = 0; a < txs.length; a++) {
        for (var m = 0; m < mxs.length; m++) {
          var d = txs[a] - mxs[m];
          if (Math.abs(d) <= thr && (bestX === null || Math.abs(d) < Math.abs(bestX.d))) {
            bestX = { d: d, at: txs[a] };
          }
        }
      }
      for (var a2 = 0; a2 < tys.length; a2++) {
        for (var m2 = 0; m2 < mys.length; m2++) {
          var d2 = tys[a2] - mys[m2];
          if (Math.abs(d2) <= thr && (bestY === null || Math.abs(d2) < Math.abs(bestY.d))) {
            bestY = { d: d2, at: tys[a2] };
          }
        }
      }
    }

    if (bestX) {
      guides.push({
        x1: bestX.at, y1: Math.min(box.y, box.y) - 60,
        x2: bestX.at, y2: box.y + box.h + 60
      });
    }
    if (bestY) {
      guides.push({
        x1: Math.min(box.x, box.x) - 60, y1: bestY.at,
        x2: box.x + box.w + 60, y2: bestY.at
      });
    }
    if (!bestX && !bestY) return null;
    return { dx: bestX ? bestX.d : 0, dy: bestY ? bestY.d : 0, guides: guides };
  }

  function nearestAttach(p, excludeIds) {
    var st = Store.s();
    var best = null;
    var thr = 16 / st.camera.zoom;
    for (var i = st.elements.length - 1; i >= 0; i--) {
      var t = st.elements[i];
      if (t.hidden || t.locked) continue;
      if (t.type === 'line' || t.type === 'sketch' || t.type === 'group') continue;
      if (excludeIds.indexOf(t.id) >= 0) continue;
      var sides = [
        ['left', t.x, t.y + t.h / 2],
        ['right', t.x + t.w, t.y + t.h / 2],
        ['top', t.x + t.w / 2, t.y],
        ['bottom', t.x + t.w / 2, t.y + t.h]
      ];
      for (var s = 0; s < sides.length; s++) {
        var d = Math.hypot(p.x - sides[s][1], p.y - sides[s][2]);
        if (d < thr && (!best || d < best.d)) {
          best = { d: d, id: t.id, side: sides[s][0] };
        }
      }
    }
    return best;
  }

  /* ==================================================== pointeur */

  function onPointerDown(e) {
    // Chrome flottante de l'application : aucun geste canvas ici.
    if (e.target.closest('#contextbar, .ctx-pop, .edge-tab')) return;

    // Pan prioritaire (§12/§13) : bouton milieu, Espace maintenu ou outil Main.
    // Placé AVANT les filtres [data-act] / poignées / crop — l'intention de
    // pan est explicite et doit primer sur tout contrôle interactif
    // (ex. pastille « copier » d'une palette sur le canvas).
    if (e.button === 1) {
      e.preventDefault();
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    if (spaceDown || Store.s().tool === 'pan') {
      // Espace / outil Main : neutraliser aussi la sélection de texte
      // que le moteur démarrerait pendant le pan.
      if (e.cancelable) e.preventDefault();
      startPan(e);
      return;
    }

    if (e.target.closest('#empty-hint, [data-act]')) return;

    var handle = e.target.closest('.handle');
    if (handle && handle.dataset.h) {
      e.preventDefault();
      if (handle.dataset.h === 'rot') startRotate(e, handle.dataset.id);
      else startResize(e, handle.dataset.h, handle.dataset.id);
      return;
    }

    var endpoint = e.target.closest('.endpoint');
    if (endpoint && endpoint.dataset.id) {
      e.preventDefault();
      startLineEnd(e, endpoint.dataset.end, endpoint.dataset.id);
      return;
    }

    var cropH = e.target.closest('[data-crop]');
    if (cropH) {
      var cropEl = cropH.closest('.mb-el');
      if (cropEl) {
        e.preventDefault();
        startCropDrag(e, cropH.dataset.crop, cropEl.dataset.id);
        return;
      }
    }

    var st = Store.s();

    if (st.ui.editingId) {
      var edView = Board.viewOf(st.ui.editingId);
      if (edView && e.target.closest && e.target.closest('.mb-el') === edView.node) return;
      commitEditing();
    }

    var hitDom = e.target.closest ? e.target.closest('.mb-el') : null;
    var hitEl = hitDom ? Store.el(hitDom.dataset.id) : null;

    if (st.tool === 'select') {
      if (hitEl) {
        var resolved = Store.resolveSelectable(hitEl.id);
        if (!resolved) return;
        if (e.shiftKey) {
          Store.select([resolved.id], 'toggle');
        } else if (st.selection.ids.indexOf(resolved.id) < 0) {
          Store.setSelection([resolved.id]);
        }
        if (!resolved.locked) startDrag(e);
      } else {
        if (!e.shiftKey) Store.clearSelection();
        startMarquee(e, e.shiftKey);
      }
      return;
    }

    if (st.tool === 'line') return startLineCreate(e);
    if (st.tool === 'sketch') return startSketch(e);
    if (RECT_CREATE[st.tool]) return startRectCreate(e);
    if (CLICK_CREATE[st.tool]) {
      gesture = {
        mode: 'create-click',
        tool: st.tool,
        screenStart: { x: e.clientX, y: e.clientY },
        anchor: canvasPoint(e)
      };
    }
  }

  function onPointerMove(e) {
    disarmOrphan(); // le geste reçoit encore des événements : il est vivant
    var g = gesture;
    if (!g) return;

    // Le bouton a été relâché HORS du panneau (certain moteurs ne
    // délivrent pas le mouseup) : ce mouvement sans bouton termine le
    // geste à sa position courante plutôt que de le laisser fantôme.
    if (typeof e.buttons === 'number' && e.buttons === 0) {
      onPointerUp(e);
      return;
    }

    switch (g.mode) {
      case 'pan': {
        Camera.panBy(e.clientX - g.last.x, e.clientY - g.last.y);
        g.last = { x: e.clientX, y: e.clientY };
        break;
      }

      case 'marquee': {
        var cur = localScreen(e);
        var rect = {
          x: Math.min(g.start.x, cur.x),
          y: Math.min(g.start.y, cur.y),
          w: Math.abs(cur.x - g.start.x),
          h: Math.abs(cur.y - g.start.y)
        };
        Board.showMarquee(rect);
        var cam = Store.s().camera;
        var canvasRect = {
          x: (rect.x - cam.x) / cam.zoom,
          y: (rect.y - cam.y) / cam.zoom,
          w: rect.w / cam.zoom,
          h: rect.h / cam.zoom
        };
        var ids = marqueeHit(canvasRect);
        document.querySelectorAll('.mb-el.is-marquee').forEach(function (n) {
          n.classList.remove('is-marquee');
        });
        ids.forEach(function (id) {
          var v = Board.viewOf(id);
          if (v) v.node.classList.add('is-marquee');
        });
        g.ids = ids;
        break;
      }

      case 'drag': {
        var sp = localScreen(e);
        if (!g.moved && Math.hypot(e.clientX - g.screenStart.x, e.clientY - g.screenStart.y) < 3) return;
        g.moved = true;
        if (!g.begun) {
          MB.hist.begin('Déplacer');
          g.begun = true;
        }
        var p = canvasPoint(e);
        var dx = p.x - g.pointerStart.x;
        var dy = p.y - g.pointerStart.y;
        var box = {
          x: g.anchorBBox.x + dx,
          y: g.anchorBBox.y + dy,
          w: g.anchorBBox.w,
          h: g.anchorBBox.h
        };
        var snap = computeSnap(box, g.movedIds, e);
        if (snap) {
          dx += snap.dx;
          dy += snap.dy;
          Board.drawGuides(snap.guides);
        } else {
          Board.clearGuides();
        }
        Store.applyDelta(g.origins, dx, dy);
        break;
      }

      case 'resize': {
        var el = g.el;
        var p2 = canvasPoint(e);
        var cx = g.start.x + g.start.w / 2;
        var cy = g.start.y + g.start.h / 2;
        var d = { x: p2.x - cx, y: p2.y - cy };
        var l = U.rot(d.x, d.y, -U.degToRad(g.start.rot));
        var dir = handleDir(g.h);
        var newW = g.start.w;
        var newH = g.start.h;
        if (dir.hx > 0) newW = Math.max(10, l.x + g.start.w / 2);
        if (dir.hx < 0) newW = Math.max(10, g.start.w / 2 - l.x);
        if (dir.hy > 0) newH = Math.max(10, l.y + g.start.h / 2);
        if (dir.hy < 0) newH = Math.max(10, g.start.h / 2 - l.y);

        var ratio = g.ratio;
        if (e.shiftKey) ratio = ratio ? null : g.start.h / g.start.w;
        if (ratio) {
          if (Math.abs(newW - g.start.w) >= Math.abs(newH - g.start.h)) {
            newH = newW * ratio;
          } else {
            newW = newH / ratio;
          }
        }

        var half = { x: (dir.hx * newW) / 2, y: (dir.hy * newH) / 2 };
        var off = U.rot(half.x, half.y, U.degToRad(g.start.rot));
        el.x = g.anchor.x + off.x - newW / 2;
        el.y = g.anchor.y + off.y - newH / 2;
        el.w = newW;
        el.h = newH;
        Store.emit('element', { ids: [el.id] });
        var sp2 = localScreen(e);
        showBadge(sp2.x + 14, sp2.y - 30, Math.round(newW) + ' × ' + Math.round(newH));
        break;
      }

      case 'rotate': {
        var el3 = g.el;
        var p3 = canvasPoint(e);
        var ang = Math.atan2(p3.y - g.center.y, p3.x - g.center.x);
        var deg = g.startRot + ((ang - g.startAngle) * 180) / Math.PI;
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        deg = ((deg % 360) + 360) % 360;
        if (deg > 180) deg -= 360;
        el3.rotation = Math.round(deg * 10) / 10;
        Store.emit('element', { ids: [el3.id] });
        var sp3 = localScreen(e);
        showBadge(sp3.x + 14, sp3.y - 30, Math.round(el3.rotation) + '°');
        break;
      }

      case 'line-create': {
        g.cur = canvasPoint(e);
        drawTempLine(g.start, g.cur);
        break;
      }

      case 'sketch': {
        var p4 = canvasPoint(e);
        var last = g.points[g.points.length - 1];
        if (Math.hypot(p4.x - last.x, p4.y - last.y) > 3 / Store.s().camera.zoom) {
          g.points.push(p4);
          drawTempSketch(g.points);
        }
        break;
      }

      case 'rect-create': {
        var cur5 = localScreen(e);
        var rect5 = {
          x: Math.min(g.startScreen.x, cur5.x),
          y: Math.min(g.startScreen.y, cur5.y),
          w: Math.abs(cur5.x - g.startScreen.x),
          h: Math.abs(cur5.y - g.startScreen.y)
        };
        Board.showMarquee(rect5);
        document.getElementById('marquee').classList.add('is-create');
        g.rect = rect5;
        break;
      }

      case 'create-click': {
        if (Math.hypot(e.clientX - g.screenStart.x, e.clientY - g.screenStart.y) > 5) {
          gesture = null; // le clic dérive → annulé (pas de création au relâchement)
        }
        break;
      }

      case 'line-end': {
        var el6 = g.el;
        var p6 = canvasPoint(e);
        var key = g.end === 'start' ? 'x1' : 'x2';
        var keyY = g.end === 'start' ? 'y1' : 'y2';
        el6.data[key] = p6.x;
        el6.data[keyY] = p6.y;
        var att = nearestAttach(p6, [el6.id]);
        if (g.end === 'start') el6.data.startAttach = att ? { id: att.id, side: att.side } : null;
        else el6.data.endAttach = att ? { id: att.id, side: att.side } : null;
        Store.syncLineBox(el6);
        Store.emit('element', { ids: [el6.id] });
        break;
      }

      case 'crop': {
        var el7 = g.el;
        var p7 = canvasPoint(e);
        var fx = U.clamp((p7.x - el7.x) / Math.max(el7.w, 1), 0, 0.94);
        var fy = U.clamp((p7.y - el7.y) / Math.max(el7.h, 1), 0, 0.94);
        if (!el7.data.crop) {
          el7.data.crop = { l: 0, t: 0, r: 0, b: 0 };
        }
        var cr = el7.data.crop;
        if (g.corner.indexOf('w') >= 0) cr.l = fx;
        if (g.corner.indexOf('e') >= 0) cr.r = 1 - fx;
        if (g.corner.indexOf('n') >= 0) cr.t = fy;
        if (g.corner.indexOf('s') >= 0) cr.b = 1 - fy;
        // garanties
        cr.l = U.clamp(cr.l, 0, 0.9 - cr.r);
        cr.r = U.clamp(cr.r, 0, 0.9 - cr.l);
        cr.t = U.clamp(cr.t, 0, 0.9 - cr.b);
        cr.b = U.clamp(cr.b, 0, 0.9 - cr.t);
        Store.nextRev(el7);
        Board.renderContent(el7.id);
        break;
      }
    }
  }

  function marqueeHit(canvasRect) {
    var st = Store.s();
    var seen = {};
    var ids = [];
    for (var i = 0; i < st.elements.length; i++) {
      var e = st.elements[i];
      if (e.hidden || e.locked) continue;
      var resolved = Store.resolveSelectable(e.id);
      if (!resolved || seen[resolved.id]) continue;
      seen[resolved.id] = true;
      var b = Store.bboxOf(resolved);
      if (U.rectIntersect(canvasRect, b) && b.w * b.h < 4e7) {
        ids.push(resolved.id);
      }
    }
    return ids;
  }

  function drawTempLine(a, b) {
    var cam = Store.s().camera;
    var x1 = a.x * cam.zoom + cam.x;
    var y1 = a.y * cam.zoom + cam.y;
    var x2 = b.x * cam.zoom + cam.x;
    var y2 = b.y * cam.zoom + cam.y;
    var svg = document.getElementById('guides');
    svg.innerHTML =
      '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" stroke="#4C8DFF" stroke-width="2" stroke-dasharray="6 4"/>';
  }

  function drawTempSketch(points) {
    var cam = Store.s().camera;
    var pts = points.map(function (p) {
      return (p.x * cam.zoom + cam.x) + ',' + (p.y * cam.zoom + cam.y);
    });
    var svg = document.getElementById('guides');
    svg.innerHTML =
      '<polyline points="' + pts.join(' ') +
      '" fill="none" stroke="#4C8DFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  function onPointerUp(e) {
    disarmOrphan();
    var g = gesture;
    if (!g) return;
    gesture = null;
    if (MB.diaglog && g.mode !== 'create-click') {
      MB.diaglog.trace(
        'fin du geste ' + g.mode +
          (g.moved ? ' (déplacement effectif)' : '')
      );
    }

    switch (g.mode) {
      case 'pan': {
        wrapEl().classList.remove('is-panning');
        break;
      }

      case 'marquee': {
        Board.hideMarquee();
        var ids = g.ids || [];
        var finalIds = g.additive ? g.base.slice() : [];
        ids.forEach(function (id) {
          if (finalIds.indexOf(id) < 0) finalIds.push(id);
        });
        Store.setSelection(finalIds);
        document.querySelectorAll('.mb-el.is-marquee').forEach(function (n) {
          n.classList.remove('is-marquee');
        });
        break;
      }

      case 'drag': {
        Board.clearGuides();
        if (g.alt && !g.moved) {
          MB.hist.rollback();
          Store.setSelection(g.prevSelection);
        } else if (g.begun) {
          if (!g.containerOnly) reparentDragged(g);
          MB.hist.commit();
        }
        break;
      }

      case 'resize': {
        hideBadge();
        MB.hist.commit();
        if (g.el.type === 'text') {
          var v = Board.viewOf(g.el.id);
          if (v) {
            g.el.data.autoH = false;
          }
        }
        Board.updateViews([g.el.id]);
        break;
      }

      case 'rotate': {
        hideBadge();
        MB.hist.commit();
        break;
      }

      case 'line-create': {
        Board.clearGuides();
        var a = g.start;
        var b = g.cur || a;
        if (Math.hypot(b.x - a.x, b.y - a.y) < 14) {
          b = { x: a.x + 180, y: a.y };
        }
        var el = MB.factory.create('line', a, { x2: b.x, y2: b.y });
        // attaches automatiques
        var att1 = nearestAttach(a, [el.id]);
        var att2 = nearestAttach(b, [el.id]);
        if (att1) {
          el.data.startAttach = { id: att1.id, side: att1.side };
          var p1 = Store.lineAnchor(Store.el(att1.id), att1.side);
          el.data.x1 = p1.x;
          el.data.y1 = p1.y;
        }
        if (att2) {
          el.data.endAttach = { id: att2.id, side: att2.side };
          var p2 = Store.lineAnchor(Store.el(att2.id), att2.side);
          el.data.x2 = p2.x;
          el.data.y2 = p2.y;
        }
        Store.syncLineBox(el);
        Store.addElements([el], { label: 'Créer une ligne' });
        Store.setSelection([el.id]);
        Store.setTool('select');
        break;
      }

      case 'sketch': {
        Board.clearGuides();
        var pts = g.points;
        if (pts.length >= 2) {
          var minX = Infinity;
          var minY = Infinity;
          var maxX = -Infinity;
          var maxY = -Infinity;
          pts.forEach(function (p) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
          });
          var w = maxX - minX;
          var h = maxY - minY;
          if (w > 6 && h > 6) {
            var norm = pts.map(function (p) {
              return [U.round((p.x - minX) / w, 4), U.round((p.y - minY) / h, 4)];
            });
            var sk = MB.factory.create('sketch', { x: minX + w / 2, y: minY + h / 2 }, {
              x: minX, y: minY, w: w, h: h
            });
            sk.data.points = norm;
            Store.addElements([sk], { label: 'Créer un croquis' });
            Store.setSelection([sk.id]);
            Store.setTool('select');
          }
        }
        break;
      }

      case 'rect-create': {
        Board.hideMarquee();
        document.getElementById('marquee').classList.remove('is-create');
        var cam = Store.s().camera;
        var rect = g.rect || { x: g.startScreen.x, y: g.startScreen.y, w: 0, h: 0 };
        var canvasRect = {
          x: (rect.x - cam.x) / cam.zoom,
          y: (rect.y - cam.y) / cam.zoom,
          w: rect.w / cam.zoom,
          h: rect.h / cam.zoom
        };
        if (canvasRect.w >= 28 && canvasRect.h >= 28) {
          var point = { x: canvasRect.x + canvasRect.w / 2, y: canvasRect.y + canvasRect.h / 2 };
          createAt(g.type, point, { x: canvasRect.x, y: canvasRect.y, w: canvasRect.w, h: canvasRect.h });
        } else {
          var startCanvas = Camera.toCanvas(
            g.startScreen.x + wrapEl().getBoundingClientRect().left,
            g.startScreen.y + wrapEl().getBoundingClientRect().top
          );
          createAt(g.type, startCanvas);
        }
        break;
      }

      case 'create-click': {
        if (g.tool === 'image' || g.tool === 'import') {
          openImportPicker(g.anchor);
          Store.setTool('select');
        } else {
          createAt(g.tool, g.anchor);
        }
        break;
      }

      case 'line-end': {
        MB.hist.commit();
        break;
      }

      case 'crop': {
        break; // la transaction crop est validée par les boutons Appliquer/Annuler
      }
    }
  }

  /* ------------------------------------------------ survie des gestes
   *
   * Certains hôtes CEP émettent des événements `blur` ou
   * `pointercancel` parasites PENDANT un geste parfaitement vivant
   * (activation du panneau par l'hôte, tablette/graphite, synchro
   * Illustrator…). Les annuler aussitôt tuait TOUT drag — le zoom
   * molette, lui, continuait de marcher.
   *
   * Nouvelle politique : ces événements ne terminent PLUS un geste
   * sur-le-champ. On arme un minuteur orphelin (600 ms) : si aucun
   * événement move/up n'arrive plus, le geste est annulé proprement
   * (le pointeur est réellement parti) ; sinon, il continue comme
   * si de rien n'était. Chaque occurrence est consignée dans le
   * journal de diagnostic (MB.diaglog). */
  var orphanTimer = null;
  var ORPHAN_MS = 600;

  function armOrphan(reason) {
    if (MB.diaglog) {
      MB.diaglog.trace('« ' + reason + ' » pendant un geste — survie 600 ms');
    }
    if (orphanTimer) clearTimeout(orphanTimer);
    orphanTimer = setTimeout(function () {
      orphanTimer = null;
      if (gesture) {
        if (MB.diaglog) {
          MB.diaglog.trace('plus aucun événement après « ' + reason + ' » — geste ' + gesture.mode + ' annulé');
        }
        cancelGesture();
      }
    }, ORPHAN_MS);
  }

  function disarmOrphan() {
    if (orphanTimer) {
      clearTimeout(orphanTimer);
      orphanTimer = null;
    }
  }

  /* Annulation propre d'un geste en cours (Échap, pointercancel,
     perte de focus du panneau). Une seule entrée d'historique par
     geste : rollback uniquement si le geste avait déjà modifié le
     modèle ; le recadrage vit jusqu'à ses boutons Appliquer/Annuler. */
  function cancelGesture() {
    disarmOrphan();
    var g = gesture;
    if (!g) return;
    gesture = null;
    if (MB.diaglog) MB.diaglog.trace('annulation du geste ' + g.mode);

    if (g.mode === 'drag') {
      if (g.begun) MB.hist.rollback();
      if (g.prevSelection) Store.setSelection(g.prevSelection);
    } else if (g.mode === 'resize' || g.mode === 'rotate' || g.mode === 'line-end') {
      MB.hist.rollback();
      if (g.el) Board.updateViews([g.el.id]);
    }

    Board.hideMarquee();
    Board.clearGuides();
    hideBadge();
    wrapEl().classList.remove('is-panning');
    var marqueeNode = document.getElementById('marquee');
    if (marqueeNode) marqueeNode.classList.remove('is-create');
    document.querySelectorAll('.mb-el.is-marquee').forEach(function (n) {
      n.classList.remove('is-marquee');
    });
  }

  /* Le moteur a interrompu le flux pointer (drag natif volé par l'OS,
     alt-tab, synchronisation CEP…). Événement souvent parasite dans
     les panneaux CEP : on tente de survivre (la couche souris ou le
     flux pointer restant peuvent continuer le geste) — cf.
     armOrphan. */
  function onPointerCancel() {
    armOrphan('pointercancel');
  }

  /* Perte de focus du panneau (clic dans l'interface Illustrator,
     changement d'application). Deux dangers : (1) un keyup Espace
     jamais livré laisserait spaceDown coincé — et TOUT drag suivant
     deviendrait un pan : l'espace est toujours réinitialisé ;
     (2) un geste en cours — on ne l'annule que s'il ne reçoit plus
     rien (minuteur orphelin), car certains hôtes CEP émettent des
     blur parasites au milieu d'un drag parfaitement vivant. */
  function onWindowBlur() {
    spaceDown = false;
    wrapEl().classList.remove('is-space');
    if (gesture) armOrphan('blur');
  }

  /* Aucun glisser natif ne doit partir du canvas : une image tirée
     vers l'OS (Finder/Explorer) vole le pointeur et tue le geste —
     c'est une capacité réelle des panneaux CEP. */
  function onDragStartBlock(e) {
    if (MB.EVT_DIAG) MB.EVT_DIAG.dragstartBlocked++;
    e.preventDefault();
  }

  function reparentDragged(g) {
    var roots = g.movedIds.filter(function (id) {
      for (var i = 0; i < g.movedIds.length; i++) {
        var other = g.movedIds[i];
        if (other !== id && Store.isDescendantOf(id, other)) return false;
      }
      return true;
    });
    var changed = false;
    roots.forEach(function (id) {
      var el = Store.el(id);
      if (!el) return;
      var curPar = el.parentId ? Store.el(el.parentId) : null;
      if (curPar && curPar.type === 'group') return; // l'appartenance aux groupes passe par Cmd+G
      var center = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
      var target = Store.topmostSectionAt(center, g.movedIds);
      var newParent = target ? target.id : null;
      if (newParent !== el.parentId) {
        Store.setParent(id, newParent);
        changed = true;
      }
    });
    if (changed) Store.emit('elements');
  }

  /* ==================================================== divers events */

  function onDblClick(e) {
    if (e.target.closest('#contextbar, .ctx-pop, #empty-hint')) return;

    var fieldNode = e.target.closest('[data-field]');
    if (fieldNode) {
      var hostEl = fieldNode.closest('.mb-el');
      var el = hostEl ? Store.el(hostEl.dataset.id) : null;
      if (!el) return;
      if (el.locked) return;
      var field = fieldNode.getAttribute('data-field');
      if (field === 'item') {
        startEditingItem(el, fieldNode.getAttribute('data-item'));
      } else {
        startEditing(el, field);
      }
      return;
    }

    var cell = e.target.closest('.mb-table-cell');
    if (cell) {
      var hostCell = cell.closest('.mb-el');
      var cellEl = hostCell ? Store.el(hostCell.dataset.id) : null;
      if (cellEl && !cellEl.locked && cellEl.type === 'table') {
        var rc = cell.getAttribute('data-cell').split('-');
        startCellEdit(cellEl, parseInt(rc[0], 10), parseInt(rc[1], 10));
      }
      return;
    }

    var imgHost = e.target.closest('.mb-el--image');
    if (imgHost) {
      var imgEl = Store.el(imgHost.dataset.id);
      if (imgEl && !imgEl.locked && !Store.s().ui.cropId) {
        enterCrop(imgEl);
      }
      return;
    }

    /* v1.6.1 — la planche ne s’ouvre PLUS au double-clic : SEULE la
     * flèche de la carte (bouton dédié), l’inspecteur ou le menu
     * contextuel ouvrent la planche. Le double-clic sur le titre
     * renomme (cas [data-field] ci-dessus). */
    var groupHost = e.target.closest('.mb-el');
    if (groupHost) {
      var gEl = Store.el(groupHost.dataset.id);
      if (gEl && gEl.type === 'group') {
        Store.setUI({ activeGroupId: gEl.id });
        Store.clearSelection();
      }
    }
  }

  function onClick(e) {
    var actNode = e.target.closest('[data-act]');
    if (!actNode) return;
    var act = actNode.getAttribute('data-act');
    var host = actNode.closest('.mb-el');
    var el = host ? Store.el(host.dataset.id) : null;

    if (act === 'toggle' && el) {
      var itemId = actNode.getAttribute('data-item');
      var items = el.data.items.map(function (it) {
        return it.id === itemId ? { id: it.id, text: it.text, done: !it.done } : it;
      });
      Store.mutate('Cocher', function () {
        Store.updateElement(el.id, { data: { items: items } }, { transaction: true });
      });
      return;
    }

    if (act === 'add-item' && el) {
      var newId = U.uid();
      var items2 = el.data.items.concat([{ id: newId, text: '', done: false }]);
      Store.mutate('Ajouter une tâche', function () {
        Store.updateElement(el.id, { data: { items: items2 } }, { transaction: true });
      });
      startEditingItem(Store.el(el.id), newId);
      return;
    }

    if (act === 'clear-done' && el) {
      Store.mutate('Nettoyer les tâches', function () {
        Store.updateElement(el.id, {
          data: { items: el.data.items.filter(function (it) {
            return !it.done;
          }) }
        }, { transaction: true });
      });
      return;
    }

    if (act === 'copy') {
      var hex = actNode.getAttribute('data-hex');
      copyText(hex);
      return;
    }

    if (act === 'open') {
      var url = actNode.getAttribute('data-url');
      if (url) {
        if (MB.cep && MB.cep.available()) MB.cep.openURL(url);
        else window.open(url, '_blank');
      }
      return;
    }

    /* v1.6 — flèche d'ouverture de la carte planche. */
    if (act === 'board-open') {
      var hostB = actNode.closest('.mb-el');
      var bEl2 = hostB ? Store.el(hostB.dataset.id) : null;
      if (bEl2 && MB.boards) MB.boards.enter(bEl2);
      return;
    }

    if (act === 'crop-apply') {
      exitCrop(true);
      return;
    }
    if (act === 'crop-cancel') {
      exitCrop(false);
      return;
    }
  }

  function copyText(text) {
    var done = function () {
      MB.ui.toast('Copié : ' + text, 'success');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {
          MB.ui.toast(text, 'info');
        });
        return;
      }
    } catch (err) {
      /* repli */
    }
    MB.ui.toast(text, 'info');
  }

  function onContextMenu(e) {
    if (e.target.closest('#contextbar, .ctx-pop, #empty-hint')) return;
    e.preventDefault();
    var hitDom = e.target.closest ? e.target.closest('.mb-el') : null;
    var hitEl = hitDom ? Store.el(hitDom.dataset.id) : null;
    if (MB.ui && MB.ui.contextmenu) {
      MB.ui.contextmenu.show(e.clientX, e.clientY, hitEl, canvasPoint(e));
    }
  }

  function onWheel(e) {
    e.preventDefault();
    var factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0014));
    Camera.zoomAt(e.clientX, e.clientY, factor);
  }

  function onDragOver(e) {
    if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      wrapEl().classList.add('is-droptarget');
    }
  }

  function onDragLeave() {
    wrapEl().classList.remove('is-droptarget');
  }

  function onDrop(e) {
    wrapEl().classList.remove('is-droptarget');
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault();
    importFiles(e.dataTransfer.files, canvasPoint(e));
  }

  function onKeyDown(e) {
    if (e.key === ' ' && !spaceDown) {
      var t = e.target;
      var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (!typing && !gesture) {
        spaceDown = true;
        wrapEl().classList.add('is-space');
        e.preventDefault();
      }
    }
  }

  function onKeyUp(e) {
    if (e.key === ' ') {
      spaceDown = false;
      wrapEl().classList.remove('is-space');
    }
  }

  /* ==================================================== Escape */

  function handleEscape() {
    if (gesture) {
      cancelGesture();
      return true;
    }

    var st = Store.s();
    if (st.ui.cropId) {
      exitCrop(false);
      return true;
    }
    if (st.ui.editingId) {
      commitEditing();
      return true;
    }
    if (st.ui.activeGroupId) {
      Store.setUI({ activeGroupId: null });
      return true;
    }
    if (st.tool !== 'select') {
      Store.setTool('select');
      return true;
    }
    if (st.selection.ids.length) {
      Store.clearSelection();
      return true;
    }
    return false;
  }

  /* ==================================================== init */

  function init() {
    Store = MB.store;
    Camera = MB.camera;
    Board = MB.board;

    var wrap = wrapEl();

    /* GESTES — couche adaptative pointer + souris : si le moteur CEP
       ne livre pas les Pointer Events (le zoom molette — famille
       souris — fonctionne alors que les drags restent morts), la
       couche souris prend le relais automatiquement. */
    U.bindPointerWithMouse(wrap, 'down', onPointerDown);
    U.bindPointerWithMouse(window, 'move', onPointerMove);
    U.bindPointerWithMouse(window, 'up', onPointerUp);

    /* Hygiène des gestes : interruption du flux, perte de focus du
       panneau, drag natif vers l'OS. */
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('blur', onWindowBlur);
    wrap.addEventListener('dragstart', onDragStartBlock);

    // Capture : on voit l'Espace même si un enfant interrompt la
    // propagation (les gardes « typing » protègent l'édition texte).
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    wrap.addEventListener('wheel', onWheel, { passive: false });
    wrap.addEventListener('dblclick', onDblClick);
    wrap.addEventListener('click', onClick);
    wrap.addEventListener('contextmenu', onContextMenu);
    wrap.addEventListener('dragover', onDragOver);
    wrap.addEventListener('dragleave', onDragLeave);
    wrap.addEventListener('drop', onDrop);
  }

  MB.interact = {
    init: init,
    createAt: createAt,
    openImportPicker: openImportPicker,
    importFiles: importFiles,
    startEditing: startEditing,
    commitEditing: commitEditing,
    isEditing: function () {
      return !!Store.s().ui.editingId || !!editingItem || !!editingCell;
    },
    enterCrop: enterCrop,
    exitCrop: exitCrop,
    canvasPoint: canvasPoint,
    handleEscape: handleEscape,
    /* Diagnostic (console DevTools, utile dans Illustrator) : quelles
       familles d'événements le moteur livre réellement, et l'état de la
       machine à gestes. MB.interact.diag() */
    diag: function () {
      var r = {};
      var d = MB.EVT_DIAG || {};
      Object.keys(d).forEach(function (k) {
        r[k] = d[k];
      });
      r.gesture = gesture ? gesture.mode : null;
      r.spaceDown = spaceDown;
      r.tool = Store ? Store.s().tool : null;
      return r;
    }
  };
})();

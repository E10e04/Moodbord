/* =========================================================================
 * content.js — Rendu HTML du contenu de chaque type d'élément.
 * Un seul modèle extensible : chaque type fournit un fragment HTML et un
 * hook afterMount (autodimensionnement, chargement d'images…).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  function esc(s) {
    return U.escapeHtml(s);
  }

  function nl2br(s) {
    return esc(s).replace(/\n/g, '<br>');
  }

  /* ------------------------------------------------------------ TEXT */

  function textStyle(d) {
    var deco = [];
    if (d.underline) deco.push('underline');
    if (d.strike) deco.push('line-through');
    return (
      'font-family:' + d.fontFamily + ';' +
      'font-size:' + d.fontSize + 'px;' +
      'font-weight:' + (d.bold ? '700' : '400') + ';' +
      'font-style:' + (d.italic ? 'italic' : 'normal') + ';' +
      (deco.length ? 'text-decoration:' + deco.join(' ') + ';' : '') +
      'text-align:' + d.align + ';' +
      'color:' + d.color + ';' +
      'line-height:' + d.lineHeight + ';' +
      (d.letterSpacing ? 'letter-spacing:' + d.letterSpacing + 'px;' : '')
    );
  }

  function renderText(el) {
    var d = el.data;
    return (
      '<div class="mb-text-body mb-editable" data-field="text" style="' + textStyle(d) +
      (d.bg && d.bg !== 'transparent' ? 'background:' + d.bg + ';padding:6px 10px;border-radius:6px;' : '') +
      '">' + nl2br(d.text || '') + '</div>'
    );
  }

  /* ------------------------------------------------------------ NOTE */

  function renderNote(el) {
    var d = el.data;
    var ink = U.readableOn(d.color);
    return (
      '<div class="mb-note-body mb-editable" data-field="text" style="background:' + d.color +
      ';color:' + ink + ';font-size:' + d.fontSize + 'px' +
      (d.fontFamily ? ';font-family:\'' + U.escapeHtml(d.fontFamily) + '\'' : '') +
      '">' + nl2br(d.text || '') + '</div>'
    );
  }

  /* --------------------------------------------------------- COMMENT */

  function renderComment(el) {
    var d = el.data;
    return (
      '<div class="mb-comment-body" style="border-top-color:' + d.color + '">' +
      '<div class="mb-comment-author">' + esc(d.author) + '</div>' +
      '<div class="mb-comment-text mb-editable" data-field="text">' + nl2br(d.text || '') + '</div>' +
      '</div>'
    );
  }

  /* ------------------------------------------------------------ IMAGE */

  function renderImage(el) {
    var d = el.data;
    var crop = d.crop;
    var wPct = 100;
    var hPct = 100;
    var lPct = 0;
    var tPct = 0;
    if (crop) {
      var sx = Math.max(0.1, 1 - (crop.l + crop.r));
      var sy = Math.max(0.1, 1 - (crop.t + crop.b));
      wPct = 100 / sx;
      hPct = 100 / sy;
      lPct = -(crop.l * 100) / sx;
      tPct = -(crop.t * 100) / sy;
    }
    var borderCss = d.border > 0 ? 'border:' + d.border + 'px solid ' + d.borderColor + ';' : '';
    var html =
      '<div class="mb-image-wrap' + (d.shadow ? ' has-shadow' : '') + '" style="border-radius:' +
      d.radius + 'px;' + borderCss + '">' +
      '<img class="mb-image-img" src="' + esc(d.src) + '" alt="" draggable="false" ' +
      'style="width:' + wPct + '%;height:' + hPct + '%;left:' + lPct + '%;top:' + tPct +
      '%;object-fit:' + (crop ? 'cover' : (d.fit || 'cover')) + ';" ' +
      'onerror="this.classList.add(\'is-broken\')">' +
      '</div>';

    if (MB.store.s().ui.cropId === el.id) {
      var cl = crop ? crop.l : 0;
      var ct = crop ? crop.t : 0;
      var cr = crop ? crop.r : 0;
      var cb = crop ? crop.b : 0;
      html +=
        '<div class="mb-crop-veil"></div>' +
        '<div class="mb-crop-frame" style="left:' + cl * 100 + '%;top:' + ct * 100 + '%;right:' +
        cr * 100 + '%;bottom:' + cb * 100 + '%;">' +
        '<div class="mb-crop-h" data-crop="nw"></div>' +
        '<div class="mb-crop-h" data-crop="ne"></div>' +
        '<div class="mb-crop-h" data-crop="sw"></div>' +
        '<div class="mb-crop-h" data-crop="se"></div>' +
        '</div>' +
        '<div class="mb-crop-actions">' +
        '<button class="btn btn-primary btn--xs" data-act="crop-apply">Appliquer</button>' +
        '<button class="btn btn-ghost btn--xs" data-act="crop-cancel">Annuler</button>' +
        '</div>';
    }
    return html;
  }

  /* ------------------------------------------------------------ COLOR */

  function renderColor(el) {
    var d = el.data;
    var ink = U.readableOn(d.hex);
    return (
      '<div class="mb-color-chip" style="background:' + d.hex + ';color:' + ink + '">' +
      esc(d.hex.toUpperCase()) +
      '</div>' +
      '<div class="mb-color-meta">' +
      '<div class="mb-color-name mb-editable" data-field="name">' + esc(d.name) + '</div>' +
      '<div class="mb-color-hex">' + esc(d.hex.toUpperCase()) + '</div>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------- PALETTE */

  function renderPalette(el) {
    var d = el.data;
    var rows = '';
    for (var i = 0; i < d.colors.length; i++) {
      var c = d.colors[i];
      rows +=
        '<div class="mb-palette-row" data-act="copy" data-hex="' + esc(c.hex) + '">' +
        '<span class="mb-palette-swatch" style="background:' + esc(c.hex) + '"></span>' +
        '<span class="mb-palette-cname">' + esc(c.name) + ' · <em>' + esc(String(c.hex).toUpperCase()) + '</em></span>' +
        '</div>';
    }
    return (
      '<div class="mb-palette-name mb-editable" data-field="name">' + esc(d.name) + '</div>' +
      '<div class="mb-palette-rows">' + rows + '</div>'
    );
  }

  /* -------------------------------------------------------- TYPOGRAPHY */

  function renderTypography(el) {
    var d = el.data;
    var lines = '';
    for (var i = 0; i < d.sizes.length; i++) {
      lines +=
        '<div class="mb-typo-line" style="font-size:' + d.sizes[i] + 'px">' +
        esc(d.sampleText) + '</div>';
    }
    return (
      '<div class="mb-typo-card">' +
      '<div class="mb-typo-name mb-editable" data-field="name">' + esc(d.fontFamily) + '</div>' +
      '<div class="mb-typo-sample" style="font-family:\'' + esc(d.fontFamily) + '\'">Aa</div>' +
      '<div class="mb-typo-lines" style="font-family:\'' + esc(d.fontFamily) + '\'">' + lines + '</div>' +
      '</div>'
    );
  }

  /* ------------------------------------------------------------ BOARD */

  function renderBoard(el) {
    var d = el.data;
    var count = d && d.doc && Array.isArray(d.doc.elements) ? d.doc.elements.length : d.elCount || 0;
    /* v1.6.1 — carte compacte : plus de grande zone d'aperçu, plus de
     * badge « planche » bleu. Le nom est centré dans sa barre ; la
     * flèche d'ouverture vit dans la barre du bas, à droite (à la place
     * de l'ancien libellé bleu « → planche »). */
    return (
      '<div class="mb-board-card">' +
      '<div class="mb-board-bar mb-board-bar--name">' +
      '<div class="mb-board-title mb-editable" data-field="title">' + esc(d.title || 'Planche') + '</div>' +
      '</div>' +
      '<div class="mb-board-bar mb-board-bar--info">' +
      '<span class="mb-board-count">' + count + ' élément' + (count > 1 ? 's' : '') + '</span>' +
      '<button class="mb-board-open" type="button" data-act="board-open" title="Ouvrir la planche" aria-label="Ouvrir la planche">' +
      (MB.icons ? MB.icons.get('external', 14) : '→') +
      '</button>' +
      '</div>' +
      '</div>'
    );
  }

  /* -------------------------------------------------------------- LINK */

  function renderLink(el) {
    var d = el.data;
    var letter = (d.title || d.domain || '?').trim().charAt(0).toUpperCase();
    /* v1.3 — la carte ne porte plus data-act="open" : un clic simple
     * sélectionne/déplace le lien comme n'importe quel élément ; SEULE
     * la flèche dédiée (bouton .mb-link-open) ouvre le navigateur. */
    return (
      '<div class="mb-link-card">' +
      '<div class="mb-link-tile">' + esc(letter) + '</div>' +
      '<div class="mb-link-meta">' +
      '<div class="mb-link-title mb-editable" data-field="title">' + esc(d.title) + '</div>' +
      '<div class="mb-link-domain">' + esc(d.domain) + '</div>' +
      '</div>' +
      '<button class="mb-link-open" type="button" data-act="open" data-url="' + esc(d.url) +
      '" title="Ouvrir le lien dans le navigateur" aria-label="Ouvrir le lien dans le navigateur">' +
      MB.icons.get('external', 13) +
      '</button>' +
      '</div>'
    );
  }

  /* -------------------------------------------------------------- FILE */

  function renderFile(el) {
    var d = el.data;
    return (
      '<div class="mb-file-card">' +
      '<div class="mb-file-icon">' + MB.icons.get('file', 18) + '</div>' +
      '<div class="mb-file-meta">' +
      '<div class="mb-file-name">' + esc(d.name) + '</div>' +
      '<div class="mb-file-sub">' + esc(d.kind) + (d.size ? ' · ' + U.formatBytes(d.size) : '') + '</div>' +
      '</div>' +
      '</div>'
    );
  }

  /* -------------------------------------------------------------- LINE */

  function renderLine(el) {
    var d = el.data;
    var x1 = d.x1 - el.x;
    var y1 = d.y1 - el.y;
    var x2 = d.x2 - el.x;
    var y2 = d.y2 - el.y;
    var dash = d.style === 'dashed' ? ' stroke-dasharray="10 8"' : d.style === 'dotted' ? ' stroke-dasharray="1.5 7"' : '';
    var cap = d.style === 'dotted' ? ' round' : ' round';

    function arrow(x, y, tx, ty) {
      var ang = Math.atan2(y - ty, x - tx);
      var size = 6 + d.thickness * 1.6;
      var a1 = ang + 0.42;
      var a2 = ang - 0.42;
      var p1 = { x: x, y: y };
      var p2 = { x: x - Math.cos(a1) * size, y: y - Math.sin(a1) * size };
      var p3 = { x: x - Math.cos(a2) * size, y: y - Math.sin(a2) * size };
      return (
        '<polygon points="' + p1.x + ',' + p1.y + ' ' + p2.x + ',' + p2.y + ' ' + p3.x + ',' + p3.y +
        '" fill="' + d.color + '" stroke="none"/>'
      );
    }

    var mx = (x1 + x2) / 2;
    var my = (y1 + y2) / 2;
    var label = d.label
      ? '<text x="' + mx + '" y="' + (my - 8) + '" text-anchor="middle" class="mb-line-label">' + esc(d.label) + '</text>'
      : '';

    return (
      '<svg class="mb-line-svg" viewBox="0 0 ' + Math.max(el.w, 1) + ' ' + Math.max(el.h, 1) + '" overflow="visible">' +
      '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" stroke="' + d.color + '" stroke-width="' + d.thickness + '" stroke-linecap="' + cap + '"' + dash + '/>' +
      (d.startArrow ? arrow(x1, y1, x2, y2) : '') +
      (d.endArrow ? arrow(x2, y2, x1, y1) : '') +
      label +
      '</svg>'
    );
  }

  /* ------------------------------------------------------------- SHAPE */

  function renderShape(el) {
    var d = el.data;
    var stroke = d.stroke !== 'none' ? ' stroke="' + d.stroke + '" stroke-width="' + d.strokeWidth + '"' : '';
    var body = '';
    if (d.shape === 'ellipse') {
      body = '<ellipse cx="50%" cy="50%" rx="49%" ry="49%" fill="' + d.fill + '"' + stroke + '/>';
    } else if (d.shape === 'triangle') {
      body = '<polygon points="50,3 97,95 3,95" fill="' + d.fill + '"' + stroke + '/>';
    } else {
      body =
        '<rect x="' + (d.strokeWidth / 2 || 0) + '" y="' + (d.strokeWidth / 2 || 0) +
        '" width="' + (100 - (d.strokeWidth || 0)) + '" height="' + (100 - (d.strokeWidth || 0)) +
        '" rx="' + d.radius + '" fill="' + d.fill + '"' + stroke + ' vector-effect="non-scaling-stroke"' +
        ' style="width:calc(100% - ' + (d.strokeWidth || 0) + 'px);height:calc(100% - ' + (d.strokeWidth || 0) + 'px)"/>';
    }
    return (
      '<svg class="mb-shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none">' + body + '</svg>'
    );
  }

  /* -------------------------------------------------- SECTION / COLUMN */

  function renderSection(el) {
    var d = el.data;
    return (
      '<div class="mb-section-box" style="background:' + d.color + '">' +
      (d.showTitle !== false
        ? '<div class="mb-section-title mb-editable" data-field="title">' + esc(d.title) + '</div>'
        : '') +
      '</div>'
    );
  }

  function renderColumn(el) {
    var d = el.data;
    return (
      '<div class="mb-column-box" style="background:' + d.color + '">' +
      '<div class="mb-column-title mb-editable" data-field="title">' + esc(d.title) + '</div>' +
      '</div>'
    );
  }

  /* ------------------------------------------------------------- TABLE */

  function renderTable(el) {
    var d = el.data;
    var cells = '';
    for (var r = 0; r < d.rows; r++) {
      for (var c = 0; c < d.cols; c++) {
        var v = (d.cells && d.cells[r] && d.cells[r][c]) || '';
        var head = d.header && r === 0;
        cells +=
          '<div class="mb-table-cell' + (head ? ' mb-table-cell--head' : '') +
          '" data-cell="' + r + '-' + c + '">' + esc(v) + '</div>';
      }
    }
    return (
      '<div class="mb-table-grid" style="grid-template-columns:repeat(' + d.cols + ',1fr)">' +
      cells + '</div>'
    );
  }

  /* --------------------------------------------------------- CHECKLIST */

  function renderChecklist(el) {
    var d = el.data;
    var doneCount = 0;
    var rows = '';
    for (var i = 0; i < d.items.length; i++) {
      var it = d.items[i];
      if (it.done) doneCount++;
      rows +=
        '<div class="mb-check-item' + (it.done ? ' is-done' : '') + '">' +
        '<button class="mb-check-box" data-act="toggle" data-item="' + it.id + '" role="checkbox" ' +
        'aria-checked="' + (it.done ? 'true' : 'false') + '" aria-label="Terminer"></button>' +
        '<span class="mb-check-text mb-editable" data-field="item" data-item="' + it.id + '">' + esc(it.text) + '</span>' +
        '</div>';
    }
    var footer =
      '<div class="mb-check-foot">' +
      '<button class="mb-check-add" data-act="add-item">+ Ajouter</button>' +
      (doneCount > 0 && doneCount === d.items.length
        ? '<button class="mb-check-clear" data-act="clear-done">Nettoyer</button>'
        : '') +
      '</div>';
    return (
      '<div class="mb-check-card">' +
      '<div class="mb-check-title mb-editable" data-field="title">' + esc(d.title) + '</div>' +
      '<div class="mb-check-list">' + rows + '</div>' +
      footer +
      '</div>'
    );
  }

  /* ------------------------------------------------------------ SKETCH */

  function renderSketch(el) {
    var d = el.data;
    var pts = [];
    for (var i = 0; i < d.points.length; i++) {
      pts.push(U.round(d.points[i][0] * el.w, 1) + ',' + U.round(d.points[i][1] * el.h, 1));
    }
    return (
      '<svg class="mb-sketch-svg" viewBox="0 0 ' + Math.max(el.w, 1) + ' ' + Math.max(el.h, 1) +
      '" preserveAspectRatio="none">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + d.color +
      '" stroke-width="' + d.thickness + '" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
    );
  }

  /* ------------------------------------------------------------ GROUP */

  function renderGroup() {
    return '<div class="mb-group-box"></div>';
  }

  /* ---------------------------------------------------------- dispatch */

  var RENDERERS = {
    text: renderText,
    note: renderNote,
    comment: renderComment,
    image: renderImage,
    color: renderColor,
    palette: renderPalette,
    typography: renderTypography,
    link: renderLink,
    file: renderFile,
    line: renderLine,
    shape: renderShape,
    section: renderSection,
    column: renderColumn,
    table: renderTable,
    checklist: renderChecklist,
    sketch: renderSketch,
    board: renderBoard,
    group: renderGroup
  };

  /* Autodimensionnement après montage. */
  function afterMount(view, el) {
    if (el.type === 'image' && !el._sized && el.data.src) {
      var img = view.node.querySelector('img');
      if (img) {
        var done = false;
        img.addEventListener('load', function () {
          if (done) return;
          done = true;
          var nw = img.naturalWidth || 1024;
          var nh = img.naturalHeight || 1024;
          var scale = Math.min(1, 340 / Math.max(nw, nh));
          var w2 = Math.max(60, Math.round(nw * scale));
          var h2 = Math.max(60, Math.round(nh * scale));
          // Ne marque le projet « modifié » que si l'autodimensionnement
          // change réellement quelque chose (sinon chaque réouverture du
          // panneau relançait un cycle d'autosave inutile).
          var changed =
            el.w !== w2 || el.h !== h2 || el.data.naturalW !== nw || el.data.naturalH !== nh;
          el.w = w2;
          el.h = h2;
          el.data.naturalW = nw;
          el.data.naturalH = nh;
          el._sized = true;
          if (changed) {
            view.update(el);
            MB.board.refreshOverlay();
            if (MB.storage) MB.storage.markDirty();
          }
        });
        img.addEventListener('error', function () {
          done = true;
        });
      }
    }

    var autoTypes = {
      text: el.data.autoH !== false,
      note: true,
      checklist: true,
      comment: true
    };
    if (autoTypes[el.type]) {
      /* BUG CORRIGÉ (v1.1.3) : à la CRÉATION, afterMount est appelé
       * depuis elementView.create() AVANT que board.reconcile()
       * n'attache le nœud au DOM — la mesure donnait 0 et écrasait
       * el.h → texte/commentaire/checklist créés INVISIBLES (h=0)
       * jusqu'à la prochaine re-mesure. On ne mesure que sur un nœud
       * attaché ; sinon on reporte à la frame suivante (le reconcile
       * de la même tâche a alors inséré le nœud). */
      var body = view.node.firstElementChild;
      if (body) {
        if (body.isConnected) {
          applyAutoHeight(view, el);
        } else {
          var elId = el.id;
          requestAnimationFrame(function () {
            var live = MB.store.el(elId);
            if (live) applyAutoHeight(view, live);
          });
        }
      }
    }
  }

  /* Mesure la hauteur réelle du corps (unités canvas) et cale el.h.
   * Appelée uniquement le nœud étant attaché au DOM.
   *
   * BUG CORRIGÉ (v1.6) : l'ancienne mesure (getBoundingClientRect / zoom)
   * revenait TOUJOURS à la hauteur de la boîte (height:100 % du corps) —
   * jamais au contenu — le texte multi-paragraphes débordait donc
   * silencieusement sous l'élément. scrollHeight mesure le CONTENU en
   * unités de mise en page (insensible au zoom par transform) : c'est la
   * valeur attendue pour el.h. */
  function applyAutoHeight(view, el) {
    var autoTypes = {
      text: el.data.autoH !== false,
      note: true,
      checklist: true,
      comment: true
    };
    if (!autoTypes[el.type]) return;
    var body = view.node.firstElementChild;
    if (!body || !body.isConnected) return;
    var needed = Math.ceil(body.scrollHeight);
    if (needed > 0 && Math.abs(needed - el.h) > 2) {
      el.h = needed;
      view.node.style.height = el.h + 'px';
      MB.board.refreshOverlay();
    }
  }

  MB.content = {
    render: function (el) {
      var fn = RENDERERS[el.type];
      if (!fn) return '<div class="mb-unknown">' + esc(el.type) + '</div>';
      return fn(el);
    },
    afterMount: afterMount
  };
})();

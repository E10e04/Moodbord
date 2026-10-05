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
      /* v1.18 — graisse explicite (sélecteur « Graisse ») sinon le
       * couple gras/normal historique. */
      'font-weight:' + (d.fontWeight || (d.bold ? '700' : '400')) + ';' +
      'font-style:' + (d.italic ? 'italic' : 'normal') + ';' +
      (deco.length ? 'text-decoration:' + deco.join(' ') + ';' : '') +
      'text-align:' + d.align + ';' +
      'color:' + d.color + ';' +
      'line-height:' + d.lineHeight + ';' +
      (d.letterSpacing ? 'letter-spacing:' + d.letterSpacing + 'px;' : '')
    );
  }

  /* v1.17 — TITRE des cartes Texte et Note : une ligne dédiée EN HAUT
   * de la carte, éditable au double-clic comme le corps, positionnable
   * (gauche / centre / droite) via data.titleAlign. Rétrocompatible :
   * sans titre (cartes antérieures), le rendu reste EXACTEMENT celui
   * de v1.16 — aucun bloc vide, aucune hauteur fantôme.
   * v1.18 — le titre se personnalise : COULEUR du texte (titleColor),
   * FOND (titleBg, pastille arrondie), POLICE (titleFont, sinon celle
   * de la carte) et GRAISSE (titleWeight, sinon le gras 700 d'origine).
   * v1.18.1 — UN SEUL BLOC titre + corps : le bandeau du fond de titre
   * garde ses coins SUPÉRIEURS arrondis (au rayon de la carte : 6 px
   * Texte, 3 px Note) mais sa base devient CARRÉE, et le fond du corps
   * prend des coins supérieurs CARRÉS quand le titre est coloré — les
   * deux fonds se soudent en un seul bloc d'un seul tenant. */
  function hasTitle(d) {
    return !!(d && (d.title || d.titleHtml));
  }

  /* v1.18.1 — le titre porte-t-il un fond ? (bandeau pleine largeur) */
  function hasTitleBg(d) {
    return !!(d && d.titleBg && d.titleBg !== 'transparent');
  }

  /* v1.19 — TAILLE de police du TITRE, réglable indépendamment du corps
   * (data.titleFontSize, px, posée par l'inspecteur). Sans valeur (ou
   * valeur invalide) : la taille dérivée historique — 0.85 du corps,
   * plancher 14 — pour un rendu identique aux versions antérieures. */
  function titleFontSizeOf(d) {
    if (d && d.titleFontSize) {
      var v = Number(d.titleFontSize);
      if (isFinite(v) && v > 0) return Math.min(Math.round(v), 400);
    }
    return Math.max(14, Math.round(((d && d.fontSize) || 24) * 0.85));
  }

  function titleAlignOf(d) {
    return d.titleAlign === 'left' || d.titleAlign === 'right' ? d.titleAlign : 'center';
  }

  function renderText(el) {
    var d = el.data;
    /* v1.18.1 — quand le titre porte un fond, le fond du corps (d.bg)
     * épouse le bloc : coins SUPÉRIEURS carrés (la base carrée du
     * bandeau s'y soude), coins inférieurs arrondis. Sans fond de
     * titre, le bloc corps d'origine reste intact (coins 6 px). */
    var flushBody = hasTitle(d) && hasTitleBg(d);
    var body =
      '<div class="mb-text-body mb-editable mb-rich" data-field="text" style="' + textStyle(d) +
      (d.bg && d.bg !== 'transparent' ? 'background:' + d.bg + ';padding:6px 10px;border-radius:' + (flushBody ? '0 0 6px 6px' : '6px') + ';' : '') +
      '">' + richOrPlain(d) + '</div>';
    if (!hasTitle(d)) return body;
    return (
      '<div class="mb-text-stack">' +
      renderCardTitle(d, 'color:' + d.color + ';', 6) +
      body +
      '</div>'
    );
  }

  /* ------------------------------------------------------------ NOTE */

  /* v1.8 — corps riche : data.html (issu de l'éditeur, sanitisé) sinon
   * repli texte brut. Les listes à puces et les mises en forme par
   * sélection (gras, italique, souligné, surlignage) vivent dans le HTML. */
  function richOrPlain(d) {
    if (d && typeof d.html === 'string' && d.html) return d.html;
    return nl2br(d.text || '');
  }

  /* v1.17 — le titre RICHE réutilise la mécanique des en-têtes de
   * colonnes : data.titleHtml (sanitisé) sinon repli texte brut. */
  function renderCardTitle(d, colorStyle, topR) {
    /* v1.19 — taille dédiée du titre (titleFontSize) sinon dérivée. */
    var size = titleFontSizeOf(d);
    var st = 'font-size:' + size + 'px;font-weight:' + (d.titleWeight || 700) +
      ';text-align:' + titleAlignOf(d) + ';' + (colorStyle || '');
    /* v1.18 — police dédiée du titre (sinon celle de la carte),
     * couleur d'encre dédiée, fond pastille arrondi.
     * v1.18.1 — le bandeau du fond s'arrondit en HAUT au rayon de la
     * carte (topR : 6 px Texte, 3 px Note) et sa base est CARRÉE ; le
     * séparateur de la Note s'efface — la frontière titre/corps devient
     * la simple frontière des deux fonds. */
    var fam = d.titleFont || d.fontFamily;
    if (fam) st += "font-family:'" + U.escapeHtml(fam) + "';";
    if (d.titleColor) st += 'color:' + U.escapeHtml(d.titleColor) + ';';
    if (hasTitleBg(d)) {
      var r = Math.max(0, topR || 6);
      st += 'background:' + U.escapeHtml(d.titleBg) +
        ';padding:2px 8px;border-radius:' + r + 'px ' + r + 'px 0 0;border-bottom:0;';
    }
    return (
      '<div class="mb-card-title mb-editable mb-rich" data-field="title" style="' + st + '">' +
      richOrPlainTitle(d) + '</div>'
    );
  }

  function renderNote(el) {
    var d = el.data;
    var ink = U.readableOn(d.color);
    var font = d.fontFamily ? ';font-family:\'' + U.escapeHtml(d.fontFamily) + '\'' : '';
    /* v1.18 — graisse de la police (sélecteur dédié de l'inspecteur). */
    if (d.fontWeight) font += ';font-weight:' + Number(d.fontWeight);
    if (!hasTitle(d)) {
      return (
        '<div class="mb-note-body mb-editable mb-rich" data-field="text" style="background:' + d.color +
        ';color:' + ink + ';font-size:' + d.fontSize + 'px' + font +
        '">' + richOrPlain(d) + '</div>'
      );
    }
    /* v1.17 — avec titre : le PAPIER (fond + ombre) monte sur la pile,
     * le titre vit dessus (encre adaptée, séparateur discret), le corps
     * reste éditable et riche en dessous. */
    return (
      '<div class="mb-note-stack" style="background:' + d.color + '">' +
      renderCardTitle(d, 'color:' + ink + ';', 3) +
      '<div class="mb-note-body mb-editable mb-rich" data-field="text" style="color:' + ink +
      ';font-size:' + d.fontSize + 'px' + font + '">' + richOrPlain(d) + '</div>' +
      '</div>'
    );
  }

  /* --------------------------------------------------------- COMMENT */

  function renderComment(el) {
    var d = el.data;
    var f = d.fontFamily ? ';font-family:\'' + U.escapeHtml(d.fontFamily) + '\'' : '';
    if (d.fontWeight) f += ';font-weight:' + Number(d.fontWeight);
    return (
      '<div class="mb-comment-body" style="border-top-color:' + d.color + '">' +
      '<div class="mb-comment-author">' + esc(d.author) + '</div>' +
      '<div class="mb-comment-text mb-editable' + (d.rich ? ' mb-rich' : '') + '" data-field="text" style="font-size:' + (d.fontSize || 13) + 'px' + f + '">' + nl2br(d.text || '') + '</div>' +
      '</div>'
    );
  }

  /* ------------------------------------------------------------ IMAGE */

  function renderImage(el) {
    var d = el.data;
    /* v1.10 — carte IMAGE EN ATTENTE : l'outil Image posé sur le
     * canvas (glissé ou cliqué) crée d'abord une carte vide avec
     * l'icône d'import au milieu — le clic dessus ouvre le sélecteur
     * et l'image choisie remplit la carte. */
    if (!d.src) {
      var cta = MB.i18n ? MB.i18n.t('image.cta') : 'Cliquez pour choisir une image';
      return (
        '<div class="mb-image-empty-card">' +
        '<button class="mb-image-cta" type="button" data-act="image-pick" title="' + esc(cta) + '" aria-label="' + esc(cta) + '">' +
        '<span class="mb-image-cta-icon">' + MB.icons.get('image', 36) + '</span>' +
        '<span class="mb-image-cta-text">' + esc(cta) + '</span>' +
        '</button>' +
        '</div>'
      );
    }
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

  /* v1.12 — REDESIGN d'après le bloc « picker » de Bencho : la carte
   * est rendue par ui/palette.js (pastille à ronds empilés + liste
   * cochable, mêmes classes .pik que la carte Assignees). Ici, seul
   * le branchement du moteur — les couleurs et le « pourquoi » des
   * nombres vivent dans le module. */
  function renderPalette(el) {
    return MB.ui.paletteCard ? MB.ui.paletteCard.render(el) : '';
  }

  /* -------------------------------------------------------- TYPOGRAPHY */

  function renderTypography(el) {
    var d = el.data;
    /* v1.18 — graisse du spécimen (sélecteur dédié). */
    var w = d.fontWeight ? ';font-weight:' + Number(d.fontWeight) : '';
    var lines = '';
    for (var i = 0; i < d.sizes.length; i++) {
      lines +=
        '<div class="mb-typo-line" style="font-size:' + d.sizes[i] + 'px' + w + '">' +
        esc(d.sampleText) + '</div>';
    }
    return (
      '<div class="mb-typo-card">' +
      '<div class="mb-typo-name mb-editable" data-field="name">' + esc(d.fontFamily) + '</div>' +
      '<div class="mb-typo-sample" style="font-family:\'' + esc(d.fontFamily) + '\'' + w + '">Aa</div>' +
      '<div class="mb-typo-lines" style="font-family:\'' + esc(d.fontFamily) + '\'' + w + '">' + lines + '</div>' +
      '</div>'
    );
  }

  /* ------------------------------------------------------------ BOARD */

  function renderBoard(el) {
    var d = el.data;
    var count = d && d.doc && Array.isArray(d.doc.elements) ? d.doc.elements.length : d.elCount || 0;
    var tf = (d.titleFont || d.titleWeight) ? ' style="' +
      (d.titleFont ? "font-family:'" + U.escapeHtml(d.titleFont) + "';" : '') +
      (d.titleWeight ? 'font-weight:' + Number(d.titleWeight) + ';' : '') +
      'font-size:' + (d.titleSize || 19) + 'px"' : '';
    /* v1.7 — design demandé : grande zone principale où le NOM de la
     * planche est centré au milieu de son conteneur ; barre du bas avec
     * le compteur d'éléments à gauche et la flèche d'ouverture à droite
     * (exactement au niveau de l'ancien libellé bleu « → planche »). */
    return (
      '<div class="mb-board-card">' +
      '<div class="mb-board-body">' +
      '<div class="mb-board-title mb-editable" data-field="title"' + tf + '>' + esc(d.title || 'Planche') + '</div>' +
      '</div>' +
      '<div class="mb-board-foot">' +
      '<span class="mb-board-count">' + count + ' élément' + (count > 1 ? 's' : '') + '</span>' +
      '<button class="mb-board-open" type="button" data-act="board-open" title="Ouvrir la planche" aria-label="Ouvrir la planche">' +
      (MB.icons ? MB.icons.get('external', 14) : '→') +
      '</button>' +
      '</div>' +
      '</div>'
    );
  }

  /* ------------------------------------------------------ IMPORT (v1.8) */

  function renderImport(el) {
    /* v1.10 — contenu demandé par l'utilisateur : JUSTE l'icône
     * d'import de média et le texte « Cliquez pour importer un
     * fichier » au milieu de la carte (la zone centrale est un
     * bouton ; les bords restent la poignée de sélection/drag).
     * Double-clic et glisser-déposer de fichiers continuent de
     * fonctionner sur la carte entière. */
    var cta = MB.i18n ? MB.i18n.t('import.cta') : 'Cliquez pour importer un fichier';
    void el;
    return (
      '<div class="mb-import-card">' +
      '<button class="mb-import-cta" type="button" data-act="import-pick" title="' + esc(cta) + '" aria-label="' + esc(cta) + '">' +
      '<span class="mb-import-icon">' + MB.icons.get('import', 38) + '</span>' +
      '<span class="mb-import-title">' + esc(cta) + '</span>' +
      '</button>' +
      '</div>'
    );
  }

  /* -------------------------------------------------------------- LINK */

  /* v1.10 — carte de lien RELOOKÉE d'après le design fourni :
   *  - section HAUTE blanche : LOGO du site (favicon haute
   *    résolution) + nom du site, centrés ;
   *  - section BASSE sombre (couleur de carte modifiable) : favicon
   *    16 px + URL en gris, TITRE orange vif souligné semibold,
   *    description gris clair ;
   *  - AUCUN chargement ni capture du site : le logo est le favicon
   *    (service public), titre/description viennent des métadonnées
   *    HTML si accessibles (best effort) et restent éditables.
   * La flèche d'ouverture moderne (v1.9) est conservée. */
  function renderLink(el) {
    var d = el.data;
    var letter = (d.title || d.domain || '?').trim().charAt(0).toUpperCase();
    var metaBg = d.bg && d.bg !== 'transparent' ? d.bg : '#2D2D2D';
    var logo = d.preview || (MB.linkPreview ? MB.linkPreview.faviconUrl(d.url) : '');
    var logoHtml = logo
      ? '<img class="mb-link-logo" src="' + esc(logo) + '" alt="" draggable="false"' +
        ' onerror="this.style.display=\'none\'">'
      : '<span class="mb-link-logo mb-link-logo--letter" aria-hidden="true">' + esc(letter) + '</span>';
    var fav = logo
      ? '<img class="mb-link-fav" src="' + esc(logo) + '" alt="" draggable="false">'
      : '<span class="mb-link-fav mb-link-fav--dot" aria-hidden="true"></span>';
    var site = d.site || d.domain || '';
    /* Fond personnalisé clair : le titre passe à un orange foncé
     * lisible (sinon orange vif sur fond sombre, comme l'image). */
    var titleColor = U.readableOn(metaBg) === '#1E1E1E' ? '#B4530A' : '#F97316';
    /* UN SEUL attribut style : couleur + police + graisse du titre. */
    var titleStyle = 'color:' + titleColor + ';';
    if (d.titleFont) titleStyle += "font-family:'" + U.escapeHtml(d.titleFont) + "';";
    if (d.titleWeight) titleStyle += 'font-weight:' + Number(d.titleWeight) + ';';
    return (
      '<div class="mb-link-card">' +
      '<div class="mb-link-hero">' +
      logoHtml +
      '<div class="mb-link-brand">' + esc(site) + '</div>' +
      '</div>' +
      '<div class="mb-link-meta" style="background:' + U.escapeHtml(metaBg) + '">' +
      '<div class="mb-link-url">' + fav + '<span>' + esc(d.url) + '</span></div>' +
      '<div class="mb-link-title mb-editable" data-field="title" style="' + titleStyle + '">' + esc(d.title) + '</div>' +
      '<div class="mb-link-desc mb-editable" data-field="desc">' + esc(d.desc) + '</div>' +
      '</div>' +
      '<button class="mb-link-open" type="button" data-act="open" data-url="' + esc(d.url) +
      '" title="Ouvrir le lien dans le navigateur" aria-label="Ouvrir le lien dans le navigateur">' +
      MB.icons.get('arrowUpRight', 14) +
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

  /* v1.9 — triangle = polygone régulier à N branches (3 par défaut) :
   * 3 = triangle, 4 = losange, 5 = pentagone, 6 = hexagone… 12 = étoile
   * d'angles denses. Les sommets sont répartis sur le cercle inscrit. */
  function polygonPoints(sides) {
    var n = Math.max(3, Math.min(24, parseInt(sides, 10) || 3));
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      pts.push((50 + 48 * Math.cos(a)).toFixed(2) + ',' + (50 + 48 * Math.sin(a)).toFixed(2));
    }
    return pts.join(' ');
  }

  function renderShape(el) {
    var d = el.data;
    var stroke = d.stroke !== 'none' ? ' stroke="' + d.stroke + '" stroke-width="' + d.strokeWidth + '"' : '';
    var body = '';
    if (d.shape === 'ellipse') {
      body = '<ellipse cx="50%" cy="50%" rx="49%" ry="49%" fill="' + d.fill + '"' + stroke + '/>';
    } else if (d.shape === 'triangle') {
      body = '<polygon points="' + polygonPoints(d.sides) + '" fill="' + d.fill + '"' + stroke + '/>';
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

  /* ------------------------------------------------------------ COLUMN */

  /* v1.10 — en-tête et corps séparés : couleur d'EN-TÊTE et couleur
   * de CORPS indépendantes + mise en forme du titre (police, taille,
   * gras, italique, couleur). Les colonnes sont des
   * mini-canvas : les cartes enfants s'y empilent verticalement
   * (cf. store.layoutContainerChildren).
   * v1.12 — l'outil SECTION est retiré : la colonne reste le seul
   * conteneur à pile verticale (les anciennes sections sont migrées
   * en colonnes au chargement — store.loadDocument). */
  function titleStyleOf(d) {
    var st =
      'font-size:' + (d.titleSize || 15) + 'px;' +
      /* v1.18 — graisse du titre explicite sinon le couple gras/normal. */
      'font-weight:' + (d.titleWeight || (d.titleBold ? '700' : '400')) + ';' +
      'font-style:' + (d.titleItalic ? 'italic' : 'normal') + ';';
    if (d.titleFont) st += "font-family:'" + U.escapeHtml(d.titleFont) + "';";
    if (d.titleColor) st += 'color:' + U.escapeHtml(d.titleColor) + ';';
    return st;
  }

  /* v1.11 — titre RICHE : data.titleHtml (sanitisé, issu de la barre
   * de mise en forme) sinon repli texte brut — même mécanique que les
   * corps de notes (richOrPlain). */
  function richOrPlainTitle(d) {
    if (d && typeof d.titleHtml === 'string' && d.titleHtml) {
      return MB.rich ? MB.rich.sanitize(d.titleHtml) : d.titleHtml;
    }
    return esc(d.title || '');
  }

  function renderColumn(el) {
    var d = el.data;
    var headBg = d.headColor && d.headColor !== 'transparent'
      ? ' style="background:' + U.escapeHtml(d.headColor) + '"'
      : '';
    return (
      '<div class="mb-column-box" style="background:' + d.color + '">' +
      '<div class="mb-column-head"' + headBg + '>' +
      '<div class="mb-column-title mb-editable mb-rich" data-field="title" style="' + titleStyleOf(d) + '">' + richOrPlainTitle(d) + '</div>' +
      '</div>' +
      '<div class="mb-column-body"></div>' +
      '</div>'
    );
  }

  /* ------------------------------------------------------------- TABLE */

  /* v1.8 — couleurs et police du tableau : fond de toutes les cellules,
   * de la ligne d'en-têtes, d'une ligne ou d'une colonne précise, couleur
   * du texte + police/taille (demande utilisateur). Résolution par
   * cellule : ligne > colonne > fond général ; l'en-tête garde son fond
   * propre sauf ligne 1 peinte explicitement. */
  function tableCellStyle(d, r, c) {
    var head = d.header && r === 0;
    var bg = '';
    if (d.rowBgs && d.rowBgs[r]) bg = d.rowBgs[r];
    else if (head && d.headBg) bg = d.headBg;
    else if (d.colBgs && d.colBgs[c]) bg = d.colBgs[c];
    else if (d.cellBg) bg = d.cellBg;
    var fg = head ? (d.headColor || '#F5F5F5') : d.textColor || '#F5F5F5';
    var st = 'background:' + bg + ';color:' + fg + ';';
    if (d.fontFamily) st += "font-family:'" + U.escapeHtml(d.fontFamily) + "';";
    if (d.fontSize) st += 'font-size:' + d.fontSize + 'px;';
    /* v1.18 — graisse du texte du tableau (l'en-tête garde son gras CSS). */
    if (d.fontWeight && !head) st += 'font-weight:' + Number(d.fontWeight) + ';';
    return st;
  }

  function renderTable(el) {
    var d = el.data;
    var cells = '';
    for (var r = 0; r < d.rows; r++) {
      for (var c = 0; c < d.cols; c++) {
        var v = (d.cells && d.cells[r] && d.cells[r][c]) || '';
        var head = d.header && r === 0;
        cells +=
          '<div class="mb-table-cell' + (head ? ' mb-table-cell--head' : '') +
          '" data-cell="' + r + '-' + c + '" style="' + tableCellStyle(d, r, c) + '">' + esc(v) + '</div>';
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
    /* v1.10 — couleur de carte : l'encre s'adapte (titre + tâches).
     * UN SEUL attribut style par élément (police + taille + encre). */
    var cardBg = d.color && d.color !== 'transparent' ? d.color : '';
    var ink = cardBg ? U.readableOn(cardBg) : '';
    var fSize = d.fontSize ? 'font-size:' + d.fontSize + 'px;' : '';
    /* v1.18 — graisse de la police de la checklist (titre + tâches). */
    var fWeight = d.fontWeight ? 'font-weight:' + Number(d.fontWeight) + ';' : '';
    var fStyleTitle = fSize + fWeight;
    if (d.fontFamily) fStyleTitle += "font-family:'" + U.escapeHtml(d.fontFamily) + "';";
    if (ink) fStyleTitle += 'color:' + ink + ';';
    var fStyleItem = fWeight;
    if (d.fontFamily) fStyleItem += "font-family:'" + U.escapeHtml(d.fontFamily) + "';";
    if (ink) fStyleItem += 'color:' + ink + ';';
    for (var i = 0; i < d.items.length; i++) {
      var it = d.items[i];
      if (it.done) doneCount++;
      /* v1.17 — CROIX de suppression par tâche : invisible au repos,
       * révélée au survol de la ligne, rouge au survol d'elle-même. */
      rows +=
        '<div class="mb-check-item' + (it.done ? ' is-done' : '') + '">' +
        '<button class="mb-check-box" data-act="toggle" data-item="' + it.id + '" role="checkbox" ' +
        'aria-checked="' + (it.done ? 'true' : 'false') + '" aria-label="Terminer"></button>' +
        '<span class="mb-check-text mb-editable" data-field="item" data-item="' + it.id + '"' +
        (fStyleItem ? ' style="' + fStyleItem + '"' : '') + '>' + esc(it.text) + '</span>' +
        '<button class="mb-check-del" data-act="del-item" data-item="' + it.id + '"' +
        ' title="Supprimer la tâche" aria-label="Supprimer la tâche">&times;</button>' +
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
      '<div class="mb-check-card"' +
      (fSize || cardBg
        ? ' style="' + fSize + (cardBg ? 'background:' + U.escapeHtml(cardBg) + ';' : '') +
          (ink ? '--mb-check-ink:' + ink + ';' : '') + '"'
        : '') +
      '>' +
      '<div class="mb-check-title mb-editable" data-field="title"' +
      (fStyleTitle ? ' style="' + fStyleTitle + '"' : '') + '>' + esc(d.title) + '</div>' +
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

  /* ------------------------------------------------------- ASSIGNEES */

  /* v1.11 — carte Assignees (port Bencho) : la pastille + la liste
   * sont rendues par ui/assignees.js (le composant garde ses
   * commentaires d'origine — tout le « pourquoi » des nombres y
   * vit). Ici, seul le branchement du moteur. */
  function renderAssignees(el) {
    return MB.ui.assignees ? MB.ui.assignees.render(el) : '';
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
    column: renderColumn,
    table: renderTable,
    checklist: renderChecklist,
    sketch: renderSketch,
    board: renderBoard,
    group: renderGroup,
    import: renderImport,
    assignees: renderAssignees
  };

  /* Autodimensionnement après montage. */
  function afterMount(view, el) {
    /* v1.10 — LIEN : enrichissement léger en arrière-plan — favicon
     * (logo) + métadonnées og:title / og:description si la page est
     * accessible. JAMAIS de chargement ni de capture du site : la
     * carte est complète dès la pose (titre du lien, domaine, URL) et
     * les infos ne font que s'améliorer (une tentative par URL). */
    if (el.type === 'link' && MB.linkPreview && !el.locked) {
      if ((!el.data.preview || !el.data.site) && el._pvUrl !== el.data.url) {
        el._pvUrl = el.data.url;
        setTimeout(function () {
          var live = MB.store.el(el.id);
          if (live && live.type === 'link' && live.data.url === el.data.url) {
            MB.linkPreview.applyToElement(live);
          }
        }, 250);
      }
    }

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
      note: el.data.autoH !== false,
      checklist: el.data.autoH !== false,
      comment: el.data.autoH !== false,
      /* v1.17 — TABLEAU à hauteur vivante : un texte long qui passe sur
       * plusieurs lignes dans une cellule fait grandir la carte au lieu
       * d'être coupé (même mécanique que notes/checklist). */
      table: true
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
   * valeur attendue pour el.h.
   * v1.8 — autoH (coupé par un redimensionnement manuel) est respecté
   * pour TOUS les types à hauteur vivante : la taille choisie par
   * l'utilisateur n'est plus écrasée au prochain re-rendu. */
  function applyAutoHeight(view, el) {
    var autoTypes = {
      text: el.data.autoH !== false,
      note: el.data.autoH !== false,
      checklist: el.data.autoH !== false,
      comment: el.data.autoH !== false,
      table: true /* v1.17 — le tableau suit son contenu */
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
    afterMount: afterMount,
    /* v1.9 — réutilisé par l'export SVG (polygones réguliers). */
    polygonPoints: polygonPoints,
    /* v1.19 — taille effective du titre (dédiée ou dérivée), pour
     * l'inspecteur (affichage du stepper) et les exports. */
    titleFontSizeOf: titleFontSizeOf
  };
})();

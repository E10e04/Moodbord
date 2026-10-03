/* =========================================================================
 * export.js — Export du board.
 *
 * SVG : sérialisation vectorielle fidèle des éléments (ouvrable dans
 *       Illustrator — c'est aussi le chemin d'envoi vers l'hôte).
 * PNG : rasterisation du SVG via canvas (échelle 2×).
 *       Représentation texte simplifiée (pas de rendu HTML exact).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  function esc(s) {
    return U.escapeHtml(s);
  }

  function visibleElements(only) {
    var st = MB.store.s();
    if (only && only.length) return only.filter(function (e) {
      return !e.hidden;
    });
    return st.elements.filter(function (e) {
      return !e.hidden;
    });
  }

  function sortForExport(list) {
    // ordre de peinture = ordre du tableau, parents avant enfants
    return list.slice().sort(function (a, b) {
      return MB.store.s().elements.indexOf(a) - MB.store.s().elements.indexOf(b);
    });
  }

  function multiLineText(x, y, text, attrs, lineHeight) {
    var lines = String(text === undefined || text === null ? '' : text).split('\n');
    var out = '';
    var lh = lineHeight || 1.3;
    for (var i = 0; i < lines.length; i++) {
      out += '<text x="' + U.round(x, 1) + '" y="' + U.round(y + i * lh, 1) + '" ' + attrs + '>' + esc(lines[i]) + '</text>';
    }
    return out;
  }

  function elementSvg(el) {
    var d = el.data || {};
    var t = '';

    function rotAttr() {
      if (!el.rotation) return '';
      return ' transform="rotate(' + el.rotation + ' ' + U.round(el.x + el.w / 2, 1) + ' ' + U.round(el.y + el.h / 2, 1) + ')"';
    }

    switch (el.type) {
      case 'section':
        t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
          '" rx="16" fill="' + d.color + '" stroke="#3A3A3A" stroke-width="1"/>' +
          (d.headColor && d.headColor !== 'transparent'
            ? '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + ((d.titleSize || 15) + 26) +
              '" rx="16" fill="' + d.headColor + '"/><rect x="' + el.x + '" y="' + (el.y + (d.titleSize || 15) + 12) +
              '" width="' + el.w + '" height="14" fill="' + d.headColor + '"/>'
            : '') +
          multiLineText(el.x + 16, el.y + (d.titleSize || 15) + 12, d.title, 'font-family="' + esc(d.titleFont || 'Georgia') + '" font-size="' + (d.titleSize || 15) + '" font-weight="' + (d.titleBold ? '700' : '400') + '" font-style="' + (d.titleItalic ? 'italic' : 'normal') + '" fill="' + (d.titleColor || '#A8A8A8') + '"', 20);
        break;

      case 'column':
        t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
          '" rx="14" fill="' + d.color + '" stroke="#3A3A3A" stroke-width="1"/>' +
          (d.headColor && d.headColor !== 'transparent'
            ? '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + ((d.titleSize || 15) + 26) +
              '" rx="14" fill="' + d.headColor + '"/><rect x="' + el.x + '" y="' + (el.y + (d.titleSize || 15) + 12) +
              '" width="' + el.w + '" height="14" fill="' + d.headColor + '"/>'
            : '') +
          multiLineText(el.x + 14, el.y + (d.titleSize || 15) + 10, d.title, 'font-family="' + esc(d.titleFont || 'Georgia') + '" font-size="' + (d.titleSize || 14) + '" font-weight="' + (d.titleBold ? '700' : '400') + '" font-style="' + (d.titleItalic ? 'italic' : 'normal') + '" fill="' + (d.titleColor || '#A8A8A8') + '"', 18);
        break;

      case 'image': {
        var href = d.src || '';
        if (href && href.indexOf('data:') !== 0) {
          href = MB.exportState.resolved[href] || '';
        }
        if (href) {
          t = '<image x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
            '" preserveAspectRatio="xMidYMid ' + (d.fit === 'contain' ? 'slice' : 'slice') +
            '" xlink:href="' + href + '" href="' + href + '"' + rotAttr() + '/>';
        } else {
          t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
            '" fill="#2C2C2C" stroke="#3A3A3A"' + rotAttr() + '/>';
        }
        break;
      }

      case 'text': {
        var deco = [];
        if (d.underline) deco.push('underline');
        if (d.strike) deco.push('line-through');
        var a = 'font-family="' + esc(d.fontFamily) + '" font-size="' + d.fontSize +
          '" font-weight="' + (d.bold ? '700' : '400') +
          '" font-style="' + (d.italic ? 'italic' : 'normal') + '"' +
          (deco.length ? ' text-decoration="' + deco.join(' ') + '"' : '') +
          ' fill="' + d.color + '"';
        var anchor = d.align === 'center' ? ' text-anchor="middle"' : d.align === 'right' ? ' text-anchor="end"' : '';
        var x = d.align === 'center' ? el.x + el.w / 2 : d.align === 'right' ? el.x + el.w : el.x + 4;
        t = multiLineText(x, el.y + d.fontSize, d.text, a + anchor, d.fontSize * d.lineHeight) + rotAttrWrap(rotAttr());
        break;
      }

      case 'note': {
        var ink = U.readableOn(d.color);
        var noteFont = d.fontFamily || 'Georgia';
        t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
          '" rx="4" fill="' + d.color + '"' + rotAttr() + '/>' +
          multiLineText(el.x + 14, el.y + 24, d.text, 'font-family="' + esc(noteFont) + '" font-size="' + d.fontSize + '" fill="' + ink + '"', d.fontSize * 1.4);
        break;
      }

      case 'comment': {
        var ink2 = '#F5F5F5';
        var cmFont = d.fontFamily || 'Georgia';
        t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
          '" rx="10" fill="#2C2C2C" stroke="' + d.color + '" stroke-width="2"' + rotAttr() + '/>' +
          multiLineText(el.x + 12, el.y + 20, d.author, 'font-family="' + esc(cmFont) + '" font-size="11" font-weight="700" fill="' + d.color + '"', 14) +
          multiLineText(el.x + 12, el.y + 38, d.text, 'font-family="' + esc(cmFont) + '" font-size="' + (d.fontSize || 13) + '" fill="' + ink2 + '"', 17);
        break;
      }

      case 'color':
        t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + (el.h - 44) +
          '" rx="8" fill="' + d.hex + '"/>' +
          '<rect x="' + el.x + '" y="' + (el.y + el.h - 44) + '" width="' + el.w + '" height="44" fill="#252525"/>' +
          multiLineText(el.x + 8, el.y + el.h - 28, d.name, 'font-family="Georgia" font-size="12" fill="#F5F5F5"', 15) +
          multiLineText(el.x + 8, el.y + el.h - 11, String(d.hex).toUpperCase(), 'font-family="Menlo, monospace" font-size="11" fill="#A8A8A8"', 13);
        break;

      case 'palette': {
        t = multiLineText(el.x + 4, el.y + 18, d.name, 'font-family="Georgia" font-size="13" font-weight="700" fill="#F5F5F5"', 16);
        var y = el.y + 30;
        for (var i = 0; i < d.colors.length; i++) {
          var c = d.colors[i];
          t += '<rect x="' + el.x + '" y="' + y + '" width="' + el.w + '" height="26" rx="4" fill="#252525"/>' +
            '<rect x="' + el.x + '" y="' + y + '" width="26" height="26" rx="4" fill="' + c.hex + '"/>' +
            multiLineText(el.x + 36, y + 17, c.name + ' — ' + String(c.hex).toUpperCase(), 'font-family="Georgia" font-size="11" fill="#F5F5F5"', 14);
          y += 36;
        }
        break;
      }

      case 'typography': {
        t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
          '" rx="10" fill="#252525"/>' +
          multiLineText(el.x + 14, el.y + 26, d.fontFamily, 'font-family=\'' + esc(d.fontFamily) + '\' font-size="15" font-weight="700" fill="#F5F5F5"', 19);
        var yy = el.y + 84;
        for (var s = 0; s < d.sizes.length; s++) {
          t += multiLineText(el.x + 14, yy, d.sampleText, 'font-family=\'' + esc(d.fontFamily) + '\' font-size="' + d.sizes[s] + '" fill="#E8E8E8"', d.sizes[s] * 1.3);
          yy += d.sizes[s] * 1.3 + 8;
        }
        break;
      }

      /* v1.10 — carte de lien portrait (design fourni) : hero blanc
       * avec le LOGO du site + nom, zone d'infos sombre avec favicon,
       * URL grise, titre orange souligné et description. Aucune
       * capture — le logo est le favicon (URL directe). */
      case 'link': {
        var lBg = d.bg && d.bg !== 'transparent' ? d.bg : '#2D2D2D';
        var heroH = Math.round(el.h * 0.52);
        var metaY = el.y + heroH;
        var lFav = d.preview || (MB.linkPreview ? MB.linkPreview.faviconUrl(d.url) : '');
        var lSite = d.site || d.domain || '';
        t =
          '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
          '" rx="12" fill="' + lBg + '" stroke="#3A3A3A"' + rotAttr() + '/>' +
          '<clipPath id="lhero' + el.id.replace(/[^a-z0-9]/gi, '') + '"><rect x="' + (el.x + 1) + '" y="' + (el.y + 1) +
          '" width="' + (el.w - 2) + '" height="' + heroH + '" rx="11"/></clipPath>' +
          '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + heroH +
          '" fill="#FFFFFF" clip-path="url(#lhero' + el.id.replace(/[^a-z0-9]/gi, '') + ')"/>';
        if (lFav) {
          t +=
            '<image x="' + (el.x + el.w / 2 - 54) + '" y="' + (el.y + heroH / 2 - 26) +
            '" width="52" height="52" preserveAspectRatio="xMidYMid meet"' +
            ' xlink:href="' + lFav + '" href="' + lFav + '"/>' +
            '<text x="' + (el.x + el.w / 2 + 8) + '" y="' + (el.y + heroH / 2 + 7) +
            '" font-family="Georgia" font-size="17" font-weight="600" fill="#3C4043">' +
            esc(String(lSite).slice(0, 18)) + '</text>';
        } else {
          t +=
            '<text x="' + (el.x + el.w / 2) + '" y="' + (el.y + heroH / 2 + 8) +
            '" text-anchor="middle" font-family="Georgia" font-size="26" font-weight="700" fill="#3C4043">' +
            esc(String(lSite || '?').slice(0, 22)) + '</text>';
        }
        var urlY = metaY + 22;
        if (lFav) {
          t +=
            '<image x="' + (el.x + 16) + '" y="' + (urlY - 11) + '" width="16" height="16"' +
            ' xlink:href="' + lFav + '" href="' + lFav + '"/>' +
            '<text x="' + (el.x + 38) + '" y="' + urlY + '" font-family="Georgia" font-size="11" fill="#9CA3AF">' +
            esc(String(d.url).slice(0, 42)) + '</text>';
        } else {
          t +=
            '<text x="' + (el.x + 16) + '" y="' + urlY + '" font-family="Georgia" font-size="11" fill="#9CA3AF">' +
            esc(String(d.url).slice(0, 42)) + '</text>';
        }
        var lTitleColor = U.readableOn(lBg) === '#1E1E1E' ? '#B4530A' : '#F97316';
        t +=
          multiLineText(el.x + 16, urlY + 22, d.title, 'font-family="' + esc(d.titleFont || 'Georgia') + '" font-size="14" font-weight="600" text-decoration="underline" fill="' + lTitleColor + '"', 17) +
          (d.desc
            ? multiLineText(el.x + 16, urlY + 44, String(d.desc).slice(0, 130), 'font-family="Georgia" font-size="11.5" fill="#E5E7EB"', 15)
            : '') +
          '<path d="M' + (el.x + el.w - 20) + ' ' + (el.y + el.h - 19) + ' L' + (el.x + el.w - 10) + ' ' + (el.y + el.h - 29) +
          '" stroke="#4C8DFF" stroke-width="2" stroke-linecap="round" fill="none"/>' +
          '<path d="M' + (el.x + el.w - 19) + ' ' + (el.y + el.h - 29) + ' h-9 v9" stroke="#4C8DFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
        break;
      }

      case 'file':
        t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
          '" rx="10" fill="#252525" stroke="#3A3A3A"/>' +
          multiLineText(el.x + 58, el.y + 30, d.name, 'font-family="Georgia" font-size="13" fill="#F5F5F5"', 16) +
          multiLineText(el.x + 58, el.y + 50, d.kind || '', 'font-family="Georgia" font-size="11" fill="#A8A8A8"', 14) +
          '<rect x="' + (el.x + 10) + '" y="' + (el.y + 17) + '" width="36" height="36" rx="8" fill="#3A3A3A"/>';
        break;

      case 'shape': {
        var stroke = d.stroke !== 'none' ? ' stroke="' + d.stroke + '" stroke-width="' + d.strokeWidth + '"' : '';
        if (d.shape === 'ellipse') {
          t = '<ellipse cx="' + (el.x + el.w / 2) + '" cy="' + (el.y + el.h / 2) + '" rx="' + (el.w / 2) + '" ry="' + (el.h / 2) + '" fill="' + d.fill + '"' + stroke + rotAttr() + '/>';
        } else if (d.shape === 'triangle') {
          /* v1.9 — polygone régulier à N branches (3 = triangle…). */
          var n = Math.max(3, Math.min(24, parseInt(d.sides, 10) || 3));
          var ptsS = [];
          for (var si = 0; si < n; si++) {
            var sa = -Math.PI / 2 + (2 * Math.PI * si) / n;
            ptsS.push(
              U.round(el.x + el.w / 2 + ((el.w / 2 - 1) * Math.cos(sa)), 1) + ',' +
              U.round(el.y + el.h / 2 + ((el.h / 2 - 1) * Math.sin(sa)), 1)
            );
          }
          t = '<polygon points="' + ptsS.join(' ') + '" fill="' + d.fill + '"' + stroke + rotAttr() + '/>';
        } else {
          t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h + '" rx="' + (d.radius || 0) +
            '" fill="' + d.fill + '"' + stroke + rotAttr() + '/>';
        }
        break;
      }

      case 'line': {
        var dash = d.style === 'dashed' ? ' stroke-dasharray="10 8"' : d.style === 'dotted' ? ' stroke-dasharray="1.5 7"' : '';
        t = '<line x1="' + d.x1 + '" y1="' + d.y1 + '" x2="' + d.x2 + '" y2="' + d.y2 + '" stroke="' + d.color + '" stroke-width="' + d.thickness + '"' + dash + '/>';
        function arrow(x, y, tx, ty) {
          var ang = Math.atan2(y - ty, x - tx);
          var size = 6 + d.thickness * 1.6;
          var p1 = x + ',' + y;
          var p2 = (x - Math.cos(ang + 0.42) * size) + ',' + (y - Math.sin(ang + 0.42) * size);
          var p3 = (x - Math.cos(ang - 0.42) * size) + ',' + (y - Math.sin(ang - 0.42) * size);
          return '<polygon points="' + p1 + ' ' + p2 + ' ' + p3 + '" fill="' + d.color + '"/>';
        }
        if (d.startArrow) t += arrow(d.x1, d.y1, d.x2, d.y2);
        if (d.endArrow) t += arrow(d.x2, d.y2, d.x1, d.y1);
        if (d.label) {
          t += multiLineText((d.x1 + d.x2) / 2, (d.y1 + d.y2) / 2 - 8, d.label, 'font-family="Georgia" font-size="12" text-anchor="middle" fill="#F5F5F5"', 15);
        }
        break;
      }

      case 'checklist': {
        var ckFont = d.fontFamily || 'Georgia';
        /* v1.10 — couleur de carte : l'encre s'adapte. */
        var ckBg = d.color && d.color !== 'transparent' ? d.color : '#252525';
        var ckInk = U.readableOn(ckBg);
        t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h + '" rx="10" fill="' + ckBg + '"/>' +
          multiLineText(el.x + 14, el.y + 24, d.title, 'font-family="' + esc(ckFont) + '" font-size="14" font-weight="700" fill="' + ckInk + '"', 18);
        var ry = el.y + 46;
        for (var k = 0; k < d.items.length; k++) {
          var it = d.items[k];
          t += '<rect x="' + (el.x + 14) + '" y="' + ry + '" width="16" height="16" rx="4" fill="' + (it.done ? '#4C8DFF' : 'none') + '" stroke="#5A5A5A" stroke-width="1.5"/>';
          if (it.done) {
            t += '<path d="M' + (el.x + 18) + ' ' + (ry + 8) + ' l3 3 l5 -6" stroke="#fff" stroke-width="2" fill="none"/>';
          }
          t += multiLineText(el.x + 42, ry + 12, it.text, 'font-family="' + esc(ckFont) + '" font-size="' + (d.fontSize || 13) + '" fill="' + (it.done ? '#A8A8A8' : ckInk) + '"' + (it.done ? ' text-decoration="line-through"' : ''), 16);
          ry += 38;
        }
        break;
      }

      case 'table': {
        var colW = el.w / d.cols;
        var rowH = el.h / d.rows;
        var tbFont = d.fontFamily || 'Georgia';
        var tbSize = d.fontSize || 12;
        for (var r = 0; r < d.rows; r++) {
          for (var c2 = 0; c2 < d.cols; c2++) {
            var v = (d.cells[r] && d.cells[r][c2]) || '';
            var head = d.header && r === 0;
            /* v1.8 — mêmes règles de résolution que le canvas : ligne >
             * en-tête > colonne > fond général. */
            var bg;
            if (d.rowBgs && d.rowBgs[r]) bg = d.rowBgs[r];
            else if (head && d.headBg) bg = d.headBg;
            else if (d.colBgs && d.colBgs[c2]) bg = d.colBgs[c2];
            else bg = d.cellBg || '#252525';
            var fg = head ? (d.headColor || '#F5F5F5') : d.textColor || '#F5F5F5';
            t += '<rect x="' + (el.x + c2 * colW) + '" y="' + (el.y + r * rowH) + '" width="' + colW + '" height="' + rowH +
              '" fill="' + bg + '" stroke="#1E1E1E"/>';
            t += multiLineText(el.x + c2 * colW + 8, el.y + r * rowH + rowH / 2 + 4, v, 'font-family="' + esc(tbFont) + '" font-size="' + tbSize + '" fill="' + fg + '"' + (head ? ' font-weight="700"' : ''), 15);
          }
        }
        break;
      }

      /* v1.8 — carte d'import : station de dépôt (mêmes pointillés). */
      case 'import': {
        var cxI = el.x + el.w / 2;
        var cyI = el.y + el.h / 2;
        t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
          '" rx="12" fill="rgba(30,30,30,0.45)" stroke="#4A4A4A" stroke-width="1.5" stroke-dasharray="7 5"/>' +
          '<text x="' + cxI + '" y="' + (cyI - 10) + '" text-anchor="middle" font-family="Georgia" font-size="26" fill="#9A9A9A">\u2193</text>' +
          multiLineText(cxI, cyI + 14, d.title || 'Importer des médias', 'font-family="Georgia" font-size="13" font-weight="700" fill="#F5F5F5" text-anchor="middle"', 16);
        break;
      }

      case 'sketch': {
        var pts = d.points.map(function (p) {
          return U.round(el.x + p[0] * el.w, 1) + ',' + U.round(el.y + p[1] * el.h, 1);
        });
        t = '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + d.color + '" stroke-width="' + d.thickness + '" stroke-linecap="round" stroke-linejoin="round"/>';
        break;
      }

      case 'group':
        t = '';
        break;

      /* v1.6 — planche liée : carte résumée ; le contenu de la planche ne
       * se déplie pas dans l'export SVG.
       * v1.7 — design aligné sur la carte du canvas : nom centré au
       * MILIEU de la grande zone principale (au-dessus de la barre du
       * bas), compteur en bas à gauche, flèche d'ouverture bleue en bas
       * à droite (niveau de l'ancien libellé « → planche »). */
      case 'board': {
        var bCount = d && d.doc && Array.isArray(d.doc.elements) ? d.doc.elements.length : 0;
        var footH = 34; /* hauteur de la barre du bas à l'échelle du SVG */
        var bodyCy = el.y + Math.max(18, (el.h - footH) / 2);
        var bdFont = d.titleFont || 'Georgia';
        t =
          '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
          '" rx="12" fill="#232323" stroke="#3A3A3A" stroke-width="1.5"' + rotAttr() + '/>' +
          multiLineText(el.x + el.w / 2, bodyCy, d.title || 'Planche', 'font-family="' + esc(bdFont) + '" font-size="16" font-weight="700" fill="#F5F5F5" text-anchor="middle"', 19) +
          '<line x1="' + (el.x + 1) + '" y1="' + (el.y + el.h - footH) + '" x2="' + (el.x + el.w - 1) + '" y2="' + (el.y + el.h - footH) + '" stroke="#2E2E2E" stroke-width="1"/>' +
          multiLineText(el.x + 12, el.y + el.h - 12, bCount + ' élément' + (bCount > 1 ? 's' : ''), 'font-family="Georgia" font-size="11" fill="#B4B4B4"', 14) +
          '<text x="' + (el.x + el.w - 28) + '" y="' + (el.y + el.h - 13) + '" font-family="Georgia" font-size="16" font-weight="700" fill="#4C8DFF">\u2192</text>';
        break;
      }
    }
    return t;
  }

  function rotAttrWrap(rot) {
    return rot;
  }

  /* Résout les src relatives (assets démo) en data URLs. */
  function resolveAssets(list) {
    var st = MB.exportState;
    st.resolved = {};
    var jobs = [];
    list.forEach(function (el) {
      if (el.type === 'image' && el.data.src && el.data.src.indexOf('data:') !== 0) {
        var src = el.data.src;
        jobs.push(
          fetch(src)
            .then(function (r) {
              return r.blob();
            })
            .then(function (b) {
              return new Promise(function (resolve) {
                var fr = new FileReader();
                fr.onload = function () {
                  st.resolved[src] = String(fr.result);
                  resolve();
                };
                fr.readAsDataURL(b);
              });
            })
            .catch(function () {
              /* image ignorée */
            })
        );
      }
    });
    return Promise.all(jobs);
  }

  function buildSvg(only, opts) {
    var o = opts || {};
    var list = sortForExport(visibleElements(only));
    var bbox = MB.store.bboxOfMany(list);
    /* v1.9 — mode miniature : cadrage serré + fond dédié (les cartes de
     * l'écran d'accueil gagnent en lisibilité, le contenu remplit la
     * vignette au lieu de flotter dans une marge terne). */
    var pad = o.pad !== undefined ? o.pad : 60;
    var bg = o.background || '#1E1E1E';
    var W = Math.max(10, Math.ceil(bbox.w + pad * 2));
    var H = Math.max(10, Math.ceil(bbox.h + pad * 2));
    /* v1.10 — fitRatio : élargit le cadre (letterbox centré) au ratio
     * exact de la miniature — le contenu remplit le cadre SANS
     * déformation ni recadrage. */
    var vbX = bbox.x - pad;
    var vbY = bbox.y - pad;
    if (o.fitRatio) {
      var cur = W / H;
      if (cur < o.fitRatio) {
        var newW = Math.ceil(H * o.fitRatio);
        vbX -= (newW - W) / 2;
        W = newW;
      } else {
        var newH = Math.ceil(W / o.fitRatio);
        vbY -= (newH - H) / 2;
        H = newH;
      }
    }
    var body = '';
    for (var i = 0; i < list.length; i++) {
      body += elementSvg(list[i]);
    }
    var svg =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
      'width="' + W + '" height="' + H + '" viewBox="' + U.round(vbX, 1) + ' ' +
      U.round(vbY, 1) + ' ' + W + ' ' + H + '">\n' +
      '<rect x="' + U.round(vbX, 1) + '" y="' + U.round(vbY, 1) + '" width="' + W + '" height="' + H + '" fill="' + bg + '"/>\n' +
      body + '\n</svg>';
    return { svg: svg, w: W, h: H };
  }

  function safeName() {
    var n = (MB.store.s().project.name || 'moodboard').trim().replace(/[\\/:*?"<>|]+/g, '-');
    return n || 'moodboard';
  }

  function exportSvg(only) {
    resolveAssets(visibleElements(only)).then(function () {
      var out = buildSvg(only);
      if (MB.storage.isCep() || MB.storage.isDesktop()) {
        MB.storage.pickSavePath('Exporter en SVG', safeName() + '.svg', 'svg').then(function (target) {
          if (!target) return;
          var w = MB.storage.writeText(target, out.svg);
          if (w.error) MB.ui.toast(w.error, 'error');
          else MB.ui.toast('SVG exporté', 'success');
        });
      } else {
        MB.storage.downloadFile(safeName() + '.svg', out.svg, 'image/svg+xml');
        MB.ui.toast('SVG exporté', 'success');
      }
    });
  }

  function exportPng(only) {
    resolveAssets(visibleElements(only)).then(function () {
      var out = buildSvg(only);
      var scale = 2;
      var blob = new Blob([out.svg], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = Math.min(6000, out.w * scale);
        canvas.height = Math.min(6000, out.h * scale);
        var k = Math.min(canvas.width / out.w, canvas.height / out.h);
        var ctx = canvas.getContext('2d');
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        try {
          var dataUrl = canvas.toDataURL('image/png');
          if (dataUrl.length < 100) throw new Error('rasterisation vide');
          if (MB.storage.isCep() || MB.storage.isDesktop()) {
            MB.storage.pickSavePath('Exporter en PNG', safeName() + '.png', 'png').then(function (target) {
              if (!target) return;
              var b64 = dataUrl.split(',')[1];
              var w = MB.storage.writeFileAny(target, b64, 'Base64');
              if (!w || w.err !== 0) MB.ui.toast('Écriture impossible (' + (w && w.err) + ')', 'error');
              else MB.ui.toast('PNG exporté', 'success');
            });
          } else {
            var a = document.createElement('a');
            a.href = dataUrl;
            a.download = safeName() + '.png';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
              a.remove();
            }, 400);
            MB.ui.toast('PNG exporté', 'success');
          }
        } catch (err) {
          MB.ui.toast('Export PNG impossible dans ce contexte — utilisez l’export SVG.', 'error');
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        MB.ui.toast('Rastérisation impossible — utilisez l’export SVG.', 'error');
      };
      img.src = url;
    });
  }

  /* v1.10 — ÉLÉMENT HÉROS de la miniature : la carte d'accueil montre
   * UN seul contenu du moodboard (pas le tableau entier rapetissé —
   * c'était flou). Priorité au contenu le plus visuel, puis au plus
   * grand ; les conteneurs vides ne sont jamais choisis. */
  function pickHero(list) {
    var RANK = {
      image: 0, note: 1, link: 2, palette: 3, color: 4, shape: 5,
      typography: 6, checklist: 7, table: 8, board: 9, file: 10,
      text: 11, comment: 12, sketch: 13
    };
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.type === 'section' || e.type === 'column' || e.type === 'group' || e.type === 'import') continue;
      var rank = RANK[e.type];
      if (rank === undefined) continue;
      if (e.type === 'image' && !(e.data && e.data.src)) continue;
      var b = MB.store.bboxOf(e);
      var score = (20 - rank) * 1e6 + b.w * b.h;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  /* Miniature du tableau courant (JPEG data URL) — alimente les cartes de
   * l'écran d'accueil après chaque enregistrement. Best effort : tout échec
   * appelle cb('') et la carte utilisera son motif par défaut.
   * v1.10 — UN SEUL ÉLÉMENT HÉROS, rendu PLEIN CADRE au ratio exact de
   * la vignette à haute résolution (640×400) : net et lisible, là où
   * l'ancien tableau entier réduit paraissait flou. */
  function thumbnail(maxW, maxH, cb) {
    var done = false;
    function finish(v) {
      if (done) return;
      done = true;
      cb(v || '');
    }
    var list = visibleElements(null);
    var hero = pickHero(list);
    resolveAssets(list).then(function () {
      var out;
      try {
        out = hero
          ? buildSvg([hero], { pad: 14, background: '#2A2926', fitRatio: maxW / maxH })
          : buildSvg(null, { pad: 24, background: '#2A2926', fitRatio: maxW / maxH });
      } catch (e) {
        finish('');
        return;
      }
      if (!out || !out.w || !out.h) {
        finish('');
        return;
      }
      var w = maxW;
      var h = maxH;
      var blob = new Blob([out.svg], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.fillStyle = '#2A2926';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          finish(dataUrl && dataUrl.length > 300 ? dataUrl : '');
        } catch (e) {
          finish('');
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        finish('');
      };
      img.src = url;
    }).catch(function () {
      finish('');
    });
  }

  MB.exportState = { resolved: {} };

  MB.exporter = {
    exportSvg: exportSvg,
    exportPng: exportPng,
    thumbnail: thumbnail,
    pickHero: pickHero,
    buildSvg: function (only, opts) {
      return buildSvg(only, opts);
    }
  };
})();

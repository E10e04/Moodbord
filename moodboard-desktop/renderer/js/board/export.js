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

  /* v1.18.1 — rect aux coins arrondis D'UN SEUL CÔTÉ (l'astuce des
   * deux rects de même fill déjà utilisée pour les en-têtes de
   * colonnes, sans <path> fragile) : side 'top' = coins supérieurs
   * arrondis et base CARRÉE, side 'bottom' = sommet CARRÉ et coins
   * inférieurs arrondis. extra porte l'attribut transform éventuel. */
  function halfRoundRect(x, y, w, h, r, fill, side, extra) {
    if (h <= 0 || w <= 0) return '';
    r = Math.max(0, Math.min(r, h / 2, w / 2));
    var a = extra || '';
    if (side === 'top') {
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + U.round(Math.min(h, r * 2), 1) +
        '" rx="' + r + '" fill="' + fill + '"' + a + '/>' +
        (h > r ? '<rect x="' + x + '" y="' + U.round(y + r, 1) + '" width="' + w + '" height="' + U.round(h - r, 1) +
          '" fill="' + fill + '"' + a + '/>' : '');
    }
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + U.round(h - r, 1) +
      '" fill="' + fill + '"' + a + '/>' +
      '<rect x="' + x + '" y="' + U.round(y + h - r * 2, 1) + '" width="' + w + '" height="' + U.round(Math.min(h, r * 2), 1) +
      '" rx="' + r + '" fill="' + fill + '"' + a + '/>';
  }

  function elementSvg(el) {
    var d = el.data || {};
    var t = '';

    function rotAttr() {
      if (!el.rotation) return '';
      return ' transform="rotate(' + el.rotation + ' ' + U.round(el.x + el.w / 2, 1) + ' ' + U.round(el.y + el.h / 2, 1) + ')"';
    }

    switch (el.type) {
      case 'column':
        t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
          '" rx="14" fill="' + d.color + '" stroke="#3A3A3A" stroke-width="1"/>' +
          (d.headColor && d.headColor !== 'transparent'
            ? '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + ((d.titleSize || 15) + 26) +
              '" rx="14" fill="' + d.headColor + '"/><rect x="' + el.x + '" y="' + (el.y + (d.titleSize || 15) + 12) +
              '" width="' + el.w + '" height="14" fill="' + d.headColor + '"/>'
            : '') +
          multiLineText(el.x + 14, el.y + (d.titleSize || 15) + 10, d.title, 'font-family="' + esc(d.titleFont || 'Georgia') + '" font-size="' + (d.titleSize || 14) + '" font-weight="' + (d.titleWeight || (d.titleBold ? '700' : '400')) + '" font-style="' + (d.titleItalic ? 'italic' : 'normal') + '" fill="' + (d.titleColor || '#A8A8A8') + '"', 18);
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

      case 'gallery': {
        /* v1.20.1 — GALERIE en rangées justifiées : la grille EXACTE du
         * canvas (layout partagé MB.content.galleryLayout, cellules
         * x/y/w/h au rapport de chaque image — aucun recadrage),
         * chaque vignette clippée en rect arrondi. */
        var galItems = Array.isArray(d.items) ? d.items : [];
        if (galItems.length && MB.content && MB.content.galleryLayout) {
          var GL = MB.content.galleryLayout(el.w, galItems);
          var gpad = 10;
          var gDefs = '', gImgs = '';
          for (var gi = 0; gi < GL.cells.length; gi++) {
            var gc = GL.cells[gi];
            if (!gc.item || !gc.item.src) continue;
            var gsrc = gc.item.src;
            if (gsrc.indexOf('data:') !== 0) {
              gsrc = (MB.exportState && MB.exportState.resolved &&
                MB.exportState.resolved[gsrc]) || '';
            }
            if (!gsrc) continue;
            var gx = el.x + gpad + gc.x;
            var gy = el.y + gpad + gc.y;
            var gw = gc.w;
            var gh = gc.h;
            var gcid = 'galc-' + String(el.id).replace(/[^a-zA-Z0-9_-]/g, '') + '-' + gi;
            gDefs += '<clipPath id="' + gcid + '"><rect x="' + gx + '" y="' + gy +
              '" width="' + gw + '" height="' + gh + '" rx="6"/></clipPath>';
            gImgs += '<image x="' + gx + '" y="' + gy + '" width="' + gw + '" height="' + gh +
              '" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + gcid + ')"' +
              ' xlink:href="' + esc(gsrc) + '" href="' + esc(gsrc) + '"' + rotAttr() + '/>';
          }
          t = gDefs + gImgs;
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
          '" font-weight="' + (d.fontWeight || (d.bold ? '700' : '400')) +
          '" font-style="' + (d.italic ? 'italic' : 'normal') + '"' +
          (deco.length ? ' text-decoration="' + deco.join(' ') + '"' : '') +
          ' fill="' + d.color + '"';
        var anchor = d.align === 'center' ? ' text-anchor="middle"' : d.align === 'right' ? ' text-anchor="end"' : '';
        var x = d.align === 'center' ? el.x + el.w / 2 : d.align === 'right' ? el.x + el.w : el.x + 4;
        /* v1.17 — TITRE en haut de la carte : rendu SVG avec le même
         * alignement que sur le canvas ; le corps descend d'autant. */
        var titleSvg = '';
        var bodyDy = 0;
        var bandSvg = '';
        var bodyBgSvg = '';
        if (d.title || d.titleHtml) {
          /* v1.19 — taille dédiée du titre (titleFontSize) ; sinon la
           * dérivation historique de l'export (inchangée). */
          var tsz = Number(d.titleFontSize);
          var tSize = (isFinite(tsz) && tsz > 0) ? Math.min(Math.round(tsz), 400)
            : Math.max(14, Math.round((d.fontSize || 24) * 0.85));
          var tAnchor = d.titleAlign === 'left' ? ' text-anchor="start"'
            : d.titleAlign === 'right' ? ' text-anchor="end"'
            : ' text-anchor="middle"';
          var tX = d.titleAlign === 'left' ? el.x + 8
            : d.titleAlign === 'right' ? el.x + el.w - 8
            : el.x + el.w / 2;
          /* v1.18 — titre : police/graisse/couleur dédiées comme sur
           * le canvas (titleFont/titleWeight/titleColor). */
          titleSvg = multiLineText(tX, el.y + tSize + 4, d.title,
            'font-family="' + esc(d.titleFont || d.fontFamily || 'Georgia') + '" font-size="' + tSize +
            '" font-weight="' + (d.titleWeight || 700) + '" fill="' + (d.titleColor || d.color) + '"' + tAnchor, tSize * 1.25);
          bodyDy = tSize * 1.25 + 4;
          /* v1.18.1 — le fond du titre (titleBg) existe enfin dans
           * l'export : bandeau pleine largeur, coins SUPÉRIEURS
           * arrondis, base CARRÉE ; le fond du corps (d.bg) s'y soude
           * avec le sommet CARRÉ et la base arrondie — un seul bloc,
           * à l'image du canvas. */
          if (d.titleBg && d.titleBg !== 'transparent') {
            bandSvg = halfRoundRect(el.x, el.y, el.w, bodyDy, 6, esc(d.titleBg), 'top', rotAttr());
            if (d.bg && d.bg !== 'transparent') {
              bodyBgSvg = halfRoundRect(el.x, el.y + bodyDy, el.w, Math.max(0, el.h - bodyDy), 6, esc(d.bg), 'bottom', rotAttr());
            }
          }
        }
        t = bandSvg + bodyBgSvg + titleSvg +
          multiLineText(x, el.y + d.fontSize + bodyDy, d.text, a + anchor, d.fontSize * d.lineHeight) + rotAttrWrap(rotAttr());
        break;
      }

      case 'note': {
        var ink = U.readableOn(d.color);
        var noteFont = d.fontFamily || 'Georgia';
        /* v1.17 — titre de la note dans l'export : séparé du corps. */
        var noteTitleSvg = '';
        var noteBandSvg = '';
        var noteDy = 0;
        if (d.title || d.titleHtml) {
          /* v1.19 — taille dédiée du titre (titleFontSize) ; sinon la
           * dérivation historique de l'export (inchangée). */
          var ntsz = Number(d.titleFontSize);
          var ntSize = (isFinite(ntsz) && ntsz > 0) ? Math.min(Math.round(ntsz), 400)
            : Math.max(14, Math.round((d.fontSize || 15) * 1.05));
          /* v1.18 — titre : police/graisse/couleur dédiées comme sur
           * le canvas (titleFont/titleWeight/titleColor). */
          noteTitleSvg = multiLineText(el.x + el.w / 2, el.y + ntSize + 6, d.title,
            'font-family="' + esc(d.titleFont || noteFont) + '" font-size="' + ntSize +
            '" font-weight="' + (d.titleWeight || 700) + '" fill="' + (d.titleColor || ink) + '" text-anchor="middle"', ntSize * 1.25);
          noteDy = ntSize * 1.25 + 4;
          /* v1.18.1 — le fond du titre se dessine SUR le papier :
           * coins supérieurs arrondis au rayon du papier (4 px), base
           * CARRÉE — un seul bloc, la frontière titre/corps étant la
           * simple frontière des deux fonds. */
          if (d.titleBg && d.titleBg !== 'transparent') {
            noteBandSvg = halfRoundRect(el.x, el.y, el.w, ntSize * 1.25 + 8, 4, esc(d.titleBg), 'top', rotAttr());
          }
        }
        t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
          '" rx="4" fill="' + d.color + '"' + rotAttr() + '/>' +
          noteBandSvg +
          noteTitleSvg +
          multiLineText(el.x + 14, el.y + 24 + noteDy, d.text, 'font-family="' + esc(noteFont) + '" font-size="' + d.fontSize +
            (d.fontWeight ? '" font-weight="' + Number(d.fontWeight) : '') + '" fill="' + ink + '"', d.fontSize * 1.4);
        break;
      }

      case 'comment': {
        var ink2 = '#F5F5F5';
        var cmFont = d.fontFamily || 'Georgia';
        t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
          '" rx="10" fill="#2C2C2C" stroke="' + d.color + '" stroke-width="2"' + rotAttr() + '/>' +
          multiLineText(el.x + 12, el.y + 20, d.author, 'font-family="' + esc(cmFont) + '" font-size="11" font-weight="700" fill="' + d.color + '"', 14) +
          multiLineText(el.x + 12, el.y + 38, d.text, 'font-family="' + esc(cmFont) + '" font-size="' + (d.fontSize || 13) +
            (d.fontWeight ? '" font-weight="' + Number(d.fontWeight) : '') + '" fill="' + ink2 + '"', 17);
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
        /* v1.12 — design « picker » (Bencho) : pastille à ronds
         * empilés + liste de rangées (rond + nom + code + coche).
         * Miroir simplifié mais reconnaissable de la carte du canvas. */
        var pickedSvg = Array.isArray(d.picked)
          ? d.picked.slice()
          : (d.colors || []).map(function (c) { return c.hex; });
        var cardBg = '#2E2E2E';
        var rowH = 48;
        var cardTop = el.y + 54;
        var cardH = Math.max(el.h - 54, 12 + rowH * Math.max(1, (d.colors || []).length));
        t = '<rect x="' + el.x + '" y="' + cardTop + '" width="' + el.w +
          '" height="' + (cardH - 6) + '" rx="16" fill="' + cardBg + '"/>';
        /* la pastille */
        t += '<rect x="' + el.x + '" y="' + el.y + '" width="' + Math.min(el.w - 8, 48 + pickedSvg.length * 18) +
          '" height="44" rx="22" fill="' + cardBg + '"/>';
        var fx = el.x + 8;
        for (var ip = 0; ip < pickedSvg.length; ip++) {
          t += '<circle cx="' + (fx + 14) + '" cy="' + (el.y + 22) + '" r="13" fill="' + pickedSvg[ip] +
            '" stroke="' + cardBg + '" stroke-width="2.5"/>';
          fx += 18;
        }
        /* les rangées */
        (d.colors || []).forEach(function (c, i) {
          var ry = cardTop + 6 + i * rowH;
          var on = pickedSvg.indexOf(c.hex) >= 0;
          t += '<circle cx="' + (el.x + 22) + '" cy="' + (ry + 24) + '" r="15" fill="' + c.hex + '" stroke="' + cardBg + '" stroke-width="2"/>' +
            multiLineText(el.x + 44, ry + 18, c.name || c.hex, 'font-family="Georgia" font-size="13" fill="#F5F5F5"', 15) +
            multiLineText(el.x + 44, ry + 34, String(c.hex).toUpperCase(), 'font-family="Menlo, monospace" font-size="11" fill="#9A9A9A"', 13) +
            '<rect x="' + (el.x + el.w - 30) + '" y="' + (ry + 15) + '" width="18" height="18" rx="5.5" fill="' + (on ? '#F5F5F5' : 'none') +
            '" stroke="#F5F5F5" stroke-opacity="0.25" stroke-width="1.5"/>' +
            (on ? '<path d="M' + (el.x + el.w - 26) + ' ' + (ry + 24) + ' l3.5 3.5 l7 -7.5" stroke="#2E2E2E" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : '');
        });
        break;
      }

      case 'typography': {
        t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
          '" rx="10" fill="#252525"/>' +
          multiLineText(el.x + 14, el.y + 26, d.fontFamily, 'font-family=\'' + esc(d.fontFamily) + '\' font-size="15" font-weight="700" fill="#F5F5F5"', 19);
        var yy = el.y + 84;
        for (var s = 0; s < d.sizes.length; s++) {
          /* v1.19.1 — la graisse du spécimen (sélecteur « Graisse ») est
           * enfin respectée dans l'export (le canvas l'appliquait déjà). */
          t += multiLineText(el.x + 14, yy, d.sampleText, 'font-family=\'' + esc(d.fontFamily) + '\' font-size="' + d.sizes[s] + '"' +
            (d.fontWeight ? ' font-weight="' + Number(d.fontWeight) + '"' : '') + ' fill="#E8E8E8"', d.sizes[s] * 1.3);
          yy += d.sizes[s] * 1.3 + 8;
        }
        break;
      }

      /* v1.11 — carte ASSIGNEES (port Bencho) : pastille + visages en
       * initiales colorées (les photos sont des fichiers locaux : le SVG
       * exporté reste autonome) + noms des personnes assignées. */
      case 'assignees': {
        var cast2 = MB.ui.assignees ? MB.ui.assignees.CAST : [];
        var pickedIds = Array.isArray(d.picked) ? d.picked : [];
        var AV_INK = ['#FF7EB3', '#00D4FF', '#A3E635', '#FB7185'];
        var pillY = el.y + 10;
        var pillH = 44;
        var pillW = Math.min(el.w - 16, 150 + Math.max(0, pickedIds.length - 1) * 18);
        t = '<rect x="' + el.x + '" y="' + el.y + '" width="' + el.w + '" height="' + el.h +
          '" rx="12" fill="#252525" stroke="#3A3A3A"' + rotAttr() + '/>' +
          '<rect x="' + (el.x + 8) + '" y="' + pillY + '" width="' + pillW + '" height="' + pillH +
          '" rx="22" fill="#2C2C2C"/>';
        var fx = el.x + 18;
        var names = [];
        for (var ai = 0; ai < pickedIds.length && ai < 4; ai++) {
          var per = MB.ui.assignees ? MB.ui.assignees.personOf(pickedIds[ai]) : null;
          var initials = per ? per.name.split(' ').map(function (w) { return w.charAt(0); }).join('') : '?';
          t += '<circle cx="' + (fx + 14) + '" cy="' + (pillY + pillH / 2) + '" r="14" fill="' + AV_INK[ai % 4] + '" stroke="#2C2C2C" stroke-width="2"/>' +
            multiLineText(fx + 14, pillY + pillH / 2 + 4, initials, 'font-family="Georgia" font-size="11" font-weight="700" fill="#1E1E1E" text-anchor="middle"', 13);
          if (per) names.push(per.name);
          fx += 18;
        }
        if (!pickedIds.length) {
          t += multiLineText(el.x + 18, pillY + 27, 'Non assigné', 'font-family="Georgia" font-size="13" fill="#F5F5F5"', 15);
        }
        var ny = pillY + pillH + 26;
        for (var ni = 0; ni < names.length; ni++) {
          t += multiLineText(el.x + 14, ny, names[ni], 'font-family="Georgia" font-size="12" fill="#F5F5F5"', 15);
          ny += 17;
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
          multiLineText(el.x + 16, urlY + 22, d.title, 'font-family="' + esc(d.titleFont || 'Georgia') + '" font-size="14" font-weight="' + (d.titleWeight || 600) + '" text-decoration="underline" fill="' + lTitleColor + '"', 17) +
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
          /* v1.19.1 — le titre suit la taille ET la graisse de la carte
           * (700 fixe : le sélecteur « Graisse » était perdu à l'export). */
          multiLineText(el.x + 14, el.y + 24, d.title, 'font-family="' + esc(ckFont) + '" font-size="' + (d.fontSize || 14) +
            '" font-weight="' + (d.fontWeight || 700) + '" fill="' + ckInk + '"', 18);
        var ry = el.y + 46;
        for (var k = 0; k < d.items.length; k++) {
          var it = d.items[k];
          t += '<rect x="' + (el.x + 14) + '" y="' + ry + '" width="16" height="16" rx="4" fill="' + (it.done ? '#4C8DFF' : 'none') + '" stroke="#5A5A5A" stroke-width="1.5"/>';
          if (it.done) {
            t += '<path d="M' + (el.x + 18) + ' ' + (ry + 8) + ' l3 3 l5 -6" stroke="#fff" stroke-width="2" fill="none"/>';
          }
          t += multiLineText(el.x + 42, ry + 12, it.text, 'font-family="' + esc(ckFont) + '" font-size="' + (d.fontSize || 13) + '"' +
            /* v1.19.1 — graisse des tâches (canvas déjà conforme). */
            (d.fontWeight ? ' font-weight="' + Number(d.fontWeight) + '"' : '') +
            ' fill="' + (it.done ? '#A8A8A8' : ckInk) + '"' + (it.done ? ' text-decoration="line-through"' : ''), 16);
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
            /* v1.19.1 — les cellules hors en-tête portent la graisse de
             * la carte (tableCellStyle du canvas la posait déjà). */
            t += multiLineText(el.x + c2 * colW + 8, el.y + r * rowH + rowH / 2 + 4, v, 'font-family="' + esc(tbFont) + '" font-size="' + tbSize + '" fill="' + fg + '"' + (head ? ' font-weight="700"' : (d.fontWeight ? ' font-weight="' + Number(d.fontWeight) + '"' : '')), 15);
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
          multiLineText(el.x + el.w / 2, bodyCy, d.title || 'Planche',
            /* v1.19.1 — la graisse du titre de planche (sélecteur
             * « Graisse du titre ») est enfin respectée à l'export
             * (700 fixe = le défaut CSS du canvas). */
            'font-family="' + esc(bdFont) + '" font-size="16" font-weight="' + (d.titleWeight || 700) +
            '" fill="#F5F5F5" text-anchor="middle"', 19) +
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

  /* Résout les src relatives (assets démo) en data URLs.
   * v1.20 — y compris les VIGNETTES de galerie (items[].src). */
  function resolveAssets(list) {
    var st = MB.exportState;
    st.resolved = {};
    var jobs = [];
    function pushJob(src) {
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
    list.forEach(function (el) {
      if (el.type === 'image' && el.data.src && el.data.src.indexOf('data:') !== 0) {
        pushJob(el.data.src);
      }
      /* v1.20 — galerie : chaque vignette à chemin relatif est
       * résolue comme une image de canvas. */
      if (el.type === 'gallery' && Array.isArray(el.data.items)) {
        el.data.items.forEach(function (it) {
          if (it && it.src && it.src.indexOf('data:') !== 0) pushJob(it.src);
        });
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
      text: 11, comment: 12, sketch: 13, assignees: 14
    };
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.type === 'column' || e.type === 'group' || e.type === 'import') continue;
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

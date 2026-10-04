/* =========================================================================
 * preview.js — Outil PREVIEW (v1.14) : l'identité du moodboard appliquée
 * à un vrai site web.
 *
 * Deux temps, jamais de génération immédiate :
 *   1. CONFIGURATION — un panneau à DEUX ONGLETS (v1.15) :
 *        · COULEURS — rôles, palette de la bibliothèque, ajout/retrait ;
 *        · POLICES — principale (titres), secondaire (texte), ajout ;
 *   2. FENÊTRE PREVIEW — le template est rendu comme un VRAI site
 *      (iframe), et chaque couleur OU police modifiée restyle
 *      INSTANTANÉMENT (variables CSS uniquement — ni rechargement, ni
 *      reconstruction).
 *
 * v1.15 — le preview est DESKTOP : les pastilles ordinateur/tablette/
 * téléphone ont laissé leur place à la SÉLECTION DE POLICES en direct
 * (pastilles « Aa » — le même langage que les pastilles de couleurs).
 *
 * v1.16 — TOUTES les pastilles de la barre (couleurs ET polices) se
 * suppriment : au survol, une CROIX ROUGE apparaît dans le coin droit
 * supérieur ; les rôles se recomposent sur place (la première couleur
 * restante redevient principale, etc.) — la dernière de chaque sorte
 * reste toujours là, l'identité ne se vide jamais. Côté bibliothèque,
 * l'ajout d'une police est confirmé au PREMIER clic (délégation + aucun
 * re-rendu pendant le geste — le « double clic » subi en CEP/bureau
 * est terminé).
 *
 * Retour au canvas : fermeture = suppression de la couche ; aucun
 * élément du moodboard n'est touché, créé ou modifié.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  var TEMPLATE = MB.preview.TEMPLATE_PATH;

  /* état courant de l'outil (partagé config ↔ fenêtre) */
  var colors = [];
  var fonts = [];     /* v1.15 — identité typographique (rôles font1…N) */
  var cfgEl = null;    // couche configuration
  var cfgClose = null; // fermeture programmatique
  var winEl = null;    // couche fenêtre
  var iframe = null;
  var device = 'desktop'; /* v1.15 — un seul appareil (compat harnais) */

  function T(k, vars) {
    return MB.i18n ? MB.i18n.t(k, vars) : k;
  }

  function isTyping(t) {
    return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));
  }

  /* ------------------------------------------------- noms de rôles */

  function roleName(i) {
    if (i === 0) return T('preview.primary');
    if (i === 1) return T('preview.secondary');
    if (i === 2) return T('preview.accent');
    return T('preview.colorN', { n: i + 1 });
  }

  function roleHint(i) {
    if (i === 0) return T('preview.rolePrimary');
    if (i === 1) return T('preview.roleSecondary');
    if (i === 2) return T('preview.roleAccent');
    return '';
  }

  function valueAt(i) {
    return (colors[i] && colors[i].value) || '#1A7A6E';
  }

  /* ------------------------------------------------- noms de rôles polices (v1.15) */

  function fontRoleName(i) {
    if (i === 0) return T('preview.fontRole1');
    if (i === 1) return T('preview.fontRole2');
    return T('preview.fontRoleN', { n: i + 1 });
  }

  function fontRoleHint(i) {
    if (i === 0) return T('preview.fontHint1');
    if (i === 1) return T('preview.fontHint2');
    return '';
  }

  function fontValueAt(i) {
    return (fonts[i] && fonts[i].value) || MB.preview.ORIGINAL_FONTS.font2;
  }

  /* ------------------------------------------------- édition police */

  function setFont(i, name) {
    var v = String(name || '').replace(/[\u0000-\u001f"'\\<>]/g, '').trim().slice(0, 64);
    if (!v || !fonts[i]) return;
    fonts[i].value = v;
    if (cfgEl) syncFontRow(i);
    if (winEl) {
      syncFontChip(i);
      applyColors();
    }
    MB.preview.saveConfig(colors, fonts);
  }

  function addFontRole() {
    if (fonts.length >= MB.preview.MAX_FONTS) return;
    /* la police proposée : la première du système pas encore utilisée —
     * jamais un doublon dès la création. */
    var candidate = 'Georgia';
    if (MB.fonts && MB.fonts.isReady && MB.fonts.isReady()) {
      var list = MB.fonts.list();
      for (var i = 0; i < list.length; i++) {
        var used = fonts.some(function (f) {
          return f.value.toLowerCase() === list[i].toLowerCase();
        });
        if (!used) {
          candidate = list[i];
          break;
        }
      }
    }
    fonts.push({ id: MB.preview.newId(), role: 'font' + (fonts.length + 1), value: candidate });
    if (cfgEl) drawFontRows();
    if (winEl) {
      drawFontChips();
      applyColors();
    }
    MB.preview.saveConfig(colors, fonts);
  }

  function removeFontRole(i) {
    /* v1.16 — toute police se retire (même principale) tant qu'il en
     * reste une : les rôles se recomposent — font1 garde le premier
     * restant (titres), font2 le suivant (texte). */
    if (i < 0 || i >= fonts.length || fonts.length <= 1) return;
    fonts.splice(i, 1);
    for (var j = 0; j < fonts.length; j++) {
      fonts[j].role = j < 2 ? MB.preview.CORE_FONTS[j] : 'font' + (j + 1);
    }
    if (cfgEl) drawFontRows();
    if (winEl) {
      drawFontChips();
      applyColors();
    }
    MB.preview.saveConfig(colors, fonts);
  }

  /* le sélecteur de police du projet (recherche + favoris + toutes les
   * polices du système) — le même que les cartes texte. */
  function pickFont(i, anchor) {
    var C = MB.ui.controls;
    if (C && C.fontPopover) {
      C.fontPopover(anchor, function () {
        return fontValueAt(i);
      }, function (name) {
        setFont(i, name);
      });
    }
  }

  /* ------------------------------------------------- édition couleur */

  function setColor(i, hex) {
    var v = U.normalizeHex(hex);
    if (!v) return;
    colors[i].value = v;
    if (cfgEl) syncRow(i);
    if (winEl) {
      syncChip(i);
      applyColors();
    }
    /* §22 — persistance : la dernière configuration survit. */
    MB.preview.saveConfig(colors, fonts);
  }

  function addColor() {
    if (colors.length >= MB.preview.MAX_COLORS) return;
    var h = (colors.length * 47) % 360 / 360;
    var i = colors.length;
    colors.push({ id: MB.preview.newId(), role: 'color' + (i + 1), value: MB.preview.hslHex(h, 0.55, 0.45) });
    if (cfgEl) drawRows();
    if (winEl) drawChips();
    applyColors();
    MB.preview.saveConfig(colors, fonts);
  }

  function removeColor(i) {
    /* v1.16 — toute couleur se retire (même principale) tant qu'il en
     * reste une : les rôles se recomposent sur place, le cœur manquant
     * reprend l'identité d'origine au prochain sanitize. */
    if (i < 0 || i >= colors.length || colors.length <= 1) return;
    colors.splice(i, 1);
    for (var j = 0; j < colors.length; j++) {
      colors[j].role = j < 3 ? MB.preview.CORE_ROLES[j] : 'color' + (j + 1);
    }
    if (cfgEl) drawRows();
    if (winEl) {
      drawChips();
      applyColors();
    }
    MB.preview.saveConfig(colors, fonts);
  }

  /* ==================================================== CONFIGURATION */

  function open() {
    if (winEl) return; /* déjà en preview : la fenêtre a le focus */
    if (cfgEl) return; /* déjà ouverte */
    var cfg = MB.preview.loadConfig();
    colors = cfg.colors.map(function (c) {
      return { id: c.id, role: c.role, value: c.value };
    });
    fonts = (cfg.fonts || MB.preview.defaultFonts()).map(function (f) {
      return { id: f.id, role: f.role, value: f.value };
    });
    openConfig();
  }

  function openConfig() {
    var back = U.el('div', 'pv-cfg');
    var card = U.el('div', 'pv-card');
    back.appendChild(card);
    back.addEventListener('pointerdown', onCfgBackdrop);
    back.addEventListener('mousedown', onCfgBackdrop);
    document.getElementById('layer-dialogs').appendChild(back);
    cfgEl = back;
    cfgClose = function () {
      if (cfgEl && cfgEl.parentNode) cfgEl.parentNode.removeChild(cfgEl);
      cfgEl = null;
      cfgClose = null;
    };
    drawConfig(card);
  }

  function onCfgBackdrop(e) {
    if (e.target === cfgEl && cfgClose) cfgClose();
  }

  function drawConfig(card) {
    card.innerHTML = '';

    var title = U.el('div', 'dialog-title', T('preview.title'));
    card.appendChild(title);

    /* v1.15 — deux onglets : COULEURS (l'identité chromatique, comme
     * avant) et POLICES (l'identité typographique — même mécanique,
     * même persistance, même édition en direct). */
    var tabs = U.el('div', 'pv-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', T('preview.title'));
    var tabC = U.el('button', 'pv-tab is-active', T('preview.tabColors'));
    var tabF = U.el('button', 'pv-tab', T('preview.tabFonts'));
    tabC.type = 'button';
    tabF.type = 'button';
    tabC.setAttribute('role', 'tab');
    tabF.setAttribute('role', 'tab');
    tabC.setAttribute('aria-selected', 'true');
    tabF.setAttribute('aria-selected', 'false');
    tabs.appendChild(tabC);
    tabs.appendChild(tabF);
    card.appendChild(tabs);

    var body = U.el('div', 'dialog-body pv-body');

    var paneColors = U.el('div', 'pv-pane');
    var paneFonts = U.el('div', 'pv-pane');
    paneFonts.hidden = true;

    /* ── onglet COULEURS ──────────────────────────────── */
    paneColors.appendChild(U.el('p', 'pv-intro', T('preview.intro')));

    /* source : palettes existantes du moodboard (§13 — réutiliser les
     * couleurs déjà là plutôt que les retaper). */
    var srcRow = U.el('div', 'pv-source');
    var srcBtn = U.el(
      'button',
      'pv-src-btn',
      MB.icons.get('palette', 14) + '<span>' + U.escapeHtml(T('preview.fromLibrary')) + '</span>'
    );
    srcBtn.type = 'button';
    srcBtn.addEventListener('click', function () {
      showPalettePicker(srcBtn);
    });
    srcRow.appendChild(srcBtn);
    paneColors.appendChild(srcRow);

    var rows = U.el('div', 'pv-rows');
    rows.id = 'pv-rows';
    paneColors.appendChild(rows);

    var add = U.el(
      'button',
      'pv-add',
      MB.icons.get('plus', 13) + '<span>' + U.escapeHtml(T('preview.addColor')) + '</span>'
    );
    add.type = 'button';
    add.setAttribute('aria-label', T('preview.addColor'));
    add.addEventListener('click', addColor);
    paneColors.appendChild(add);

    /* ── onglet POLICES (v1.15) ────────────────────────── */
    paneFonts.appendChild(U.el('p', 'pv-intro', T('preview.fontsIntro')));

    var frows = U.el('div', 'pv-rows');
    frows.id = 'pv-font-rows';
    paneFonts.appendChild(frows);

    var addF = U.el(
      'button',
      'pv-add',
      MB.icons.get('plus', 13) + '<span>' + U.escapeHtml(T('preview.addFont')) + '</span>'
    );
    addF.type = 'button';
    addF.setAttribute('aria-label', T('preview.addFont'));
    addF.addEventListener('click', addFontRole);
    paneFonts.appendChild(addF);

    body.appendChild(paneColors);
    body.appendChild(paneFonts);
    card.appendChild(body);

    function switchTab(id) {
      var onColors = id === 'colors';
      paneColors.hidden = !onColors;
      paneFonts.hidden = onColors;
      tabC.classList.toggle('is-active', onColors);
      tabF.classList.toggle('is-active', !onColors);
      tabC.setAttribute('aria-selected', onColors ? 'true' : 'false');
      tabF.setAttribute('aria-selected', onColors ? 'false' : 'true');
    }
    tabC.addEventListener('click', function () {
      switchTab('colors');
    });
    tabF.addEventListener('click', function () {
      switchTab('fonts');
    });

    var foot = U.el('div', 'dialog-actions pv-actions');
    var no = U.el('button', 'btn btn-ghost', T('dlg.cancel'));
    no.type = 'button';
    no.addEventListener('click', function () {
      cfgClose();
    });
    var ok = U.el('button', 'btn btn-primary', T('preview.apply'));
    ok.type = 'button';
    ok.id = 'pv-apply';
    ok.addEventListener('click', onApply);
    foot.appendChild(no);
    foot.appendChild(ok);
    card.appendChild(foot);

    drawRows();
    drawFontRows();
  }

  function drawRows() {
    var host = cfgEl ? cfgEl.querySelector('#pv-rows') : null;
    if (!host) return;
    host.innerHTML = '';
    colors.forEach(function (c, i) {
      var row = U.el('div', 'pv-row');
      row.dataset.i = i;

      var sw = U.el('button', 'pv-swatch');
      sw.type = 'button';
      sw.style.background = c.value;
      sw.dataset.tip = T('preview.editLive');
      sw.setAttribute('aria-label', roleName(i) + ' — ' + c.value);
      sw.addEventListener('click', function () {
        var C = MB.ui.controls;
        if (C && C.colorPopover) C.colorPopover(sw, valueAt(i), function (hex) {
          setColor(i, hex);
        });
      });
      row.appendChild(sw);

      var meta = U.el('div', 'pv-meta');
      meta.appendChild(U.el('span', 'pv-role', U.escapeHtml(roleName(i))));
      var hint = roleHint(i);
      if (hint) meta.appendChild(U.el('span', 'pv-role-hint', U.escapeHtml(hint)));
      row.appendChild(meta);

      var hex = U.el('input', 'input input--hex pv-hex');
      hex.type = 'text';
      hex.spellcheck = false;
      hex.maxLength = 7;
      hex.value = c.value;
      hex.setAttribute('aria-label', roleName(i) + ' — HEX');
      hex.addEventListener('change', function () {
        var v = U.normalizeHex(hex.value);
        if (!v) {
          hex.value = valueAt(i);
          hex.classList.add('is-bad');
          setTimeout(function () {
            hex.classList.remove('is-bad');
          }, 600);
          return;
        }
        setColor(i, v);
      });
      row.appendChild(hex);

      /* sélecteur natif (hors CEP — comme colorPopover du projet). */
      if (!(MB.storage && MB.storage.isCep && MB.storage.isCep())) {
        var nat = U.el('input', 'pv-native');
        nat.type = 'color';
        nat.value = c.value;
        nat.setAttribute('aria-label', roleName(i));
        nat.addEventListener('input', function () {
          setColor(i, nat.value);
        });
        row.appendChild(nat);
      }

      /* v1.16 — retrait possible sur TOUTES les rangées tant qu'il
       * reste une couleur (l'identité ne se vide jamais). */
      if (colors.length > 1) {
        var del = U.el('button', 'pv-del');
        del.type = 'button';
        del.title = T('preview.removeColor');
        del.setAttribute('aria-label', T('preview.removeColor'));
        del.innerHTML = MB.icons.get('x', 11);
        del.addEventListener('click', function () {
          removeColor(i);
        });
        row.appendChild(del);
      }

      host.appendChild(row);
    });
  }

  function syncRow(i) {
    var row = cfgEl ? cfgEl.querySelector('.pv-row[data-i="' + i + '"]') : null;
    if (!row) return;
    var sw = row.querySelector('.pv-swatch');
    if (sw) sw.style.background = valueAt(i);
    var hex = row.querySelector('.pv-hex');
    if (hex && document.activeElement !== hex) hex.value = valueAt(i);
    var nat = row.querySelector('.pv-native');
    if (nat) nat.value = valueAt(i);
  }

  /* -------- rangées de POLICES du panneau de configuration (v1.15) -------
   * La même géométrie que les rangées de couleurs : l'échantillon « Aa »
   * RENDU dans la police (le swatch), le rôle + le nom de la famille (la
   * méta), le sélecteur (le champ) — et le retrait pour les polices
   * supplémentaires. */

  function drawFontRows() {
    var host = cfgEl ? cfgEl.querySelector('#pv-font-rows') : null;
    if (!host) return;
    host.innerHTML = '';
    fonts.forEach(function (f, i) {
      var row = U.el('div', 'pv-row pv-frow');
      row.dataset.f = i;

      var sample = U.el('button', 'pv-font-sample');
      sample.type = 'button';
      sample.style.fontFamily = "'" + fontValueAt(i) + "'";
      sample.textContent = 'Aa';
      sample.dataset.tip = T('preview.editFontLive');
      sample.setAttribute('aria-label', fontRoleName(i) + ' — ' + f.value);
      sample.addEventListener('click', function () {
        pickFont(i, sample);
      });
      row.appendChild(sample);

      var meta = U.el('div', 'pv-meta');
      meta.appendChild(U.el('span', 'pv-role', U.escapeHtml(fontRoleName(i))));
      var hint = fontRoleHint(i);
      if (hint) meta.appendChild(U.el('span', 'pv-role-hint', U.escapeHtml(hint)));
      meta.appendChild(U.el('span', 'pv-font-name', U.escapeHtml(f.value)));
      row.appendChild(meta);

      var choose = U.el('button', 'pv-choose', U.escapeHtml(T('preview.chooseFont')));
      choose.type = 'button';
      choose.setAttribute('aria-label', fontRoleName(i) + ' — ' + T('preview.chooseFont'));
      choose.addEventListener('click', function () {
        pickFont(i, choose);
      });
      row.appendChild(choose);

      /* v1.16 — retrait possible sur TOUTES les rangées tant qu'il
       * reste une police. */
      if (fonts.length > 1) {
        var del = U.el('button', 'pv-del');
        del.type = 'button';
        del.title = T('preview.removeFont');
        del.setAttribute('aria-label', T('preview.removeFont'));
        del.innerHTML = MB.icons.get('x', 11);
        del.addEventListener('click', function () {
          removeFontRole(i);
        });
        row.appendChild(del);
      }

      host.appendChild(row);
    });
  }

  function syncFontRow(i) {
    var row = cfgEl ? cfgEl.querySelector('.pv-frow[data-f="' + i + '"]') : null;
    if (!row) return;
    var sample = row.querySelector('.pv-font-sample');
    if (sample) sample.style.fontFamily = "'" + fontValueAt(i) + "'";
    var name = row.querySelector('.pv-font-name');
    if (name) name.textContent = fontValueAt(i);
  }

  /* -------- sélecteur de palette de la bibliothèque (§13) --------
   *
   * v1.14.1 — le design est celui des RONDS DE COULEUR QUI SE
   * CHEVAUCHENT de l'outil Palette (le picker du canvas) : chaque
   * palette se montre par ses couleurs — 28 px, recouvrement de
   * 10 px, anneau de la couleur du popover, z-order inversé — le
   * nom vit dans l'info-bulle, jamais à l'écran. */

  var PAL_FACE = 28;
  var PAL_LAP = 10;

  function palRailWidth(n) {
    return n <= 0 ? 0 : PAL_FACE + (n - 1) * (PAL_FACE - PAL_LAP);
  }

  function palStack(colors) {
    var dots = '';
    colors.forEach(function (c, k) {
      var hex = U.normalizeHex(c.hex) || '#1A7A6E';
      dots +=
        '<span class="pv-pal-dot" style="background:' + U.escapeHtml(hex) +
        ';transform:translateX(' + (k * (PAL_FACE - PAL_LAP)) + 'px)' +
        ';z-index:' + (colors.length - k) + '"></span>';
    });
    return '<span class="pv-pal-stack" style="width:' + palRailWidth(colors.length) + 'px">' + dots + '</span>';
  }

  function showPalettePicker(anchor) {
    var list = [];
    if (MB.ui.library && MB.ui.library.visiblePalettes) {
      list = MB.ui.library.visiblePalettes();
    }
    var html;
    if (!list.length) {
      html = '<div class="pv-pal-empty">' + U.escapeHtml(T('preview.noPalettes')) + '</div>';
    } else {
      html = '<div class="pv-pal-list">';
      list.forEach(function (p, i) {
        html +=
          '<button type="button" class="pv-pal" data-i="' + i + '"' +
          ' title="' + U.escapeHtml(p.name) + '"' +
          ' aria-label="' + U.escapeHtml(T('preview.fromLibrary')) + ' — ' + U.escapeHtml(p.name) + '">' +
          palStack(p.colors) +
          '</button>';
      });
      html += '</div>';
    }
    MB.ui.popover(anchor, html, {
      bind: function (pop) {
        pop.querySelectorAll('.pv-pal').forEach(function (b) {
          b.addEventListener('click', function () {
            var p = list[parseInt(b.dataset.i, 10)];
            MB.ui.closePopover();
            applyPalette(p);
          });
        });
      }
    });
  }

  function applyPalette(p) {
    if (!p || !p.colors || !p.colors.length) return;
    var next = p.colors.map(function (c) {
      return { id: MB.preview.newId(), role: '', value: U.normalizeHex(c.hex) || '#1A7A6E' };
    });
    /* le cœur est complété par l'identité d'origine si la palette est
     * courte — jamais de rôle vide. */
    while (next.length < 3) {
      next.push({ id: MB.preview.newId(), role: '', value: MB.preview.ORIGINAL[MB.preview.CORE_ROLES[next.length]] });
    }
    next = next.slice(0, MB.preview.MAX_COLORS);
    for (var i = 0; i < 3; i++) next[i].role = MB.preview.CORE_ROLES[i];
    for (var j = 3; j < next.length; j++) next[j].role = 'color' + (j + 1);
    colors = next;
    if (cfgEl) drawRows();
    /* v1.14.1 — la palette choisie depuis la FENÊTRE de preview
     * recolore le site sur place (pastilles + variables CSS). */
    if (winEl) {
      drawChips();
      applyColors();
    }
    MB.preview.saveConfig(colors, fonts);
    MB.ui.toast(T('preview.paletteApplied', { name: p.name }), 'success');
  }

  function onApply() {
    /* 1-2-3-4 du flux : récupérer couleurs + polices, enregistrer les
     * rôles, créer la configuration, charger le template, appliquer,
     * montrer. */
    var cfg = MB.preview.saveConfig(colors, fonts);
    if (cfg) {
      colors = cfg.colors;
      fonts = cfg.fonts;
    }
    if (cfgClose) cfgClose();
    openWindow();
  }

  /* ======================================================= FENÊTRE */

  /* v1.15 — le preview est DESKTOP : les pastilles ordinateur/tablette/
   * téléphone (v1.14.1) sont RETIRÉES. Le groupe .pv-fonts occupe leur
   * place : les polices du site, modifiables en direct. setDevice reste
   * exporté pour les harnais E2E — inerte, un seul appareil. */

  function openWindow() {
    if (winEl) return;
    var layer = U.el('div', 'pv-win');
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-label', 'Preview');
    layer.id = 'preview-layer';

    var head = U.el('header', 'pv-head');

    var title = U.el('div', 'pv-head-title');
    title.innerHTML = MB.icons.get('preview', 16) + '<span>Preview</span>';
    head.appendChild(title);

    /* v1.14.1 — la bibliothèque reste atteignable PENDANT le preview :
     * le même sélecteur à ronds qui se chevauchent, la palette
     * s'applique au site en direct. */
    var libBtn = U.el('button', 'icon-btn pv-lib');
    libBtn.type = 'button';
    libBtn.id = 'pv-lib';
    libBtn.title = T('preview.fromLibrary');
    libBtn.setAttribute('aria-label', T('preview.fromLibrary'));
    libBtn.innerHTML = MB.icons.get('palette', 15);
    libBtn.addEventListener('click', function () {
      showPalettePicker(libBtn);
    });
    head.appendChild(libBtn);

    var chips = U.el('div', 'pv-chips');
    chips.id = 'pv-chips';
    head.appendChild(chips);

    /* v1.15 — les POLICES à la place des appareils : une pastille « Aa »
     * par police (rendue dans sa famille), cliquable → sélecteur de
     * police du projet, le site se restyle INSTANTANÉMENT. */
    var fontsHost = U.el('div', 'pv-fonts');
    fontsHost.id = 'pv-fonts';
    fontsHost.title = T('preview.tabFonts');
    head.appendChild(fontsHost);

    var close = U.el('button', 'icon-btn pv-close');
    close.type = 'button';
    close.id = 'pv-close';
    close.title = T('preview.close') + ' (Échap)';
    close.setAttribute('aria-label', T('preview.close'));
    close.innerHTML = MB.icons.get('x', 15);
    close.addEventListener('click', closeWindow);
    head.appendChild(close);

    layer.appendChild(head);

    var stage = U.el('div', 'pv-stage');
    var frame = U.el('div', 'pv-frame');
    frame.id = 'pv-frame';
    frame.dataset.device = 'desktop';

    iframe = U.el('iframe', 'pv-site');
    iframe.setAttribute('title', T('preview.title'));
    iframe.setAttribute('aria-label', T('preview.title'));
    iframe.src = TEMPLATE;
    iframe.addEventListener('load', function () {
      applyColors();
    });

    frame.appendChild(iframe);
    stage.appendChild(frame);
    layer.appendChild(stage);

    document.getElementById('layer-dialogs').appendChild(layer);
    winEl = layer;
    drawChips();
    drawFontChips();
  }

  function closeWindow() {
    if (winEl && winEl.parentNode) winEl.parentNode.removeChild(winEl);
    winEl = null;
    iframe = null;
  }

  function setDevice() {
    /* v1.15 — preview desktop uniquement (compat harnais E2E). */
    device = 'desktop';
    return device;
  }

  /* -------- pastilles d'édition en direct (§10) -------- */

  function drawChips() {
    var host = winEl ? winEl.querySelector('#pv-chips') : null;
    if (!host) return;
    host.innerHTML = '';
    colors.forEach(function (c, i) {
      var chip = U.el('button', 'pv-chip');
      chip.type = 'button';
      chip.style.background = c.value;
      chip.dataset.i = i;
      chip.dataset.tip = roleName(i) + ' · ' + c.value;
      chip.title = roleName(i) + ' · ' + c.value;
      chip.setAttribute('aria-label', roleName(i) + ' — ' + c.value + ' — ' + T('preview.editLive'));
      chip.addEventListener('click', function () {
        var C = MB.ui.controls;
        if (C && C.colorPopover) C.colorPopover(chip, valueAt(i), function (hex) {
          setColor(i, hex);
        });
      });
      /* v1.16 — la CROIX ROUGE de retrait : au survol de la pastille,
       * coin droit supérieur. Toutes les couleurs la portent tant qu'il
       * en reste une — la dernière reste (identité jamais vide). */
      if (colors.length > 1) {
        var del = U.el('span', 'pv-chip-del');
        del.title = T('preview.removeColor');
        del.setAttribute('aria-hidden', 'true');
        del.innerHTML = MB.icons.get('x', 8);
        del.addEventListener('click', function (e) {
          e.stopPropagation();
          removeColor(i);
        });
        chip.appendChild(del);
      }
      host.appendChild(chip);
    });
    var add = U.el('button', 'pv-chip pv-chip--add');
    add.type = 'button';
    add.title = T('preview.addColor');
    add.setAttribute('aria-label', T('preview.addColor'));
    add.innerHTML = MB.icons.get('plus', 11);
    add.addEventListener('click', addColor);
    host.appendChild(add);
  }

  function syncChip(i) {
    var chip = winEl ? winEl.querySelector('.pv-chip[data-i="' + i + '"]') : null;
    if (chip) chip.style.background = valueAt(i);
  }

  /* -------- pastilles de POLICES en direct (v1.15) --------
   * À la place des appareils : une pastille « Aa » par police, rendue
   * dans SA famille — le même geste que les pastilles de couleurs :
   * cliquer ouvre le sélecteur, le site se restyle à chaque choix. */

  function drawFontChips() {
    var host = winEl ? winEl.querySelector('#pv-fonts') : null;
    if (!host) return;
    host.innerHTML = '';
    fonts.forEach(function (f, i) {
      var chip = U.el('button', 'pv-font-chip');
      chip.type = 'button';
      chip.style.fontFamily = "'" + fontValueAt(i) + "'";
      chip.textContent = 'Aa';
      chip.dataset.f = i;
      chip.title = fontRoleName(i) + ' · ' + f.value;
      chip.setAttribute('aria-label', fontRoleName(i) + ' — ' + f.value + ' — ' + T('preview.editFontLive'));
      chip.addEventListener('click', function () {
        pickFont(i, chip);
      });
      /* v1.16 — même croix rouge que les couleurs : toute police se
       * retire au survol tant qu'il en reste une. */
      if (fonts.length > 1) {
        var del = U.el('span', 'pv-chip-del');
        del.title = T('preview.removeFont');
        del.setAttribute('aria-hidden', 'true');
        del.innerHTML = MB.icons.get('x', 8);
        del.addEventListener('click', function (e) {
          e.stopPropagation();
          removeFontRole(i);
        });
        chip.appendChild(del);
      }
      host.appendChild(chip);
    });
    if (fonts.length < MB.preview.MAX_FONTS) {
      var add = U.el('button', 'pv-font-chip pv-font-chip--add');
      add.type = 'button';
      add.title = T('preview.addFont');
      add.setAttribute('aria-label', T('preview.addFont'));
      add.innerHTML = MB.icons.get('plus', 11);
      add.addEventListener('click', addFontRole);
      host.appendChild(add);
    }
  }

  function syncFontChip(i) {
    var chip = winEl ? winEl.querySelector('.pv-font-chip[data-f="' + i + '"]') : null;
    if (chip) chip.style.fontFamily = "'" + fontValueAt(i) + "'";
  }

  /* -------- application des couleurs au site (§18 : CSS vars) -------- */

  function applyColors() {
    if (!iframe) return;
    var css = MB.preview.buildVars(colors, fonts);
    var done = false;
    /* voie rapide : document accessible (same-origin web, CEP avec
     * --allow-file-access-from-files) — zéro message, zéro rechargement. */
    try {
      var doc = iframe.contentDocument;
      if (doc && doc.head) {
        var s = doc.getElementById('mb-preview-vars');
        if (!s) {
          s = doc.createElement('style');
          s.id = 'mb-preview-vars';
          doc.head.appendChild(s);
        }
        s.textContent = css;
        done = true;
      }
    } catch (err) {
      /* origine opaque : le bridge du template écoute postMessage. */
    }
    if (!done) {
      try {
        iframe.contentWindow.postMessage({ type: 'mb-preview-vars', css: css }, '*');
      } catch (err) {
        /* iframe pas prêt : le load/ready re-poussera les couleurs. */
      }
    }
  }

  /* le bridge signale son démarrage : pousse immédiatement */
  window.addEventListener('message', function (e) {
    var m = e && e.data;
    if (m && m.type === 'mb-preview-ready' && winEl) {
      applyColors();
    }
  });

  /* -------- Échap : la fenêtre se ferme AVANT tout le reste -------- */

  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (winEl) {
      if (isTyping(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        try { e.target.blur(); } catch (err) { /* noop */ }
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      closeWindow();
      return;
    }
    if (cfgEl && !isTyping(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      if (cfgClose) cfgClose();
    }
  }, true);

  /* ======================================================== export */

  MB.ui = MB.ui || {};
  MB.ui.preview = {
    open: open,
    openWindow: openWindow,
    closeWindow: closeWindow,
    isPreviewing: function () {
      return !!winEl;
    },
    isConfigOpen: function () {
      return !!cfgEl;
    },
    /* harnais E2E : état interne + application directe. */
    colors: function () {
      return colors;
    },
    setColors: function (list) {
      /* tolérant (HEX nus ou {value}) — persisté comme toute modification. */
      var cfg = MB.preview.sanitizeConfig({ colors: list, fonts: fonts }) || MB.preview.defaultConfig();
      colors = cfg.colors;
      fonts = cfg.fonts;
      MB.preview.saveConfig(colors, fonts);
      if (cfgEl) drawRows();
      if (winEl) drawChips();
      applyColors();
      return colors;
    },
    /* v1.15 — identité typographique (harnais E2E + édition directe). */
    fonts: function () {
      return fonts;
    },
    setFonts: function (list) {
      fonts = MB.preview.sanitizeFonts(list);
      MB.preview.saveConfig(colors, fonts);
      if (cfgEl) drawFontRows();
      if (winEl) drawFontChips();
      applyColors();
      return fonts;
    },
    setFont: setFont,
    applyColors: applyColors,
    setDevice: setDevice,
    device: function () {
      return device;
    }
  };
})();

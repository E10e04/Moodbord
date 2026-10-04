/* =========================================================================
 * preview.js — Outil PREVIEW (v1.14) : l'identité du moodboard appliquée
 * à un vrai site web.
 *
 * Deux temps, jamais de génération immédiate :
 *   1. CONFIGURATION — un panneau (couleurs + rôles, palette de la
 *      bibliothèque, ajout/retrait) ;
 *   2. FENÊTRE PREVIEW — le template est rendu comme un VRAI site
 *      (iframe), et chaque couleur modifiée le recolore INSTANTANÉMENT
 *      (variables CSS uniquement — ni rechargement, ni reconstruction).
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
  var cfgEl = null;    // couche configuration
  var cfgClose = null; // fermeture programmatique
  var winEl = null;    // couche fenêtre
  var iframe = null;
  var device = 'desktop';

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
    MB.preview.saveConfig(colors);
  }

  function addColor() {
    if (colors.length >= MB.preview.MAX_COLORS) return;
    var h = (colors.length * 47) % 360 / 360;
    var i = colors.length;
    colors.push({ id: MB.preview.newId(), role: 'color' + (i + 1), value: MB.preview.hslHex(h, 0.55, 0.45) });
    if (cfgEl) drawRows();
    if (winEl) drawChips();
    applyColors();
  }

  function removeColor(i) {
    if (i < 3) return; /* les rôles principaux restent toujours */
    colors.splice(i, 1);
    for (var j = 3; j < colors.length; j++) colors[j].role = 'color' + (j + 1);
    if (cfgEl) drawRows();
    if (winEl) {
      drawChips();
      applyColors();
    }
    MB.preview.saveConfig(colors);
  }

  /* ==================================================== CONFIGURATION */

  function open() {
    if (winEl) return; /* déjà en preview : la fenêtre a le focus */
    if (cfgEl) return; /* déjà ouverte */
    var cfg = MB.preview.loadConfig();
    colors = cfg.colors.map(function (c) {
      return { id: c.id, role: c.role, value: c.value };
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

    var body = U.el('div', 'dialog-body pv-body');
    body.appendChild(U.el('p', 'pv-intro', T('preview.intro')));

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
    body.appendChild(srcRow);

    var rows = U.el('div', 'pv-rows');
    rows.id = 'pv-rows';
    body.appendChild(rows);

    var add = U.el(
      'button',
      'pv-add',
      MB.icons.get('plus', 13) + '<span>' + U.escapeHtml(T('preview.addColor')) + '</span>'
    );
    add.type = 'button';
    add.setAttribute('aria-label', T('preview.addColor'));
    add.addEventListener('click', addColor);
    body.appendChild(add);

    card.appendChild(body);

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

      if (i >= 3) {
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

  /* -------- sélecteur de palette de la bibliothèque (§13) -------- */

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
        var strip = p.colors.map(function (c) {
          return '<i style="background:' + U.escapeHtml(c.hex) + '"></i>';
        }).join('');
        html +=
          '<button type="button" class="pv-pal" data-i="' + i + '">' +
          '<span class="pv-pal-name">' + U.escapeHtml(p.name) + '</span>' +
          '<span class="pv-pal-strip">' + strip + '</span>' +
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
    MB.preview.saveConfig(colors);
    MB.ui.toast(T('preview.paletteApplied', { name: p.name }), 'success');
  }

  function onApply() {
    /* 1-2-3-4 du flux : récupérer les couleurs, enregistrer les rôles,
     * créer la configuration, charger le template, appliquer, montrer. */
    var cfg = MB.preview.saveConfig(colors);
    if (cfg) colors = cfg.colors;
    if (cfgClose) cfgClose();
    openWindow();
  }

  /* ======================================================= FENÊTRE */

  var DEVICES = [
    { id: 'desktop', label: 'preview.desktop', width: '100%' },
    { id: 'tablet', label: 'preview.tablet', width: '768px' },
    { id: 'mobile', label: 'preview.mobile', width: '390px' }
  ];

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

    var chips = U.el('div', 'pv-chips');
    chips.id = 'pv-chips';
    head.appendChild(chips);

    var devs = U.el('div', 'pv-devices');
    devs.id = 'pv-devices';
    DEVICES.forEach(function (d) {
      var b = U.el('button', 'pv-dev-btn' + (d.id === device ? ' is-active' : ''));
      b.type = 'button';
      b.dataset.dev = d.id;
      b.title = T(d.label);
      b.setAttribute('aria-label', T(d.label));
      b.setAttribute('aria-pressed', d.id === device ? 'true' : 'false');
      b.textContent = d.id === 'desktop' ? '1440' : d.id === 'tablet' ? '768' : '390';
      b.addEventListener('click', function () {
        setDevice(d.id);
      });
      devs.appendChild(b);
    });
    devs.title = T('preview.device');
    head.appendChild(devs);

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
    frame.dataset.device = device;

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
  }

  function closeWindow() {
    if (winEl && winEl.parentNode) winEl.parentNode.removeChild(winEl);
    winEl = null;
    iframe = null;
  }

  function setDevice(id) {
    device = id;
    var frame = winEl ? winEl.querySelector('#pv-frame') : null;
    if (frame) frame.dataset.device = id;
    if (winEl) {
      winEl.querySelectorAll('.pv-dev-btn').forEach(function (b) {
        var on = b.dataset.dev === id;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
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
      if (i >= 3) {
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

  /* -------- application des couleurs au site (§18 : CSS vars) -------- */

  function applyColors() {
    if (!iframe) return;
    var css = MB.preview.buildVars(colors);
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
      var cfg = MB.preview.sanitizeConfig({ colors: list }) || MB.preview.defaultConfig();
      colors = cfg.colors;
      MB.preview.saveConfig(colors);
      if (cfgEl) drawRows();
      if (winEl) drawChips();
      applyColors();
      return colors;
    },
    applyColors: applyColors,
    setDevice: setDevice,
    device: function () {
      return device;
    }
  };
})();

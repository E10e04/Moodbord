/* =========================================================================
 * palette.js — Carte « Palette » (v1.12).
 *
 * REDESIGN d'après le bloc « picker » de Bencho (bencho.dev/blocks/picker,
 * MIT) — le même composant que la carte Assignees : une PASTILLE qui se
 * remplit de ronds empilés et ouvre une LISTE de rangées cochables.
 * Ici les visages sont des RONDS DE COULEUR et les personnes sont les
 * couleurs de la palette. Le port réutilise les classes .pik-* du port
 * Assignees (assignees.js + panel.css) : un seul langage visuel, une
 * seule feuille de nombres — seuls les éléments propres aux couleurs
 * vivent ici (.pal-*).
 *
 * Interactions :
 *   pastille (pal-pill)  → ouvre / referme la liste ;
 *   rangée (pal-row)     → coche / décoche la couleur (le rond rejoint ou
 *                          quitte la pastille — la pastille est le
 *                          « compte-rendu », pas un badge à nombre) ;
 *   code hex (pal-copy)  → copie le code dans le presse-papiers
 *                          (comportement historique de l'outil Palette).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  /* Les mêmes nombres que le composant Assignees (assignees.js) : le
   * composant Bencho les publie et ils sont la raison d'être de la
   * géométrie — voir les commentaires là-bas. */
  var W = 264;
  var CORNER = 22;
  var LAP = 10;

  /* Le rond de couleur — la taille du visage du picker. */
  var FACE = 28;

  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };

  /* Largeur du rail des ronds (voir assignees.js — railWidth : calculée,
   * jamais mesurée, juste à tout niveau de zoom). */
  function railWidth(picked, lap) {
    var l = clamp(typeof lap === 'number' ? lap : LAP, 0, 22);
    return !picked.length
      ? 0
      : FACE + (picked.length - 1) * (FACE - l);
  }

  /* Hauteur réservée par la carte : pastille + liste OUVERTE (54 + 12
   * de padding de carte + N rangées de 48 + pied 6). La boîte réserve
   * TOUJOURS la place de la liste ouverte — le même marché qu'Assignees :
   * un bloc qui change de hauteur quand on le presse fait sauter le mur. */
  function heightOf(colorCount) {
    return 66 + Math.max(1, colorCount) * 48;
  }

  function render(el) {
    var d = el.data || {};
    var colors = Array.isArray(d.colors) ? d.colors : [];
    var open = d.open !== false;
    /* picked = les codes hex présents dans la pastille. Par défaut :
     * toutes les couleurs de la palette (une palette se montre entière ;
     * décocher une rangée la retire de la pastille, pas de la palette). */
    var picked = Array.isArray(d.picked) ? d.picked.slice() : colors.map(function (c) {
      return c.hex;
    });
    var r = CORNER;
    var lap = clamp(LAP, 0, 22);

    /* ── les ronds de la pastille ─────────────────────────
     * Placement par transform dans un rail de largeur calculée,
     * z-order inversé (le premier reste au-dessus) — voir assignees.js. */
    var faces = '';
    picked.forEach(function (hex, i) {
      var tx = i * (FACE - lap);
      faces +=
        '<span class="pik-face pal-face" style="transform:translateX(' + tx + 'px);z-index:' + (picked.length - i) + '">' +
        '<span class="pik-face-in pal-face-in" style="background:' + U.escapeHtml(hex) + '"></span>' +
        '</span>';
    });

    /* Ce que dit la pastille vide : le NOM de la palette (l'état, pas
     * une instruction — cf. « Non assigné » du composant d'origine). */
    var sayNothing = picked.length === 0
      ? '<span class="pik-say">' + U.escapeHtml(d.name || (MB.i18n ? MB.i18n.t('palette.empty') : 'Palette')) + '</span>'
      : '';

    var pill =
      '<button type="button" class="pik-pill" data-act="pal-pill" style="border-radius:' + r + 'px" ' +
      'aria-expanded="' + (open ? 'true' : 'false') + '" aria-haspopup="listbox" aria-label="' +
      U.escapeHtml(d.name || 'Palette') + '">' +
      '<span class="pik-rail" style="width:' + railWidth(picked) + 'px">' + faces + '</span>' +
      sayNothing +
      '<span class="pik-chev" aria-hidden="true">' + MB.icons.get('chevronDown', 16) + '</span>' +
      '</button>';

    if (!open) {
      return '<div class="pik pal" style="--pik-row-r:' + Math.max(0, r - 6) + 'px">' + pill + '</div>';
    }

    /* ── la liste ─────────────────────────────────────────
     * Une rangée par couleur : rond + nom + code hex (le « rôle » de
     * la rangée d'origine) + case cochée quand la couleur est dans la
     * pastille. Le code hex est un bouton : COPIER — le geste utile
     * d'une palette, celui que les bandes verticales faisaient avant. */
    var rows = '';
    colors.forEach(function (c, i) {
      var hex = String(c.hex || '#000000');
      var on = picked.indexOf(hex) >= 0;
      rows +=
        '<div class="pik-row pal-row" role="option" aria-selected="' + on + '"' +
        (on ? ' data-on=""' : '') + ' data-act="pal-row" data-hex="' + U.escapeHtml(hex) + '"' +
        ' data-i="' + i + '"' +
        ' style="animation-delay:' + (0.04 * i + 0.03).toFixed(2) + 's"' +
        ' title="' + U.escapeHtml(c.name || hex) + '">' +
        '<span class="pal-av" style="background:' + U.escapeHtml(hex) + '"></span>' +
        '<span class="pik-who">' +
        '<span class="pik-name">' + U.escapeHtml(c.name || hex) + '</span>' +
        '<button type="button" class="pal-hex" data-act="pal-copy" data-hex="' + U.escapeHtml(hex) + '"' +
        ' title="' + U.escapeHtml(MB.i18n ? MB.i18n.t('palette.copyHint') : 'Copier le code') + '">' +
        U.escapeHtml(hex.toUpperCase()) + '</button>' +
        '</span>' +
        /* la case est toujours dessinée ; seule la coche arrive (cf.
         * assignees.js — un contrôle qui n'apparaît qu'une fois utilisé
         * est un contrôle qu'il faut deviner). */
        '<span class="pik-mark">' +
        (on ? '<span class="pik-tick">' + MB.icons.get('check', 12) + '</span>' : '') +
        '</span>' +
        '</div>';
    });

    var card =
      '<div class="pik-card" role="listbox" aria-multiselectable="true" style="border-radius:' + r + 'px">' +
      rows +
      '</div>';

    return (
      '<div class="pik pal" style="--pik-row-r:' + Math.max(0, r - 6) + 'px">' +
      pill +
      card +
      '</div>'
    );
  }

  MB.ui = MB.ui || {};
  MB.ui.paletteCard = {
    render: render,
    W: W,
    FACE: FACE,
    CORNER: CORNER,
    LAP: LAP,
    railWidth: railWidth,
    heightOf: heightOf
  };
})();

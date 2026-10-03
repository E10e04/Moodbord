/* =========================================================================
 * assignees.js — Composant « Assignees » (v1.11).
 *
 * Porté de Bencho (bencho.dev, MIT) vers l'architecture vanilla de ce
 * projet : pas de React ni de framer-motion ici — le panneau CEP ne
 * bundles rien —, les mêmes comportements vivent en HTML/CSS/JS purs
 * et les commentaires d'origine sont conservés (ils disent POURQUOI les
 * nombres sont ce qu'ils sont, et sont l'essentiel de ce que ce fichier
 * vaut). Les adaptations du port sont marquées [port].
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  /* AVATARS was Bencho's own pictures, which is not licensed
     to travel. [port] Pointed at THIS project's generated portraits
     (assets/avatars) — four people of the cast, one file each. */
  var AVATARS = {
    kai: 'assets/avatars/kai.png',
    mara: 'assets/avatars/mara.png',
    sofia: 'assets/avatars/sofia.png',
    ines: 'assets/avatars/ines.png'
  };

  /* ══ Assignees ════════════════════════════════════════════
     A pill that opens a list, and fills up with faces as you
     assign them. One, two, four — the pill grows to hold them
     and they overlap into a stack rather than a row.

     It was called "People picker", which named the widget
     rather than the job. What this is FOR is putting names
     against a thing — assigning a task, adding contributors —
     and the pill is the answer to "who is on this".

     THE PILL IS THE READOUT. There is no count badge and no
     "3 selected" caption: the faces themselves say who, which is
     the thing a person actually wants back. A number tells
     you how many you picked; a stack of faces tells you whether
     you picked the right ones. */

  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };

  /* ── the cast ──────────────────────────────────────────────
     The same four pictures the rest of the bench uses — there
     are only four in avatars.ts and every block that needs
     people draws from them — under names of their own, which
     is what the selection list and the reorder list both do. Four
     blocks sharing one set of names would read as one dataset
     being shown four ways rather than four components. */
  /* The names follow the PICTURES. avatars.ts keys are `kai`,
     `mara`, `sofia`, `ines` and none of them describes who is in
     the photograph — the reorder list and the selection list use
     the same four faces under different names, so the key is a
     slot rather than a person. Checked against the images at
     size rather than off the thumbnails: two men, two women. */
  var CAST = [
    { id: 'kai', name: 'Adam Marsh', role: 'Design' },
    { id: 'mara', name: 'Priya Raman', role: 'Research' },
    { id: 'sofia', name: 'Nora Wilder', role: 'Engineering' },
    { id: 'ines', name: 'Marco Bellini', role: 'Product' }
  ];

  /* the block's own box. Reserved for the list OPEN, so closing
     it does not resize the card underneath — the same bargain
     the selection list makes, and for the same reason: a block
     that changes height when you press it makes the wall jump.
     [port] the moodboard card defaults to this exact footprint. */
  var W = 264;
  var H = 268;

  /* the faces in the pill */
  var FACE = 28;
  var CORNER = 22;
  /* how much of each face the next one covers, px */
  var LAP = 10;

  /* ── the other way to stack ────────────────────────────────
     A row of overlapping faces is the honest default: it says
     who, in order, and it grows sideways as you add people. But
     it grows sideways, and a pill in a dense toolbar cannot
     always afford that.

     So the second arrangement packs the same four into the
     footprint of ONE. Nothing overlaps — that is the whole point
     of it, and the reason it is not simply "a tighter row". A
     row hides parts of faces behind other faces; the quad shows
     all of every face and pays for it in size.

     The box is FACE across whatever the count, so the pill in
     this mode does not grow at all. That is the trade the mode
     exists to make, and drawing one face big and four faces
     small is what makes it visible: the box does not fill up,
     it SUBDIVIDES.

     Three is the awkward count. It fills reading order and
     leaves the last cell empty, which looks like a gap and is
     actually the point: the quad is a fixed set of four slots,
     and three people occupy three of them. Centring the odd one
     balances the picture but breaks the grid — the face lands
     where no cell is, and adding the fourth person then shunts
     it sideways for no reason the eye can name.
     [port] the card exposes the Row mode (the source's default
     knob value); quad() stays for fidelity. */
  function quad(n, gut) {
    var cell = (FACE - gut) / 2;
    var s = cell / FACE;
    var a = cell / 2;          /* centre of the near cell */
    var b = FACE - cell / 2;   /* centre of the far one */
    var m = FACE / 2;
    if (n <= 1) return [{ cx: m, cy: m, s: 1 }];
    if (n === 2) return [{ cx: a, cy: m, s: s }, { cx: b, cy: m, s: s }];
    if (n === 3) return [{ cx: a, cy: a, s: s }, { cx: b, cy: a, s: s }, { cx: a, cy: b, s: s }];
    return [
      { cx: a, cy: a, s: s }, { cx: b, cy: a, s: s },
      { cx: a, cy: b, s: s }, { cx: b, cy: b, s: s }
    ];
  }

  function personOf(id) {
    for (var i = 0; i < CAST.length; i++) {
      if (CAST[i].id === id) return CAST[i];
    }
    return null;
  }

  /* ── the width is COMPUTED, not measured ─────────────────
     Framer's `layout` would animate this by measuring screen
     rectangles, and every block on this bench is drawn at a
     fraction of its own size — see Gooey.tsx. A width worked
     out from the count is the same number at any zoom, and CSS
     can transition it without knowing where the block is.
     [port] this is also why the port survives here: the
     moodboard draws the card at ANY zoom, and a computed width
     is still right at every one of them. */
  function railWidth(picked, lap) {
    var l = clamp(typeof lap === 'number' ? lap : LAP, 0, 22);
    return !picked.length
      ? 0
      : FACE + (picked.length - 1) * (FACE - l);
  }

  /* ── IT DOES NOT CLOSE ON AN OUTSIDE PRESS ───────────────
     It did, and that is the right behaviour for a dropdown in
     an application — the note that used to be here called it
     the one thing every dropdown has to do. It is the wrong
     behaviour for a block on this wall.

     Measured: one real click anywhere on the page collapsed
     the list, and nothing brought it back — so the card spent
     the rest of the session showing a pill and nothing else,
     which is a demonstration of a third of the component. The
     same class of fault as a demo that leaves a toggle on.

     The pill is still the toggle, so it is still dismissible
     by the person actually using it. What is gone is the case
     where something you did to a DIFFERENT block put this one
     away.
     [port] the canvas of this app starts a drag on any press,
     so the pill and the rows carry data-act and are exempt
     from the gesture layer — the list only ever closes by its
     own pill. */

  function render(el) {
    var d = el.data || {};
    var picked = Array.isArray(d.picked) ? d.picked : [];
    var open = d.open !== false;
    var r = CORNER;
    var lap = clamp(LAP, 0, 22);

    /* ── the faces ─────────────────────────────────────
        Absolutely placed inside a rail whose width is the
        arithmetic above, so the pill grows and shrinks by
        one CSS transition rather than by anything watching
        the DOM.

        Reversed z-order: the first face sits on top of the
        second, so the stack reads left to right the way the
        list does. Painted the other way the newest arrival
        covers everyone before it, and adding a fourth
        person looks like losing the first three. */
    var faces = '';
    picked.forEach(function (id, i) {
      /* EVERY face is placed by its transform. It used to ride
         on `left`, which cannot carry the quad: that one needs
         a size and two axes, and a face swapping arrangements
         has to travel rather than teleport. One vector and one
         scale describe both layouts, so switching modes is the
         same animation as arriving.
         [port] the transform carries the resting position;
         the arrival (a small drop with a turn on it, and
         overshoot on the way to rest) is a keyframe on an
         inner wrapper so it never has to fight the resting
         transform for the same property. */
      var tx = i * (FACE - lap);
      faces +=
        '<span class="pik-face" style="transform:translateX(' + tx + 'px);z-index:' + (CAST.length - i) + '">' +
        '<span class="pik-face-in"><img src="' + U.escapeHtml(AVATARS[id] || '') + '" alt="" draggable="false"></span>' +
        '</span>';
    });

    /* what the pill says with nothing in it. It said "Assign",
       which is an instruction — and the pill is a READOUT: with
       faces in it, it reports who is on this, so with none in
       it, it should report that nobody is. One word, the state
       rather than the verb, and it goes the moment there is a
       face, because a label beside three pictures is the
       control describing itself instead of answering.
       [port] localized with the app's dictionaries. */
    var sayNothing = picked.length === 0
      ? '<span class="pik-say">' + U.escapeHtml(MB.i18n ? MB.i18n.t('assignees.unassigned') : 'Non assigné') + '</span>'
      : '';

    var pill =
      '<button type="button" class="pik-pill" data-act="pik-pill" style="border-radius:' + r + 'px" ' +
      'aria-expanded="' + (open ? 'true' : 'false') + '" aria-haspopup="listbox" aria-label="' +
      U.escapeHtml(MB.i18n ? MB.i18n.t('tool.assignees.label') : 'Assignées') + '">' +
      '<span class="pik-rail" style="width:' + railWidth(picked) + 'px">' + faces + '</span>' +
      sayNothing +
      '<span class="pik-chev" aria-hidden="true">' + MB.icons.get('chevronDown', 16) + '</span>' +
      '</button>';

    if (!open) {
      return '<div class="pik" style="--pik-row-r:' + Math.max(0, r - 6) + 'px">' + pill + '</div>';
    }

    /* the list — it unfolds OUT OF the pill. The origin is the
       card's top-left, which is the pill's own left edge, so it
       opens down and out from the corner it belongs to rather
       than growing from its middle like a box appearing.
       [port] a keyframe with the same shape: scale starts high
       — 0.86 across, 0.72 down — because a card is a rounded
       rectangle and a scale drags its corner radius with it; the
       BOUNCE (zeta about 0.63, it goes past and comes back)
       is approximated by the keyframe's overshoot. */
    var rows = '';
    CAST.forEach(function (p) {
      var on = picked.indexOf(p.id) >= 0;
      rows +=
        '<button type="button" class="pik-row" role="option" aria-selected="' + on + '"' +
        (on ? ' data-on=""' : '') + ' data-act="pik-row" data-id="' + U.escapeHtml(p.id) + '"' +
        ' style="animation-delay:' + (0.04 * CAST.indexOf(p) + 0.03).toFixed(2) + 's">' +
        '<img class="pik-av" src="' + U.escapeHtml(AVATARS[p.id] || '') + '" alt="" draggable="false">' +
        '<span class="pik-who">' +
        '<span class="pik-name">' + U.escapeHtml(p.name) + '</span>' +
        '<span class="pik-role">' + U.escapeHtml(p.role) + '</span>' +
        '</span>' +
        /* the box is always drawn; only the tick arrives. A mark
           that appears WITH its own container reads as the row
           growing a control, rather than as the control being
           answered */
        '<span class="pik-mark">' +
        (on ? '<span class="pik-tick">' + MB.icons.get('check', 12) + '</span>' : '') +
        '</span>' +
        '</button>';
    });

    var card =
      '<div class="pik-card" role="listbox" aria-multiselectable="true" style="border-radius:' + r + 'px">' +
      rows +
      '</div>';

    return (
      '<div class="pik" style="--pik-row-r:' + Math.max(0, r - 6) + 'px">' +
      pill +
      card +
      '</div>'
    );
  }

  MB.ui = MB.ui || {};
  MB.ui.assignees = {
    render: render,
    CAST: CAST,
    AVATARS: AVATARS,
    W: W,
    H: H,
    quad: quad,
    railWidth: railWidth,
    personOf: personOf
  };
})();

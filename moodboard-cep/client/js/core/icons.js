/* =========================================================================
 * icons.js — Icônes SVG inline (style trait, inspiré Lucide).
 * Tous les icônes sont monochromes et suivent currentColor.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});

  var P = {
    select: '<path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/>',
    pan: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    note: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3z"/><path d="M15 3v6h6"/>',
    text: '<path d="M4 7V5h16v2"/><path d="M12 5v14"/><path d="M9 19h6"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    checklist: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    line: '<path d="M7 17 17 7"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/>',
    section: '<rect x="3" y="4" width="18" height="16" rx="2" stroke-dasharray="4 3"/>',
    column: '<rect x="6" y="3" width="12" height="18" rx="2"/>',
    comment: '<path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 17 0z"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M3 15h18"/><path d="M9 4v16"/><path d="M15 4v16"/>',
    sketch: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    color: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    palette: '<path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 2.5-3.5 2.5H16a2 2 0 0 0-1.41 3.41A2 2 0 0 1 12 22z"/><circle cx="13.5" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="17.5" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="7.5" r="1" fill="currentColor" stroke="none"/><circle cx="6.5" cy="12.5" r="1" fill="currentColor" stroke="none"/>',
    typography: '<path d="M4 18 8.5 5.5 13 18"/><path d="M5.8 14h5.4"/><path d="M17.5 18v-4"/><circle cx="15.3" cy="16" r="2.2"/><path d="M17.5 14v-2"/>',
    shape: '<rect x="3" y="3" width="10" height="10" rx="1.5"/><circle cx="17" cy="17" r="4"/>',
    import: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/><path d="M17 3h4v4"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>',
    fit: '<path d="M3 8V5a2 2 0 0 1 2-2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/>',
    magnet: '<path d="M5 3v8a7 7 0 0 0 14 0V3h-5v8a2 2 0 0 1-4 0V3z"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17.3 17.3 0 0 1-3.1 4"/><path d="M6.6 6.6C3.8 8.6 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    group: '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
    ungroup: '<rect x="3" y="3" width="12" height="12" rx="2"/><rect x="9" y="9" width="12" height="12" rx="2"/>',
    front: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
    forward: '<path d="M12 16V8"/><path d="m8 11 4-4 4 4"/><path d="M5 19h14"/>',
    backward: '<path d="M12 8v8"/><path d="m8 13 4 4 4-4"/><path d="M5 5h14"/>',
    back: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    alignLeft: '<path d="M4 3v18"/><rect x="7" y="5" width="13" height="4" rx="1"/><rect x="7" y="13" width="9" height="4" rx="1"/>',
    alignCenterH: '<path d="M12 3v18"/><rect x="5" y="5" width="14" height="4" rx="1"/><rect x="8" y="13" width="8" height="4" rx="1"/>',
    alignRight: '<path d="M20 3v18"/><rect x="4" y="5" width="13" height="4" rx="1"/><rect x="8" y="13" width="9" height="4" rx="1"/>',
    alignTop: '<path d="M3 4h18"/><rect x="5" y="7" width="4" height="13" rx="1"/><rect x="13" y="7" width="4" height="9" rx="1"/>',
    alignCenterV: '<path d="M3 12h18"/><rect x="5" y="5" width="4" height="14" rx="1"/><rect x="13" y="8" width="4" height="8" rx="1"/>',
    alignBottom: '<path d="M3 20h18"/><rect x="5" y="4" width="4" height="13" rx="1"/><rect x="13" y="8" width="4" height="9" rx="1"/>',
    distributeH: '<path d="M4 3v18"/><path d="M20 3v18"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M6.5 12H9"/><path d="M15 12h2.5"/>',
    distributeV: '<path d="M3 4h18"/><path d="M3 20h18"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M12 6.5V9"/><path d="M12 15v2.5"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M15 2v5h5"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    bold: '<path d="M7 4h6a3.5 3.5 0 1 1 0 7H7z"/><path d="M7 11h7a3.5 3.5 0 1 1 0 7H7z"/>',
    italic: '<path d="M19 4h-9"/><path d="M14 20H5"/><path d="M15 4 9 20"/>',
    underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4"/><path d="M4 20h16"/>',
    strike: '<path d="M16 4H9a3 3 0 0 0-2.83 2"/><path d="M14 12a4 4 0 0 1 0 8H6"/><path d="M4 12h16"/>',
    alignTextLeft: '<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h14"/>',
    alignTextCenter: '<path d="M4 6h16"/><path d="M7 12h10"/><path d="M6 18h12"/>',
    alignTextRight: '<path d="M4 6h16"/><path d="M10 12h10"/><path d="M6 18h14"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01"/><path d="M10 10h.01"/><path d="M14 10h.01"/><path d="M18 10h.01"/><path d="M6 14h.01"/><path d="M18 14h.01"/><path d="M9 14h6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    rotate: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
    star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
    more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    externalBox: '<path d="M21 3 14 10"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    square: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    triangle: '<path d="M12 4l9 16H3z"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    sparkle: '<path d="M12 3l1.9 5.8 5.8 1.9-5.8 1.9L12 18.4l-1.9-5.8-5.8-1.9 5.8-1.9z"/><path d="M19 15l.9 2.6L22.5 18.5l-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z"/>'
  };

  MB.icons = {
    has: function (name) {
      return Object.prototype.hasOwnProperty.call(P, name);
    },
    get: function (name, size) {
      var body = P[name] || P.info;
      var s = size || 18;
      return (
        '<svg class="icn" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        body +
        '</svg>'
      );
    }
  };
})();

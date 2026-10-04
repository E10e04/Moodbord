/* =========================================================================
 * previewEngine.js — Moteur de l'outil PREVIEW (v1.14).
 *
 * Colorer un vrai site web avec l'identité du moodboard :
 *   couleurs choisies  →  RÔLES  →  variables --preview-*  →  template.
 *
 * Le template (assets/preview-template — TemplateMo 622 Clearwave) a été
 * préparé pour recevoir des RÔLES et non des remplacements aveugles :
 *   primary   → structure, titres, marque, liens de navigation
 *   secondary → teinte des fonds et surfaces
 *   accent    → boutons, CTA, éléments interactifs
 *   extra-N   → survols, accents clairs, coques décoratives…
 *
 * Tout ce qui ne peut PAS se dériver en CSS pur (mix blanc/teinte,
 * encres teintées, contraste lisible) est calculé ICI : les moteurs
 * Chromium des panneaux CEP (88/103) n'ont pas color-mix.
 *
 * La configuration est un tableau DYNAMIQUE de couleurs — jamais trois
 * variables figées :
 *   previewColors: [
 *     { id, role: 'primary',   value: '#163DAD' },
 *     { id, role: 'secondary', value: '#F5C542' },
 *     { id, role: 'accent',    value: '#35B56A' },
 *     { id, role: 'color4',    value: … }, …
 *   ]
 * Les rôles personnalisés (background, surface, text, success…) restent
 * possibles plus tard : sanitize conserve tout rôle inconnu tel quel.
 *
 * v1.15 — LES POLICES rejoignent l'identité : même architecture que les
 * couleurs — un tableau dynamique de polices à rôles :
 *   previewFonts: [
 *     { id, role: 'font1', value: 'Playfair Display' },  → titres
 *     { id, role: 'font2', value: 'DM Sans' }            → texte
 *     { id, role: 'font3', value: … }, …
 *   ]
 * publiées en variables --preview-font-N et consommées par le template
 * (font-family: var(--preview-font-1, 'Playfair Display'), serif).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  /* Template embarqué : chemin RELATIF — résout naturellement en CEP
   * (file://…/client/) comme en preview web (rewrite /assets/…). */
  var TEMPLATE_PATH = 'assets/preview-template/index.html';

  /* Les trois rôles principaux proposés à l'ouverture ; au-delà, les
   * couleurs supplémentaires prennent des rôles génériques color4…N. */
  var CORE_ROLES = ['primary', 'secondary', 'accent'];
  var MAX_COLORS = 12;

  /* v1.15 — polices : deux rôles noyau (font1 = titres, font2 = texte),
   * au-delà les polices supplémentaires prennent font3…N. Les valeurs
   * d'origine sont celles du template (Playfair Display / DM Sans). */
  var CORE_FONTS = ['font1', 'font2'];
  var MAX_FONTS = 6;
  var ORIGINAL_FONTS = {
    font1: 'Playfair Display',
    font2: 'DM Sans'
  };

  /* Identité d'origine du template : c'est ELLE que montre le premier
   * Preview (le designer voit le site original, puis recolore). */
  var ORIGINAL = {
    primary: '#1A7A6E',
    secondary: '#2A9D8F',
    accent: '#5BBFB5'
  };

  /* ====================================================== math couleur */

  function hexToRgb(hex) {
    var h = U.normalizeHex(hex);
    if (!h) return null;
    return {
      r: parseInt(h.slice(1, 3), 16),
      g: parseInt(h.slice(3, 5), 16),
      b: parseInt(h.slice(5, 7), 16)
    };
  }

  function rgbToHex(r, g, b) {
    var f = function (v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length < 2 ? '0' + s : s;
    };
    return ('#' + f(r) + f(g) + f(b)).toUpperCase();
  }

  /* HSL sur 0..1 (h en tours). */
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var l = (max + min) / 2;
    var h = 0;
    var s = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: h, s: s, l: l };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 1) + 1) % 1;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    if (s === 0) {
      var v = Math.round(l * 255);
      return { r: v, g: v, b: v };
    }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    function hue(t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    return {
      r: Math.round(hue(h + 1 / 3) * 255),
      g: Math.round(hue(h) * 255),
      b: Math.round(hue(h - 1 / 3) * 255)
    };
  }

  function hexToHsl(hex) {
    var c = hexToRgb(hex);
    if (!c) return null;
    return rgbToHsl(c.r, c.g, c.b);
  }

  function hslHex(h, s, l) {
    var c = hslToRgb(h, s, l);
    return rgbToHex(c.r, c.g, c.b);
  }

  function mix(a, b, t) {
    var ca = hexToRgb(a);
    var cb = hexToRgb(b);
    if (!ca || !cb) return null;
    return rgbToHex(
      ca.r + (cb.r - ca.r) * t,
      ca.g + (cb.g - ca.g) * t,
      ca.b + (cb.b - ca.b) * t
    );
  }

  /* Luminance relative WCAG (0..1). */
  function luminance(hex) {
    var c = hexToRgb(hex);
    if (!c) return 0;
    function lin(v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  }

  /* Texte lisible posé sur une couleur : blanc, ou encre très sombre
   * TEINTÉE de la même teinte (l'original du template fait exactement
   * ce calcul à la main — #fff sur teal). On ne modifie JAMAIS la
   * couleur choisie : seulement ce qui s'écrit dessus. */
  function readableOn(hex) {
    return luminance(hex) <= 0.18 ? '#FFFFFF' : hslHex(hexToHsl(hex).h, 0.3, 0.1);
  }

  /* ====================================================== dérivations */

  /* Encres teintées du primary — le procédé du template d'origine :
   * #0D1E1C/#3A5C58/#6B8C88 sont des gris portés par la teinte teal. */
  function inkTriad(primary) {
    var hsl = hexToHsl(primary);
    return {
      text1: hslHex(hsl.h, Math.min(hsl.s, 0.42), 0.08),
      text2: hslHex(hsl.h, 0.22, 0.29),
      text3: hslHex(hsl.h, 0.13, 0.48)
    };
  }

  /* Surfaces : le secondary teinte le blanc (l'original : menthe sur
   * blanc à ~10 % pour --bg, ~15 % pour --bg-alt, ~4 % pour --surface). */
  function surfaces(secondary) {
    return {
      bg: mix('#FFFFFF', secondary, 0.10),
      bgAlt: mix('#FFFFFF', secondary, 0.15),
      surface: mix('#FFFFFF', secondary, 0.04)
    };
  }

  /* Rôles dérivés quand l'utilisateur n'a pas fourni de couleur
   * supplémentaire — mêmes relations que l'identité d'origine :
   *   extra-4 = accent éclairci d'un cran (états hover des boutons)
   *   extra-5 = accent clair de la famille PRIMARY (labels, pied de page)
   *   extra-6 = coque des téléphones : neutre désaturé du secondary */
  function derivedExtras(primary, secondary, accent) {
    var ah = hexToHsl(accent);
    var ph = hexToHsl(primary);
    var sh = hexToHsl(secondary);
    return {
      extra4: hslHex(ah.h, ah.s, Math.min(0.9, ah.l + 0.10)),
      extra5: hslHex(ph.h, ph.s * 0.85, Math.max(0.55, Math.min(0.82, ph.l + 0.27))),
      extra6: hslHex(sh.h, 0.08, 0.81)
    };
  }

  /* ====================================================== configuration */

  function newId() {
    return 'pv-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  }

  /* v1.15 — les polices par défaut : l'identité du template. */
  function defaultFonts() {
    return [
      { id: newId(), role: 'font1', value: ORIGINAL_FONTS.font1 },
      { id: newId(), role: 'font2', value: ORIGINAL_FONTS.font2 }
    ];
  }

  function defaultConfig() {
    return {
      template: 'clearwave',
      colors: [
        { id: newId(), role: 'primary', value: ORIGINAL.primary },
        { id: newId(), role: 'secondary', value: ORIGINAL.secondary },
        { id: newId(), role: 'accent', value: ORIGINAL.accent }
      ],
      fonts: defaultFonts()
    };
  }

  /* Sanitise une configuration lue (prefs.json / localStorage / entrée
   * externe) : HEX valides, rôles reconstruits dans l'ordre, cœur
   * complété si besoin, doublons d'id réparés.
   * v1.15 — sanitise aussi les polices (noms courts, cœur complété) —
   * une config sans polices (ancien prefs) reçoit l'identité du
   * template : rien ne casse à la mise à jour. */
  function sanitizeFonts(rawFonts) {
    var raw = Array.isArray(rawFonts)
      ? rawFonts
        .map(function (f) {
          var v = f && typeof f === 'object' ? String(f.value || '') : String(f || '');
          v = v.replace(/[\u0000-\u001f<>"']/g, '').trim().slice(0, 64);
          return v || null;
        })
        .filter(function (v) { return v; })
        .slice(0, MAX_FONTS)
      : [];
    var fonts = [];
    for (var i = 0; i < CORE_FONTS.length; i++) {
      fonts.push({
        id: newId(),
        role: CORE_FONTS[i],
        value: raw[i] || ORIGINAL_FONTS[CORE_FONTS[i]]
      });
    }
    for (var j = CORE_FONTS.length; j < raw.length; j++) {
      fonts.push({ id: newId(), role: 'font' + (j + 1), value: raw[j] });
    }
    return fonts;
  }

  function sanitizeConfig(cfg) {
    if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.colors)) return null;
    var raw = cfg.colors
      .map(function (c) {
        /* tolérant : entrée {value:…} ou HEX nu. */
        if (c && typeof c === 'object') return { value: U.normalizeHex(c.value) };
        if (typeof c === 'string') return { value: U.normalizeHex(c) };
        return null;
      })
      .filter(function (c) {
        return c && c.value;
      })
      .slice(0, MAX_COLORS);
    if (!raw.length) return null;
    var colors = [];
    /* le cœur d'abord (les rôles manquants prennent l'original) */
    for (var i = 0; i < 3; i++) {
      var v = raw[i] ? raw[i].value : ORIGINAL[CORE_ROLES[i]];
      colors.push({ id: newId(), role: CORE_ROLES[i], value: v });
    }
    /* puis les couleurs supplémentaires, rôles génériques color4…N */
    for (var j = 3; j < raw.length; j++) {
      colors.push({ id: newId(), role: 'color' + (j + 1), value: raw[j].value });
    }
    return { template: 'clearwave', colors: colors, fonts: sanitizeFonts(cfg.fonts) };
  }

  function loadConfig() {
    var p = MB.storage && MB.storage.prefs ? MB.storage.prefs() : null;
    var cfg = p && p.preview ? sanitizeConfig(p.preview) : null;
    return cfg || defaultConfig();
  }

  /* v1.15 — les polices voyagent AVEC les couleurs : saveConfig(colors,
   * fonts). Un appel sans polices (compat harnais) garde les défauts. */
  function saveConfig(colors, fonts) {
    var cfg = sanitizeConfig({ colors: colors, fonts: fonts });
    if (cfg && MB.storage && MB.storage.setPref) {
      MB.storage.setPref('preview', cfg);
    }
    return cfg;
  }

  /* ====================================================== résolution */

  function rolesOf(colors) {
    var cfg = sanitizeConfig({ colors: colors }) || defaultConfig();
    var out = {
      primary: cfg.colors[0].value,
      secondary: cfg.colors[1].value,
      accent: cfg.colors[2].value,
      extras: []
    };
    for (var i = 3; i < cfg.colors.length; i++) {
      out.extras.push(cfg.colors[i].value);
    }
    return out;
  }

  /* ====================================================== variables CSS */

  function rgbTriplet(hex) {
    var c = hexToRgb(hex);
    return c ? c.r + ',' + c.g + ',' + c.b : '0,0,0';
  }

  /* v1.15 — le nom d'une famille en valeur CSS : les espaces sont
   * légaux, les guillemets protègent — une famille injectée dans une
   * variable doit rester une famille, jamais une évasion. */
  function fontValue(name) {
    var f = String(name || '').replace(/[\u0000-\u001f"'\\]/g, '').trim().slice(0, 64);
    return f ? "'" + f + "'" : "'" + ORIGINAL_FONTS.font2 + "'";
  }

  function fontRolesOf(fonts) {
    var f = sanitizeFonts(fonts);
    var out = { core: [], extras: [] };
    for (var i = 0; i < f.length; i++) {
      if (i < CORE_FONTS.length) out.core.push(f[i].value);
      else out.extras.push(f[i].value);
    }
    return out;
  }

  /* Construit la feuille :root des --preview-* — c'est TOUT ce que le
   * moteur pousse au template (aucune manipulation du DOM du site,
   * aucune reconstruction : le recolorage est instantané).
   * v1.15 — les polices voyagent dans la même feuille : le site se
   * restyle d'un seul coup, sans rechargement. */
  function buildVars(colors, fonts) {
    var r = rolesOf(colors);
    var fr = fontRolesOf(fonts);
    var d = derivedExtras(r.primary, r.secondary, r.accent);
    var ink = inkTriad(r.primary);
    var sf = surfaces(r.secondary);

    var extra4 = r.extras[0] || d.extra4;
    var extra5 = r.extras[1] || d.extra5;
    var extra6 = r.extras[2] || d.extra6;

    var lines = [];
    function v(name, value) {
      lines.push('  ' + name + ':' + value + ';');
    }

    v('--preview-primary', r.primary);
    v('--preview-primary-rgb', rgbTriplet(r.primary));
    v('--preview-secondary', r.secondary);
    v('--preview-secondary-rgb', rgbTriplet(r.secondary));
    v('--preview-accent', r.accent);
    v('--preview-accent-rgb', rgbTriplet(r.accent));
    v('--preview-on-primary', readableOn(r.primary));
    v('--preview-on-accent', readableOn(r.accent));

    v('--preview-extra-4', extra4);
    v('--preview-extra-4-rgb', rgbTriplet(extra4));
    v('--preview-extra-5', extra5);
    v('--preview-extra-5-rgb', rgbTriplet(extra5));
    v('--preview-extra-6', extra6);
    v('--preview-extra-6-rgb', rgbTriplet(extra6));

    /* couleurs au-delà : définies et disponibles pour de futurs
     * templates / rôles personnalisés (architecture extensible) */
    for (var i = 3; i < r.extras.length; i++) {
      var n = i + 4; /* extra-4 est extras[0] → extras[3] = extra-7 */
      v('--preview-extra-' + n, r.extras[i]);
      v('--preview-extra-' + n + '-rgb', rgbTriplet(r.extras[i]));
    }

    /* v1.15 — polices : font1 = titres, font2 = texte, font3…N =
     * polices supplémentaires (disponibles pour de futurs templates).
     * --preview-font-accent : les mots en italique des titres suivent la
     * police PRINCIPALE dès qu'on la change — mais gardent le serif de
     * l'identité d'origine tant que font1 vaut celle du template. */
    v('--preview-font-1', fontValue(fr.core[0]));
    v('--preview-font-2', fontValue(fr.core[1]));
    v('--preview-font-accent',
      fontValue(fr.core[0]).toLowerCase() === "'dm sans'" ? "'Playfair Display'" : fontValue(fr.core[0]));
    for (var k = 0; k < fr.extras.length; k++) {
      v('--preview-font-' + (k + 3), fontValue(fr.extras[k]));
    }

    v('--preview-ink-rgb', rgbTriplet(ink.text1));
    v('--preview-bg-rgb', rgbTriplet(sf.bg));

    /* jetons du template, valeurs dérivées concrètes */
    v('--bg', sf.bg);
    v('--bg-alt', sf.bgAlt);
    v('--surface', sf.surface);
    v('--surface-2', '#FFFFFF');
    v('--text-1', ink.text1);
    v('--text-2', ink.text2);
    v('--text-3', ink.text3);

    return ':root{\n' + lines.join('\n') + '\n}';
  }

  /* ======================================================== export */

  MB.preview = {
    TEMPLATE_PATH: TEMPLATE_PATH,
    CORE_ROLES: CORE_ROLES,
    MAX_COLORS: MAX_COLORS,
    ORIGINAL: ORIGINAL,
    /* v1.15 — polices (même architecture que les couleurs) */
    CORE_FONTS: CORE_FONTS,
    MAX_FONTS: MAX_FONTS,
    ORIGINAL_FONTS: ORIGINAL_FONTS,
    defaultFonts: defaultFonts,
    sanitizeFonts: sanitizeFonts,
    fontValue: fontValue,
    fontRolesOf: fontRolesOf,
    /* math (exposée : tests E2E + future UI de rôles personnalisés) */
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    rgbToHsl: rgbToHsl,
    hslToRgb: hslToRgb,
    hexToHsl: hexToHsl,
    hslHex: hslHex,
    mix: mix,
    luminance: luminance,
    readableOn: readableOn,
    inkTriad: inkTriad,
    surfaces: surfaces,
    derivedExtras: derivedExtras,
    /* configuration */
    newId: newId,
    defaultConfig: defaultConfig,
    sanitizeConfig: sanitizeConfig,
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    /* moteur */
    rolesOf: rolesOf,
    buildVars: buildVars
  };
})();

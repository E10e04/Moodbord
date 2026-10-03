/* =========================================================================
 * richtext.js — Édition riche des notes et textes (v1.8).
 *
 * Le corps des notes/textes s'édite en HTML via contenteditable : gras,
 * italique, souligné, barré, surlignage, listes à puces/numérotées et
 * police de la sélection. Le HTML produit est sanitisé (liste blanche
 * stricte) avant d'être stocké dans data.html — le collage insère du
 * texte brut, seules les commandes de l'application créent du formatage.
 *
 * Compatibilité : document.execCommand est officiellement « déprécié »
 * mais reste la SEULE API homogène sur les moteurs visés (Chromium du CEP
 * 10/11, Electron, navigateurs) — elle fonctionne partout sans module
 * externe (le panneau CEP doit rester 100 % hors-ligne).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});

  /* ------------------------------------------------------ sanitiséation */

  var ALLOWED_TAGS = {
    B: true, STRONG: true, I: true, EM: true, U: true, INS: true,
    S: true, STRIKE: true, DEL: true, SUB: true, SUP: true,
    BR: true, UL: true, OL: true, LI: true, P: true, DIV: true,
    SPAN: true, FONT: true, H1: false, H2: false
  };

  /* Styles inline tolérés sur SPAN/FONT (produits par execCommand). */
  var ALLOWED_STYLE_PROPS = ['background-color', 'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-decoration'];

  function safeStyle(cssText) {
    if (!cssText || typeof cssText !== 'string') return '';
    var keep = [];
    cssText.split(';').forEach(function (chunk) {
      var kv = chunk.split(':');
      if (kv.length < 2) return;
      var prop = kv[0].trim().toLowerCase();
      var val = kv.slice(1).join(':').trim();
      if (!prop || !val) return;
      if (ALLOWED_STYLE_PROPS.indexOf(prop) < 0) return;
      /* Aucune url()/expression() : valeurs dangereuses écartées. */
      if (/url\(|expression\(|javascript:/i.test(val)) return;
      keep.push(prop + ':' + val);
    });
    return keep.join(';');
  }

  function sanitizeNode(src, out) {
    var name = src.nodeName;
    if (name === '#text') {
      out.appendChild(document.createTextNode(src.nodeValue || ''));
      return;
    }
    if (name === '#comment' || name === '#document' || name === '#document-fragment') {
      /* les fragments (niveau racine) sont parcourus, jamais copiés */
      for (var c = 0; c < src.childNodes.length; c++) {
        sanitizeNode(src.childNodes[c], out);
      }
      return;
    }
    if (!ALLOWED_TAGS[name]) return; /* balise interdite : ses enfants non plus */
    var el = document.createElement(name);
    if (name === 'SPAN' || name === 'FONT') {
      var st = safeStyle(src.getAttribute('style'));
      if (st) el.setAttribute('style', st);
      /* attributs FONT des vieux moteurs */
      if (name === 'FONT') {
        var color = src.getAttribute('color');
        if (color && /^#[0-9a-f]{3,8}$/i.test(color)) el.setAttribute('color', color);
        var face = src.getAttribute('face');
        if (face && !/[<>'"]/.test(face)) el.setAttribute('face', face);
      }
    }
    for (var i = 0; i < src.childNodes.length; i++) {
      sanitizeNode(src.childNodes[i], el);
    }
    out.appendChild(el);
  }

  /* Sanitise un fragment HTML (celui de l'éditeur ou d'un fichier tiers) :
   * seules les balises/attributs de la liste blanche survivent. */
  function sanitize(html) {
    if (!html || typeof html !== 'string') return '';
    var doc = null;
    try {
      doc = new DOMParser().parseFromString('<div id="rt-root">' + html + '</div>', 'text/html');
    } catch (e) {
      return '';
    }
    var root = doc ? doc.getElementById('rt-root') : null;
    if (!root) return '';
    var out = document.createElement('div');
    sanitizeNode(root, out);
    var clean = out.innerHTML;
    /* contenu vide (« <br> » seul) → chaîne vide */
    if (!clean.replace(/<(br|div|p|span|font|b|i|u|s|ul|ol|li)[^>]*>|<\/[^>]+>|\s/gi, '')) {
      return '';
    }
    return clean;
  }

  /* Texte brut d'un fragment (recherche, repli, export). */
  function toPlainText(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = sanitize(html);
    return (tmp.innerText || tmp.textContent || '').replace(/\n+$/, '');
  }

  /* ------------------------------------------------------- commandes */

  function focusEditable() {
    var a = document.activeElement;
    if (a && a.isContentEditable) return a;
    return document.querySelector('.is-editing');
  }

  /* La sélection du champ riche survit aux clics dans la barre d'outils
   * (les boutons n'y prennent jamais le focus) ; les popovers (police,
   * surlignage) peuvent la perdre : la dernière plage à l'intérieur de
   * l'éditeur est donc mémorisée et restaurée avant chaque commande. */
  var savedRange = null;

  document.addEventListener('selectionchange', function () {
    try {
      var host = focusEditable();
      var sel = window.getSelection();
      if (host && sel && sel.rangeCount && host.contains(sel.anchorNode)) {
        savedRange = sel.getRangeAt(0).cloneRange();
      }
    } catch (e) {
      /* jamais bloquant */
    }
  });

  function prepare() {
    try {
      document.execCommand('styleWithCSS', false, true);
    } catch (e) {
      /* moteur sans support : le formatage marche quand même */
    }
  }

  function exec(cmd, value) {
    var node = focusEditable();
    if (!node) return false;
    node.focus();
    try {
      if (savedRange && node.contains(savedRange.startContainer)) {
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
    } catch (e) {
      /* restauration impossible : la commande agit au caret */
    }
    prepare();
    var ok = false;
    try {
      ok = document.execCommand(cmd, false, value === undefined ? null : value);
    } catch (e) {
      ok = false;
    }
    node.dispatchEvent(new Event('input', { bubbles: true }));
    return ok;
  }

  function queryState(cmd) {
    try {
      return document.queryCommandState(cmd);
    } catch (e) {
      return false;
    }
  }

  /* --------------------------------------------------- listes à puces */

  /* Convertit un contenu (HTML ou texte) en liste à puces : chaque
   * paragraphe / ligne devient un <li>. Utilisé par le bouton « Liste à
   * puces » de l'inspecteur (note entière) — la sélection seule passe par
   * exec('insertUnorderedList'). */
  function toBulletList(content) {
    var items = [];
    var text = String(content == null ? '' : content);
    if (/<(ul|ol)[ >]/i.test(text)) {
      /* déjà une liste : conservée telle quelle */
      return sanitize(text);
    }
    var lines = toPlainText(text).split('\n');
    lines.forEach(function (l) {
      var t = l.trim();
      if (t) items.push(t);
    });
    if (!items.length) return '';
    var html = '<ul>' + items.map(function (t) {
      return '<li>' + escapeForHtml(t) + '</li>';
    }).join('') + '</ul>';
    return html;
  }

  function escapeForHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* Retire le formatage d'un contenu entier (bouton « effacer la mise en
   * forme » de l'inspecteur). */
  function stripFormatting(content) {
    return escapeForHtml(toPlainText(content));
  }

  MB.rich = {
    sanitize: sanitize,
    toPlainText: toPlainText,
    exec: exec,
    queryState: queryState,
    toBulletList: toBulletList,
    stripFormatting: stripFormatting
  };
})();

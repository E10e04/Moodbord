/* =========================================================================
 * host.script.jsx — Côté Illustrator (ExtendScript).
 * Chargé automatiquement via <ScriptPath> du manifest.
 *
 * Protocole : chaînes délimitées « champ|champ » ou « ERR|message »,
 * ExtendScript n'ayant pas d'objet JSON natif.
 * ========================================================================= */

function mbPing() {
  try {
    return 'pong|' + app.version;
  } catch (e) {
    return 'ERR|' + e.message;
  }
}

function mbGetDocInfo() {
  try {
    if (app.documents.length === 0) return 'ERR|Aucun document ouvert';
    var d = app.activeDocument;
    var mode = 'RGB';
    try {
      mode = d.documentColorSpace === DocumentColorSpace.CMYK ? 'CMYK' : 'RGB';
    } catch (e2) {
      mode = 'inconnu';
    }
    return [d.name, mode, String(d.layers.length), String(d.swatches.length)].join('|');
  } catch (e) {
    return 'ERR|' + e.message;
  }
}

function mbColorToHex(c) {
  try {
    if (c.typename === 'RGBColor') {
      var r = Math.round(c.red);
      var g = Math.round(c.green);
      var b = Math.round(c.blue);
      return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }
    if (c.typename === 'CMYKColor') {
      var r2 = Math.round(255 * (1 - c.cyan / 100) * (1 - c.black / 100));
      var g2 = Math.round(255 * (1 - c.magenta / 100) * (1 - c.black / 100));
      var b2 = Math.round(255 * (1 - c.yellow / 100) * (1 - c.black / 100));
      return ((1 << 24) + (r2 << 16) + (g2 << 8) + b2).toString(16).slice(1).toUpperCase();
    }
    if (c.typename === 'GrayColor') {
      var v = Math.round(255 - c.gray);
      return ((1 << 24) + (v << 16) + (v << 8) + v).toString(16).slice(1).toUpperCase();
    }
    if (c.typename === 'SpotColor') {
      return mbColorToHex(c.spot.color);
    }
    return 'CCCCCC';
  } catch (e) {
    return 'CCCCCC';
  }
}

function mbGetSwatches() {
  try {
    if (app.documents.length === 0) return 'ERR|Aucun document ouvert';
    var d = app.activeDocument;
    var out = [];
    for (var i = 0; i < d.swatches.length; i++) {
      var sw = d.swatches[i];
      if (sw.name === 'None' || sw.name === '[None]' || sw.name === '[Registration]') continue;
      out.push(sw.name + '|' + mbColorToHex(sw.color));
    }
    if (out.length === 0) return 'ERR|Aucune nuance exploitable';
    return out.join(';');
  } catch (e) {
    return 'ERR|' + e.message;
  }
}

function mbAddSwatches(payload) {
  try {
    if (app.documents.length === 0) return 'ERR|Aucun document ouvert';
    var d = app.activeDocument;
    var pairs = payload.split(';');
    var count = 0;
    for (var i = 0; i < pairs.length; i++) {
      var parts = pairs[i].split('|');
      if (parts.length < 2) continue;
      var name = parts[0];
      var hex = parts[1];
      var r = parseInt(hex.substring(0, 2), 16);
      var g = parseInt(hex.substring(2, 4), 16);
      var b = parseInt(hex.substring(4, 6), 16);
      if (isNaN(r) || isNaN(g) || isNaN(b)) continue;
      var col = new RGBColor();
      col.red = r;
      col.green = g;
      col.blue = b;
      var sw = d.swatches.add();
      sw.name = name;
      sw.color = col;
      count++;
    }
    if (count === 0) return 'ERR|Aucune couleur valide';
    app.redraw();
    return 'OK|' + count;
  } catch (e) {
    return 'ERR|' + e.message;
  }
}

function mbPlaceFile(path) {
  try {
    if (app.documents.length === 0) return 'ERR|Aucun document ouvert';
    var f = new File(path);
    if (!f.exists) return 'ERR|Fichier introuvable : ' + path;
    var d = app.activeDocument;
    var placed = d.placedItems.add();
    placed.file = f;
    try {
      placed.position = [0, 0];
    } catch (eP) {
      /* position par défaut */
    }
    app.redraw();
    return 'OK';
  } catch (e) {
    return 'ERR|' + e.message;
  }
}

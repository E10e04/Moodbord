/* =========================================================================
 * kbtest.js — Harnais de test CLAVIER RÉEL pour Moodboard Desktop v1.1.2.
 *
 * Reproduit main.js (menu natif, preload, file://, IPC fs) puis injecte de
 * VRAIS événements clavier OS (sendInputEvent — noms DomCode : « Right »,
 * pas « ArrowRight ») et vérifie la chaîne complète :
 *   livraison keydown → handler → état de l'app.
 *
 * Usage : Xvfb :99 puis DISPLAY=:99 npx electron kbtest.js
 * ========================================================================= */
'use strict';

const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.commandLine.appendSwitch('allow-file-access-from-files');
app.commandLine.appendSwitch('no-sandbox');

let win = null;
const consoleErrors = [];

function send(action) {
  if (win && !win.isDestroyed()) win.webContents.send('menu-action', action);
}

function buildMenu() {
  const template = [];
  template.push({
    label: 'Fichier',
    submenu: [
      { label: 'Nouveau moodboard', click: () => send('file:new') },
      { label: 'Ouvrir…', click: () => send('file:open') },
      { label: 'Enregistrer', click: () => send('file:save') },
      { label: 'Enregistrer sous…', click: () => send('file:saveas') },
      { type: 'separator' },
      { role: 'close', label: 'Fermer la fenêtre' }
    ]
  });
  template.push({
    label: 'Affichage',
    submenu: [
      { role: 'reload', label: 'Recharger' },
      { role: 'toggleDevTools', label: 'Outils de développement' }
    ]
  });
  template.push({
    label: 'Aide',
    submenu: [{ label: 'Raccourcis clavier', click: () => send('help:shortcuts') }]
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------- couche IPC fs (parité cep.fs) — identique à main.js ------- */
function errnoOf(err) {
  if (!err) return 1;
  if (err.code === 'ENOENT') return 2;
  if (err.code === 'EACCES' || err.code === 'EPERM') return 13;
  return 1;
}
function validPath(p) {
  return typeof p === 'string' && p.length > 0 && path.isAbsolute(p);
}
ipcMain.on('fs:read', (e, p, enc) => {
  if (!validPath(p)) { e.returnValue = { err: 1 }; return; }
  try {
    const data = fs.readFileSync(p, enc === 'Base64' ? 'base64' : 'utf8');
    e.returnValue = { err: 0, data };
  } catch (err) { e.returnValue = { err: errnoOf(err) }; }
});
ipcMain.on('fs:write', (e, p, data, enc) => {
  if (!validPath(p) || typeof data !== 'string') { e.returnValue = { err: 1 }; return; }
  try {
    fs.writeFileSync(p, enc === 'Base64' ? Buffer.from(data, 'base64') : data, 'utf8');
    e.returnValue = { err: 0 };
  } catch (err) { e.returnValue = { err: errnoOf(err) }; }
});
ipcMain.on('fs:mkdir', (e, p) => {
  try { fs.mkdirSync(p, { recursive: true }); e.returnValue = { err: 0 }; }
  catch (err) { e.returnValue = { err: errnoOf(err) }; }
});
ipcMain.on('fs:unlink', (e, p) => {
  try { fs.unlinkSync(p); e.returnValue = { err: 0 }; }
  catch (err) { e.returnValue = { err: err && err.code === 'ENOENT' ? 0 : errnoOf(err) }; }
});
ipcMain.on('desktop:dataDir', (e) => {
  try {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    e.returnValue = dir;
  } catch (err) { e.returnValue = ''; }
});
ipcMain.handle('dialog:save', async () => null); /* neutre : jamais déclenché */
ipcMain.handle('dialog:open', async () => null);
ipcMain.handle('desktop:info', () => ({ platform: process.platform }));

async function run() {
  const results = [];
  const ok = (name, pass, detail) => results.push({ name, pass: !!pass, detail: detail || '' });
  const exec = (js) => win.webContents.executeJavaScript(js, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* press : keyDown + (char si touche imprimable sans modificateur) + keyUp.
   * NB noms DomCode pour sendInputEvent : Right/Left/Up/Down (pas
   * « ArrowRight » — ce nom arrive avec key="" et est sainement ignoré). */
  function press(keyCode, modifiers) {
    const mods = modifiers || [];
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers: mods });
    if (mods.length === 0 && keyCode.length === 1) {
      win.webContents.sendInputEvent({ type: 'char', keyCode });
    }
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers: mods });
  }

  /* Remise à zéro déterministe entre les groupes de tests. */
  async function resetDemo() {
    await exec('MB.app.loadDemo(false)');
    await sleep(500); /* fit animé 90 ms + rafraîchissement */
  }

  try {
    await sleep(1400); // boot + démo

    /* 0. Santé de base */
    const ver = await exec('(window.MB && MB.VERSION) || ""');
    ok('boot — version 1.1.2', ver === '1.1.2', 'MB.VERSION=' + ver);
    const mode = await exec('(MB.storage && MB.storage.mode) ? MB.storage.mode() : "?"');
    ok('boot — mode desktop + dossier disque', mode === 'desktop', 'mode=' + mode);
    const focus = await exec('document.activeElement ? document.activeElement.tagName : "?"');
    ok('boot — focus initial hors champ', focus === 'BODY', focus);
    let nAll = await exec('MB.store.s().elements.length');
    let nSel = await exec(
      'MB.store.s().elements.filter(function (e) { return !e.parentId && !e.hidden && !e.locked; }).length'
    );
    ok('boot — démo chargée', nAll >= 15, nAll + ' éléments dont ' + nSel + ' sélectionnables');

    /* 1. Outils */
    press('h');
    await sleep(120);
    let tool = await exec('MB.store.s().tool');
    ok('H → outil Main', tool === 'pan', 'outil=' + tool);
    press('v');
    await sleep(120);
    tool = await exec('MB.store.s().tool');
    ok('V → outil Sélection', tool === 'select', 'outil=' + tool);

    /* 2. Ctrl+A / Delete / Ctrl+Z / Ctrl+⇧+Z / Ctrl+Y */
    press('a', ['ctrl']);
    await sleep(120);
    let sel = await exec('MB.store.s().selection.ids.length');
    ok('Ctrl+A → tout sélectionner (racines)', sel === nSel, sel + '/' + nSel);
    press('Delete');
    await sleep(150);
    let n = await exec('MB.store.s().elements.length');
    ok('Delete → supprimer', n === nAll - nSel, n + ' restants (attendu ' + (nAll - nSel) + ')');
    press('z', ['ctrl']);
    await sleep(150);
    n = await exec('MB.store.s().elements.length');
    ok('Ctrl+Z → annuler', n === nAll, n + '/' + nAll);
    press('z', ['ctrl', 'shift']);
    await sleep(150);
    n = await exec('MB.store.s().elements.length');
    ok('Ctrl+⇧+Z → rétablir', n === nAll - nSel, n + ' (attendu ' + (nAll - nSel) + ')');
    press('z', ['ctrl']); /* un pas d'historique en arrière pour Y */
    await sleep(150);
    press('y', ['ctrl']);
    await sleep(150);
    n = await exec('MB.store.s().elements.length');
    ok('Ctrl+Y → rétablir (bis)', n === nAll - nSel, n + ' (attendu ' + (nAll - nSel) + ')');
    press('Escape');
    await sleep(120);
    sel = await exec('MB.store.s().selection.ids.length');
    ok('Échap → désélection', sel === 0, sel + ' restants');

    /* 3. Zoom clavier */
    press('1', ['shift']);
    await sleep(400);
    const zFit = await exec('MB.store.s().camera.zoom');
    ok('⇧1 → ajuster à l’écran', Math.abs(zFit - 1) > 0.005, 'zoom=' + zFit.toFixed(3));
    press('0');
    await sleep(150);
    ok('0 → zoom 100 %', Math.abs(await exec('MB.store.s().camera.zoom') - 1) < 0.001, '');
    press('+', ['shift']);
    await sleep(150);
    ok('+ → zoom avant ×1,25', Math.abs(await exec('MB.store.s().camera.zoom') - 1.25) < 0.01, '');
    press('-');
    await sleep(150);
    ok('− → zoom arrière /1,25', Math.abs(await exec('MB.store.s().camera.zoom') - 1) < 0.01, '');
    /* NOUVEAU v1.1.2 : ⌘+ / ⌘− / ⌘= / ⌘0 (standard macOS) */
    press('=', ['ctrl']);
    await sleep(150);
    ok('Ctrl+= → zoom avant (standard ⌘+)', Math.abs(await exec('MB.store.s().camera.zoom') - 1.25) < 0.01, '');
    press('+', ['ctrl', 'shift']);
    await sleep(150);
    ok('Ctrl+⇧++ → zoom avant (AZERTY)', Math.abs(await exec('MB.store.s().camera.zoom') - 1.5625) < 0.02, '');
    press('-', ['ctrl']);
    await sleep(150);
    ok('Ctrl+− → zoom arrière', Math.abs(await exec('MB.store.s().camera.zoom') - 1.25) < 0.02, '');
    press('0', ['ctrl']);
    await sleep(150);
    ok('Ctrl+0 → zoom 100 %', Math.abs(await exec('MB.store.s().camera.zoom') - 1) < 0.001, '');

    /* 4. Espace : mode pan */
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
    await sleep(120);
    const spaceOn = await exec('!!document.getElementById("board-wrap").classList.contains("is-space")');
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
    await sleep(120);
    const spaceOff = await exec('!document.getElementById("board-wrap").classList.contains("is-space")');
    ok('Espace → mode pan (maintenu puis relâché)', spaceOn && spaceOff, '');

    /* 5. ? : dialogue raccourcis (contient les NOUVELLES lignes v1.1.2) */
    press('?', ['shift']);
    await sleep(200);
    const dlg = await exec('!!document.querySelector(".dialog")');
    const hasNewRows = await exec(
      'document.querySelector(".dialog") ? document.querySelector(".dialog").textContent.indexOf("Flèches") >= 0 && document.querySelector(".dialog").textContent.indexOf("⌘+ / ⌘−") >= 0 : false'
    );
    ok('? → dialogue raccourcis à jour (Flèches + ⌘+/⌘−)', dlg && hasNewRows, 'dialogue=' + dlg + ' lignes nouvelles=' + hasNewRows);
    if (dlg) {
      await exec('(function(){var b=document.querySelector(".dialog .dialog-actions button"); if(b) b.click(); return true;})()');
      await sleep(150);
    }

    /* 6. Flèches : déplacement + historique (reset propre d'abord) */
    await resetDemo();
    const el0 = await exec('(function(){var s=MB.store.s(); var e=s.elements.filter(function(x){return !x.parentId && !x.hidden && !x.locked;})[0]; MB.store.setSelection([e.id]); return {id:e.id,x:e.x,y:e.y};})()');
    await sleep(150);
    const zoomNow = await exec('MB.store.s().camera.zoom');
    press('Right');
    await sleep(200);
    const afterR = await exec('(function(){var e=MB.store.el("' + el0.id + '"); return {x:e.x,y:e.y};})()');
    const wantDx = 1 / zoomNow;
    ok(
      'Flèche → → déplacer 1 px écran',
      Math.abs(afterR.x - (el0.x + wantDx)) < 0.01 && Math.abs(afterR.y - el0.y) < 0.01,
      'Δx=' + (afterR.x - el0.x).toFixed(4) + ' attendu ' + wantDx.toFixed(4) + ' (zoom=' + zoomNow.toFixed(3) + ')'
    );
    press('Up', ['shift']);
    await sleep(200);
    const afterU = await exec('(function(){var e=MB.store.el("' + el0.id + '"); return {x:e.x,y:e.y};})()');
    ok('⇧+Flèche ↑ → déplacer ×10', Math.abs(afterU.y - (afterR.y - 10 / zoomNow)) < 0.05, 'Δy=' + (afterU.y - afterR.y).toFixed(3) + ' attendu ' + (-10 / zoomNow).toFixed(3));
    press('z', ['ctrl']);
    await sleep(200);
    const afterZ = await exec('(function(){var e=MB.store.el("' + el0.id + '"); return {x:e.x,y:e.y};})()');
    ok('Ctrl+Z annule le déplacement clavier', Math.abs(afterZ.x - afterR.x) < 0.01 && Math.abs(afterZ.y - afterR.y) < 0.01, 'retour à (' + afterZ.x.toFixed(2) + ', ' + afterZ.y.toFixed(2) + ')');

    /* 7. LE PIÈGE v1.1.0 : focus dans le nom du projet */
    await resetDemo();
    const nameBefore = await exec('document.getElementById("proj-name").value');
    await exec('document.getElementById("proj-name").focus()');
    await sleep(100);
    press('h');
    await sleep(150);
    tool = await exec('MB.store.s().tool');
    const typed = await exec('document.getElementById("proj-name").value');
    ok('champ nom : H reste au champ (lettre tapée, outil inchangé)', tool === 'select' && typed.length === nameBefore.length + 1, 'outil=' + tool + ' valeur="' + typed + '"');
    /* ⌘Z applicatif PENDANT la saisie — comportement Illustrator */
    press('z', ['ctrl']);
    await sleep(200);
    const focusStill = await exec('document.activeElement && document.activeElement.id');
    const nameAfterUndo = await exec('document.getElementById("proj-name").value');
    ok('champ nom : Ctrl+Z applicatif (le champ garde le focus, pas de texte perdu)', focusStill === 'proj-name' && nameAfterUndo.length <= typed.length + 1, 'focus=' + focusStill);
    /* Échap rend le clavier */
    press('Escape');
    await sleep(150);
    const focusNow = await exec('document.activeElement ? document.activeElement.tagName : "?"');
    ok('Échap dans le champ → rend le clavier à l’app', focusNow !== 'INPUT', focusNow);
    /* et les raccourcis reviennent */
    await exec('document.getElementById("proj-name").value = "Sans titre"');
    press('h');
    await sleep(150);
    tool = await exec('MB.store.s().tool');
    ok('après Échap : H redevient actif', tool === 'pan', 'outil=' + tool);
    press('v');
    await sleep(100);

    /* 8. Ctrl+D / Ctrl+G / Ctrl+C+V (reset propre) */
    await resetDemo();
    nAll = await exec('MB.store.s().elements.length');
    nSel = await exec(
      'MB.store.s().elements.filter(function (e) { return !e.parentId && !e.hidden && !e.locked; }).length'
    );
    press('a', ['ctrl']);
    await sleep(150);
    press('d', ['ctrl']);
    await sleep(250);
    n = await exec('MB.store.s().elements.length');
    ok('Ctrl+D → dupliquer', n === nAll + nSel, n + ' (attendu ' + (nAll + nSel) + ')');
    press('z', ['ctrl']);
    await sleep(200);
    press('g', ['ctrl']);
    await sleep(250);
    n = await exec('MB.store.s().elements.length');
    const nGroups = await exec('MB.store.s().elements.filter(function (e) { return e.type === "group"; }).length');
    const grpSel = await exec('MB.store.s().selection.ids.length');
    ok('Ctrl+G → grouper (liste plate : +1 élément groupe)', n === nAll + 1 && nGroups === 1 && grpSel === 1, n + ' éléments, ' + nGroups + ' groupe, sélection=' + grpSel);
    press('g', ['ctrl', 'shift']);
    await sleep(250);
    n = await exec('MB.store.s().elements.length');
    const nRootsAfter = await exec('MB.store.s().elements.filter(function (e) { return !e.parentId; }).length');
    ok('Ctrl+⇧+G → dissocier', n === nAll && nRootsAfter === nSel, n + '/' + nAll + ' racines=' + nRootsAfter + '/' + nSel);
    press('c', ['ctrl']);
    await sleep(150);
    press('v', ['ctrl']);
    await sleep(250);
    n = await exec('MB.store.s().elements.length');
    ok('Ctrl+C puis Ctrl+V → coller', n === nAll + nSel, n + ' (attendu ' + (nAll + nSel) + ')');
    press('z', ['ctrl']);
    await sleep(200);

    /* 9. Backspace aussi */
    press('a', ['ctrl']);
    await sleep(150);
    press('Backspace');
    await sleep(200);
    n = await exec('MB.store.s().elements.length');
    ok('Backspace → supprimer', n === nAll - nSel, n + ' restants');
    press('z', ['ctrl']);
    await sleep(200);

    /* 10. Compteurs clavier diagnostiques (NOUVEAU v1.1.2) */
    const kd = await exec('(MB.EVT_DIAG && MB.EVT_DIAG.keydown) || 0');
    const ku = await exec('(MB.EVT_DIAG && MB.EVT_DIAG.keyup) || 0');
    ok('sonde diagnostique : keydown/keyup comptés', kd >= 30 && ku >= 30, 'keydown=' + kd + ' keyup=' + ku);
    const diagReport = await exec('MB.diaglog.report()');
    ok('rapport de diagnostic contient les compteurs clavier', /keydown=\d+/.test(diagReport) && /keyup=\d+/.test(diagReport), '');

    /* 11. Erreurs console */
    ok('zéro erreur console', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | ') || 'aucune');
  } catch (err) {
    ok('exécution du harnais', false, String((err && err.message) || err));
  }

  const passed = results.filter((r) => r.pass).length;
  console.log('\n===== KBTEST MOODBOARD DESKTOP v1.1.2 (vrais événements OS) =====');
  results.forEach((r) => {
    console.log((r.pass ? 'PASS' : 'FAIL') + ' — ' + r.name + (r.detail ? '  [' + r.detail + ']' : ''));
  });
  console.log('===== ' + passed + '/' + results.length + ' PASSÉS =====\n');
  app.exit(passed === results.length ? 0 : 1);
}

app.whenReady().then(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'moodboard-kb-'));
  app.setPath('userData', tmp);
  buildMenu();
  win = new BrowserWindow({
    width: 1480,
    height: 940,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) consoleErrors.push(String(message).slice(0, 300));
  });
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    run();
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
});

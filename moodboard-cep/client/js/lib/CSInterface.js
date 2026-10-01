/* =========================================================================
 * CSInterface.js — Version adaptée et allégée de la bibliothèque Adobe CEP.
 *
 * Basée sur l'API publique documentée de CEP (Adobe Common Extensibility
 * Platform). Seules les fonctionnalités utilisées par ce panneau sont
 * conservées : evalScript, chemins système, environnement hôte, ouverture
 * d'URL. L'API expose par le point d'entrée global `window.__adobe_cep__`
 * fourni par le runtime CEP.
 * ========================================================================= */

/* Constantes officielles de l'API CEP — et les seules valides : le moteur
 * répond « Invalid Input Params » à toute autre clé (ex. « extensionData »,
 * « temporary » n'existent pas). */
function SystemPath() {}
SystemPath.USER_DATA = 'userData';
SystemPath.COMMON_FILES = 'commonFiles';
SystemPath.MY_DOCUMENTS = 'myDocuments';
SystemPath.APPLICATION = 'application';
SystemPath.EXTENSION = 'extension';
SystemPath.HOST_APPLICATION = 'hostApplication';

function CSEvent(type, scope, appId, extensionId) {
  this.type = type;
  this.scope = scope;
  this.appId = appId;
  this.extensionId = extensionId;
  this.data = '';
}

function CSInterface() {}

/** Envoyer du code ExtendScript à l'application hôte (Illustrator). */
CSInterface.prototype.evalScript = function (script, callback) {
  if (callback === null || callback === undefined) {
    callback = function () {};
  }
  if (window.__adobe_cep__) {
    window.__adobe_cep__.evalScript(script, callback);
  } else {
    callback('EvalScript error: CEP indisponible (hors Illustrator).');
  }
};

/** Informations sur l'hôte (application, version, thème…).
 *  Le moteur CEP renvoie une CHAÎNE JSON : sans parsing, tous les
 *  champs du rapport de diagnostic sortaient « ? » (v1.1.3 :
 *  « Hôte : ? ? · appId=? · API CEP=? »). */
CSInterface.prototype.getHostEnvironment = function () {
  if (!window.__adobe_cep__) {
    return JSON.stringify({
      appId: 'ILST',
      appVersion: '0000',
      appName: 'Aperçu navigateur',
      appBarInfo: { baseThemeColor: '#1E1E1E' }
    });
  }
  var raw = window.__adobe_cep__.getHostEnvironment();
  if (typeof raw !== 'string') return raw || null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
};

/** Résoudre un chemin système spécial. */
CSInterface.prototype.getSystemPath = function (pathType) {
  if (!window.__adobe_cep__) {
    return '';
  }
  var path = decodeURI(window.__adobe_cep__.getSystemPath(pathType));
  var OSVersion = this.getOSInformation();
  if (OSVersion.indexOf('Windows') >= 0) {
    path = path.replace('file:///', '');
  } else if (OSVersion.indexOf('Mac') >= 0) {
    path = path.replace('file://', '');
  }
  return path;
};

CSInterface.prototype.getOSInformation = function () {
  var userAgent = navigator.userAgent;
  if (navigator.platform === 'Win32' || navigator.platform === 'Windows') {
    return 'Windows';
  } else if (navigator.platform === 'MacIntel' || navigator.platform === 'Macintosh') {
    return 'Mac OS X';
  }
  return 'Unknown OS';
};

/** Ouvrir une URL dans le navigateur par défaut du système. */
CSInterface.prototype.openURLInDefaultBrowser = function (url) {
  if (window.__adobe_cep__) {
    window.cep.util.openURLInDefaultBrowser(url);
  } else if (typeof window !== 'undefined') {
    window.open(url, '_blank');
  }
};

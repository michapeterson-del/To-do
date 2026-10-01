const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const CONFIG_FILENAME = 'config.json';

const DEFAULTS = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  anthropicApiKey: '',
  claudeModel: 'claude-sonnet-5',
  hotkey: 'CommandOrControl+Shift+T',
};

// Diese Felder werden über den Schlüsselbund des Betriebssystems verschlüsselt
// gespeichert (macOS Keychain / Windows DPAPI), nicht im Klartext.
const SECRET_FIELDS = ['supabaseAnonKey', 'anthropicApiKey'];
const ENC_PREFIX = 'enc:';

function canEncrypt() {
  try {
    return app.isReady() && safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function encryptSecrets(config) {
  if (!canEncrypt()) return config;
  const out = { ...config };
  for (const field of SECRET_FIELDS) {
    const value = out[field];
    if (value && !String(value).startsWith(ENC_PREFIX)) {
      out[field] = ENC_PREFIX + safeStorage.encryptString(String(value)).toString('base64');
    }
  }
  return out;
}

function decryptSecrets(config) {
  const out = { ...config };
  for (const field of SECRET_FIELDS) {
    const value = out[field];
    if (typeof value === 'string' && value.startsWith(ENC_PREFIX)) {
      try {
        out[field] = safeStorage.decryptString(Buffer.from(value.slice(ENC_PREFIX.length), 'base64'));
      } catch {
        out[field] = '';
      }
    }
  }
  return out;
}

function configPath() {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

function saveToDisk(config) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(encryptSecrets(config), null, 2), { encoding: 'utf8', mode: 0o600 });
  try { fs.chmodSync(configPath(), 0o600); } catch { /* Windows */ }
}

function readConfig() {
  let stored;
  try {
    stored = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    return { ...DEFAULTS };
  }
  const config = { ...DEFAULTS, ...decryptSecrets(stored) };
  // Alte Konfiguration mit Klartext-Schlüsseln einmalig verschlüsselt neu speichern.
  if (canEncrypt() && SECRET_FIELDS.some((f) => stored[f] && !String(stored[f]).startsWith(ENC_PREFIX))) {
    try { saveToDisk(config); } catch { /* beim nächsten Speichern erneut */ }
  }
  return config;
}

function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  saveToDisk(next);
  return next;
}

function isConfigured(config = readConfig()) {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey && config.anthropicApiKey);
}

module.exports = { readConfig, writeConfig, isConfigured, configPath };

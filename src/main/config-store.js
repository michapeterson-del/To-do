const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CONFIG_FILENAME = 'config.json';

const DEFAULTS = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  anthropicApiKey: '',
  claudeModel: 'claude-sonnet-5',
  hotkey: 'CommandOrControl+Shift+T',
};

function configPath() {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

function readConfig() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function isConfigured(config = readConfig()) {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey && config.anthropicApiKey);
}

module.exports = { readConfig, writeConfig, isConfigured, configPath };

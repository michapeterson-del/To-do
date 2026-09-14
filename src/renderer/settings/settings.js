const form = document.getElementById('settingsForm');
const status = document.getElementById('status');

const fields = {
  supabaseUrl: document.getElementById('supabaseUrl'),
  supabaseAnonKey: document.getElementById('supabaseAnonKey'),
  anthropicApiKey: document.getElementById('anthropicApiKey'),
  claudeModel: document.getElementById('claudeModel'),
  hotkey: document.getElementById('hotkey'),
};

async function load() {
  const config = await window.api.settings.get();
  for (const [key, el] of Object.entries(fields)) {
    el.value = config[key] || '';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  status.textContent = 'Speichere...';
  status.className = 'status';

  const patch = {};
  for (const [key, el] of Object.entries(fields)) {
    patch[key] = el.value.trim();
  }

  try {
    const { hotkeyOk } = await window.api.settings.save(patch);
    if (hotkeyOk) {
      status.textContent = 'Gespeichert.';
      status.className = 'status ok';
    } else {
      status.textContent = 'Gespeichert, aber das Tastenkuerzel konnte nicht registriert werden (evtl. belegt).';
      status.className = 'status err';
    }
  } catch (err) {
    status.textContent = `Fehler: ${err.message || err}`;
    status.className = 'status err';
  }
});

load();

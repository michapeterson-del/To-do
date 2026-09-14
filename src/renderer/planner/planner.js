const listToday = document.getElementById('listToday');
const listProcess = document.getElementById('listProcess');
const countToday = document.getElementById('countToday');
const countProcess = document.getElementById('countProcess');
const hint = document.getElementById('hint');

let tasks = [];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderColumn(listEl, countEl, category) {
  const items = tasks
    .filter((t) => t.category === category)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
      return new Date(a.created_at) - new Date(b.created_at);
    });

  countEl.textContent = String(items.length);
  listEl.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'Noch keine Aufgaben hier.';
    listEl.appendChild(empty);
    return;
  }

  for (const task of items) {
    listEl.appendChild(renderTaskItem(task));
  }
}

function renderTaskItem(task) {
  const li = document.createElement('li');
  li.className = 'task-item' + (task.status === 'done' ? ' done' : '');
  li.dataset.id = task.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task.status === 'done';
  checkbox.addEventListener('change', () => {
    updateTask(task.id, { status: checkbox.checked ? 'done' : 'open' });
  });

  const body = document.createElement('div');
  body.className = 'task-body';

  const title = document.createElement('div');
  title.className = 'task-title';
  title.contentEditable = 'true';
  title.spellcheck = false;
  title.textContent = task.title;
  title.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      title.blur();
    } else if (e.key === 'Escape') {
      title.textContent = task.title;
      title.blur();
    }
  });
  title.addEventListener('blur', () => {
    const newTitle = title.textContent.trim();
    if (newTitle && newTitle !== task.title) {
      updateTask(task.id, { title: newTitle });
    } else {
      title.textContent = task.title;
    }
  });
  body.appendChild(title);

  if (task.description) {
    const desc = document.createElement('div');
    desc.className = 'task-description';
    desc.textContent = task.description;
    body.appendChild(desc);
  }

  if (task.category === 'process') {
    body.appendChild(renderStepField(task, 'last_steps', 'Bisher', 'Bisherige Schritte eintragen...'));
    body.appendChild(renderStepField(task, 'next_steps', 'Nächste', 'Nächste Schritte eintragen...'));
  }

  if (task.source === 'screenshot') {
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = '📸 per Screenshot erkannt';
    meta.appendChild(badge);
    body.appendChild(meta);
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'task-delete';
  deleteBtn.textContent = '✕';
  deleteBtn.title = 'Aufgabe loeschen';
  deleteBtn.addEventListener('click', () => removeTask(task.id));

  li.appendChild(checkbox);
  li.appendChild(body);
  li.appendChild(deleteBtn);
  return li;
}

function renderStepField(task, field, label, placeholder) {
  const wrap = document.createElement('div');
  wrap.className = 'step-field';

  const labelEl = document.createElement('span');
  labelEl.className = 'step-label';
  labelEl.textContent = `${label}:`;

  const value = document.createElement('div');
  value.className = 'step-value';
  value.contentEditable = 'true';
  value.spellcheck = false;
  value.textContent = task[field] || '';
  value.dataset.placeholder = placeholder;
  value.classList.toggle('empty', !task[field]);

  value.addEventListener('focus', () => {
    value.classList.remove('empty');
  });
  value.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      value.blur();
    } else if (e.key === 'Escape') {
      value.textContent = task[field] || '';
      value.blur();
    }
  });
  value.addEventListener('blur', () => {
    const text = value.textContent.trim();
    value.classList.toggle('empty', !text);
    if (text !== (task[field] || '')) {
      updateTask(task.id, { [field]: text });
    }
  });

  wrap.appendChild(labelEl);
  wrap.appendChild(value);
  return wrap;
}

function renderAll() {
  renderColumn(listToday, countToday, 'today');
  renderColumn(listProcess, countProcess, 'process');
}

async function loadTasks() {
  hint.textContent = 'Lade Aufgaben...';
  try {
    tasks = await window.api.tasks.list();
    hint.textContent = '';
    renderAll();
  } catch (err) {
    hint.textContent = `Fehler beim Laden: ${err.message || err}`;
  }
}

async function addTask(category, title) {
  const optimistic = {
    id: `tmp-${Date.now()}`,
    title,
    description: '',
    category,
    status: 'open',
    source: 'manual',
    last_steps: '',
    next_steps: '',
    created_at: new Date().toISOString(),
  };
  tasks.push(optimistic);
  renderAll();
  try {
    const created = await window.api.tasks.create({ title, category });
    tasks = tasks.map((t) => (t.id === optimistic.id ? created : t));
  } catch (err) {
    tasks = tasks.filter((t) => t.id !== optimistic.id);
    hint.textContent = `Fehler beim Speichern: ${err.message || err}`;
  }
  renderAll();
}

async function updateTask(id, patch) {
  const before = tasks.find((t) => t.id === id);
  tasks = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
  renderAll();
  try {
    const updated = await window.api.tasks.update(id, patch);
    tasks = tasks.map((t) => (t.id === id ? updated : t));
    renderAll();
  } catch (err) {
    if (before) tasks = tasks.map((t) => (t.id === id ? before : t));
    renderAll();
    hint.textContent = `Fehler beim Speichern: ${err.message || err}`;
  }
}

async function removeTask(id) {
  const before = tasks;
  tasks = tasks.filter((t) => t.id !== id);
  renderAll();
  try {
    await window.api.tasks.remove(id);
  } catch (err) {
    tasks = before;
    renderAll();
    hint.textContent = `Fehler beim Loeschen: ${err.message || err}`;
  }
}

document.querySelectorAll('.add-form').forEach((form) => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const value = input.value.trim();
    if (!value) return;
    addTask(form.dataset.category, value);
    input.value = '';
  });
});

document.getElementById('captureBtn').addEventListener('click', () => {
  window.api.capture.triggerNow();
});
document.getElementById('refreshBtn').addEventListener('click', () => loadTasks());
document.getElementById('settingsBtn').addEventListener('click', () => {
  window.api.openSettingsWindow();
});

window.api.tasks.onChanged(() => loadTasks());
window.addEventListener('focus', () => loadTasks());

loadTasks();

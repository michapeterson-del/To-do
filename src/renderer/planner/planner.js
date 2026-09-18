const listToday = document.getElementById('listToday');
const listProcess = document.getElementById('listProcess');
const listDone = document.getElementById('listDone');
const countToday = document.getElementById('countToday');
const countProcess = document.getElementById('countProcess');
const countDone = document.getElementById('countDone');
const hint = document.getElementById('hint');
const searchInput = document.getElementById('searchInput');

let tasks = [];
let searchQuery = '';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderColumn(listEl, countEl, filterFn, sortFn) {
  const items = tasks.filter(filterFn).sort(sortFn);

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

function byCreatedAtAsc(a, b) {
  return new Date(a.created_at) - new Date(b.created_at);
}

function byUpdatedAtDesc(a, b) {
  return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
}

function renderTaskItem(task) {
  const li = document.createElement('li');
  li.className = 'task-item' + (task.status === 'done' ? ' done' : '');
  li.dataset.id = task.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task.status === 'done';
  checkbox.addEventListener('change', () => {
    const patch = { status: checkbox.checked ? 'done' : 'open' };
    if (checkbox.checked && Array.isArray(task.steps) && task.steps.some((s) => !s.done)) {
      patch.steps = task.steps.map((s) => ({ ...s, done: true }));
    }
    updateTask(task.id, patch);
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

  body.appendChild(renderDescription(task));
  body.appendChild(renderStepList(task));

  if (task.source === 'screenshot' || task.status === 'done') {
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    if (task.status === 'done') {
      const categoryBadge = document.createElement('span');
      categoryBadge.className = 'badge';
      categoryBadge.textContent = task.category === 'process' ? '🔁 Prozess' : '☀️ Heute';
      meta.appendChild(categoryBadge);
    }
    if (task.source === 'screenshot') {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = '📸 per Screenshot erkannt';
      meta.appendChild(badge);
    }
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

function renderDescription(task) {
  const desc = document.createElement('div');
  desc.className = 'task-description';
  desc.contentEditable = 'true';
  desc.spellcheck = false;
  desc.textContent = task.description || '';
  desc.dataset.placeholder = 'Notiz hinzufügen...';
  desc.classList.toggle('empty', !task.description);

  desc.addEventListener('focus', () => {
    desc.classList.remove('empty');
  });
  desc.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      desc.blur();
    } else if (e.key === 'Escape') {
      desc.textContent = task.description || '';
      desc.blur();
    }
  });
  desc.addEventListener('blur', () => {
    const text = desc.innerText.trim();
    desc.classList.toggle('empty', !text);
    if (text !== (task.description || '')) {
      updateTask(task.id, { description: text });
    } else {
      desc.textContent = task.description || '';
    }
  });

  return desc;
}

function renderStepList(task) {
  const steps = Array.isArray(task.steps) ? task.steps : [];
  let nextMarked = false;

  const wrap = document.createElement('div');
  wrap.className = 'step-list';

  const ul = document.createElement('ul');
  ul.className = 'steps';

  for (const step of steps) {
    const li = document.createElement('li');
    li.className = 'step' + (step.done ? ' done' : '');
    if (!step.done && !nextMarked) {
      li.classList.add('next');
      nextMarked = true;
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!step.done;
    checkbox.addEventListener('change', () => {
      const updated = steps.map((s) => (s.id === step.id ? { ...s, done: checkbox.checked } : s));
      updateTask(task.id, { steps: updated });
    });

    const text = document.createElement('span');
    text.className = 'step-text';
    text.contentEditable = 'true';
    text.spellcheck = false;
    text.textContent = step.text;
    text.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        text.blur();
      } else if (e.key === 'Escape') {
        text.textContent = step.text;
        text.blur();
      }
    });
    text.addEventListener('blur', () => {
      const value = text.textContent.trim();
      if (value && value !== step.text) {
        const updated = steps.map((s) => (s.id === step.id ? { ...s, text: value } : s));
        updateTask(task.id, { steps: updated });
      } else {
        text.textContent = step.text;
      }
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'step-delete';
    del.textContent = '×';
    del.title = 'Schritt entfernen';
    del.addEventListener('click', () => {
      const updated = steps.filter((s) => s.id !== step.id);
      updateTask(task.id, { steps: updated });
    });

    li.appendChild(checkbox);
    li.appendChild(text);
    li.appendChild(del);
    ul.appendChild(li);
  }
  wrap.appendChild(ul);

  const form = document.createElement('form');
  form.className = 'add-step-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 200;
  input.placeholder = '+ Schritt hinzufügen';
  form.appendChild(input);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    const updated = [...steps, { id: `s${Date.now()}`, text: value, done: false }];
    updateTask(task.id, { steps: updated });
    input.value = '';
  });
  wrap.appendChild(form);

  return wrap;
}

function matchesSearch(task) {
  if (!searchQuery) return true;
  const haystack = `${task.title} ${task.description || ''}`.toLowerCase();
  return haystack.includes(searchQuery);
}

function renderAll() {
  renderColumn(listToday, countToday, (t) => t.category === 'today' && t.status !== 'done' && matchesSearch(t), byCreatedAtAsc);
  renderColumn(listProcess, countProcess, (t) => t.category === 'process' && t.status !== 'done' && matchesSearch(t), byCreatedAtAsc);
  renderColumn(listDone, countDone, (t) => t.status === 'done' && matchesSearch(t), byUpdatedAtDesc);
}

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  renderAll();
});

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
    steps: [],
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

const doneDrawer = document.getElementById('doneDrawer');
const doneBackdrop = document.getElementById('doneBackdrop');

function openDoneDrawer() {
  doneDrawer.classList.add('open');
  doneBackdrop.classList.add('open');
}

function closeDoneDrawer() {
  doneDrawer.classList.remove('open');
  doneBackdrop.classList.remove('open');
}

document.getElementById('doneToggleBtn').addEventListener('click', openDoneDrawer);
document.getElementById('doneCloseBtn').addEventListener('click', closeDoneDrawer);
doneBackdrop.addEventListener('click', closeDoneDrawer);
document.getElementById('refreshBtn').addEventListener('click', () => loadTasks());
document.getElementById('settingsBtn').addEventListener('click', () => {
  window.api.openSettingsWindow();
});

window.api.tasks.onChanged(() => loadTasks());
window.addEventListener('focus', () => loadTasks());

loadTasks();

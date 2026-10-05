const listToday = document.getElementById('listToday');
const listProcess = document.getElementById('listProcess');
const listPrivate = document.getElementById('listPrivate');
const listDone = document.getElementById('listDone');
const listSeries = document.getElementById('listSeries');
const countToday = document.getElementById('countToday');
const countProcess = document.getElementById('countProcess');
const countPrivate = document.getElementById('countPrivate');
const countDone = document.getElementById('countDone');
const countSeries = document.getElementById('countSeries');
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

  if (countEl) countEl.textContent = String(items.length);
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

function byPriorityDesc(a, b) {
  const diff = (b.priority || 2) - (a.priority || 2);
  return diff !== 0 ? diff : new Date(a.created_at) - new Date(b.created_at);
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

  const ageBadge = document.createElement('span');
  ageBadge.className = 'badge';
  ageBadge.textContent = formatAge(task.created_at);
  body.appendChild(ageBadge);

  if (RECURRENCE_LABEL[task.recurrence]) {
    const recurrenceBadge = document.createElement('span');
    recurrenceBadge.className = 'badge';
    recurrenceBadge.textContent = RECURRENCE_LABEL[task.recurrence];
    body.appendChild(recurrenceBadge);
  }

  body.appendChild(renderStepList(task));

  if (task.event_datetime) {
    body.appendChild(renderEventDetails(task));
  }

  if (task.source === 'screenshot' || task.status === 'done') {
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    if (task.status === 'done') {
      const categoryBadge = document.createElement('span');
      categoryBadge.className = 'badge';
      categoryBadge.textContent =
        task.category === 'process' ? '🔁 Prozess' : task.category === 'private' ? '🔒 Privat' : '☀️ Heute';
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

  // Eigener Block-Container (kein Flex-Geschwister des Titels) fuer die
  // Auswahlfelder, damit sie den Titel nie zusammenquetschen koennen - sie
  // brechen innerhalb dieses Containers um, nicht der Titel.
  const selectsRow = document.createElement('div');
  selectsRow.className = 'task-selects-row';

  const moveSelect = document.createElement('select');
  moveSelect.className = 'task-move';
  moveSelect.title = 'In andere Kategorie verschieben';
  [
    { value: 'today', label: '☀️ Heute' },
    { value: 'process', label: '🔁 Prozess' },
    { value: 'private', label: '🔒 Privat' },
  ].forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    moveSelect.appendChild(option);
  });
  moveSelect.value = task.category;
  moveSelect.addEventListener('change', () => {
    updateTask(task.id, { category: moveSelect.value });
  });

  const prioritySelect = document.createElement('select');
  prioritySelect.className = 'task-move';
  prioritySelect.title = 'Prioritaet aendern';
  [
    { value: '3', label: '🔥 Hoch' },
    { value: '2', label: '➡️ Normal' },
    { value: '1', label: '🔽 Niedrig' },
  ].forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    prioritySelect.appendChild(option);
  });
  prioritySelect.value = String(task.priority || 2);
  prioritySelect.addEventListener('change', () => {
    updateTask(task.id, { priority: Number(prioritySelect.value) });
  });

  const recurrenceSelect = document.createElement('select');
  recurrenceSelect.className = 'task-move';
  recurrenceSelect.title = 'Wiederholung aendern';
  [
    { value: 'none', label: '🚫 Einmalig' },
    { value: 'daily', label: '🔁 Taeglich' },
    { value: 'weekly', label: '📅 Woechentlich' },
    { value: 'monthly', label: '🗓️ Monatlich' },
  ].forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    recurrenceSelect.appendChild(option);
  });
  recurrenceSelect.value = task.recurrence || 'none';

  const recurrenceDayInput = document.createElement('input');
  recurrenceDayInput.type = 'number';
  recurrenceDayInput.className = 'task-move recurrence-day-input';
  recurrenceDayInput.min = '1';
  recurrenceDayInput.max = '31';
  recurrenceDayInput.title = 'Tag des Monats, an dem die Aufgabe wieder auftaucht';
  recurrenceDayInput.placeholder = 'Tag';
  recurrenceDayInput.value = task.recurrence_day || '';
  recurrenceDayInput.hidden = task.recurrence !== 'monthly';
  recurrenceDayInput.addEventListener('change', () => {
    const day = Math.min(31, Math.max(1, Number(recurrenceDayInput.value) || 1));
    recurrenceDayInput.value = day;
    updateTask(task.id, { recurrence_day: day });
  });

  recurrenceSelect.addEventListener('change', () => {
    recurrenceDayInput.hidden = recurrenceSelect.value !== 'monthly';
    updateTask(task.id, { recurrence: recurrenceSelect.value });
  });

  selectsRow.appendChild(moveSelect);
  selectsRow.appendChild(prioritySelect);
  selectsRow.appendChild(recurrenceSelect);
  selectsRow.appendChild(recurrenceDayInput);
  body.appendChild(selectsRow);

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

function formatEventLabel(datetime) {
  const date = new Date(datetime);
  if (Number.isNaN(date.getTime())) return datetime;
  return date.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatAge(createdAt) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'heute angelegt';
  if (days === 1) return 'seit 1 Tag';
  return `seit ${days} Tagen`;
}

const RECURRENCE_LABEL = { daily: '🔁 Taeglich', weekly: '📅 Woechentlich', monthly: '🗓️ Monatlich' };

function renderEventDetails(task) {
  const details = document.createElement('details');
  details.className = 'event-details';

  const summary = document.createElement('summary');
  summary.textContent = `📅 Termin: ${formatEventLabel(task.event_datetime)}`;
  details.appendChild(summary);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn btn-ghost';
  addBtn.textContent = 'Zum Kalender hinzufuegen';
  addBtn.addEventListener('click', async () => {
    addBtn.disabled = true;
    addBtn.textContent = 'Wird hinzugefuegt...';
    try {
      await window.api.calendar.addEvent({ title: task.event_title || task.title, datetime: task.event_datetime });
      addBtn.textContent = '✓ Hinzugefuegt';
    } catch (err) {
      addBtn.disabled = false;
      addBtn.textContent = `Fehler: ${err.message || err}`;
    }
  });
  details.appendChild(addBtn);

  return details;
}

function matchesSearch(task) {
  if (!searchQuery) return true;
  const haystack = `${task.title} ${task.description || ''}`.toLowerCase();
  return haystack.includes(searchQuery);
}

function renderAll() {
  renderColumn(listToday, countToday, (t) => t.category === 'today' && t.status !== 'done' && matchesSearch(t), byPriorityDesc);
  renderColumn(listProcess, countProcess, (t) => t.category === 'process' && t.status !== 'done' && matchesSearch(t), byPriorityDesc);
  renderColumn(listPrivate, countPrivate, (t) => t.category === 'private' && t.status !== 'done' && matchesSearch(t), byPriorityDesc);
  renderColumn(listDone, countDone, (t) => t.status === 'done' && t.recurrence === 'none' && matchesSearch(t), byUpdatedAtDesc);
  renderColumn(listSeries, countSeries, (t) => t.status === 'done' && t.recurrence !== 'none' && matchesSearch(t), byUpdatedAtDesc);
}

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  renderAll();
});

// Keine Server-/Cron-Komponente in dieser App - wiederkehrende Aufgaben
// werden stattdessen beim Laden client-seitig geprueft und bei Bedarf
// wieder geoeffnet (Checkliste zurueckgesetzt).
// Jeweils einen Tag frueher wieder geoeffnet, damit noch Zeit bleibt, die
// Aufgabe vor dem eigentlichen Turnus zu erledigen.
const RECURRENCE_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 6 * 24 * 60 * 60 * 1000,
  monthly: 29 * 24 * 60 * 60 * 1000,
};

// Naechster Monatstermin ab einem gegebenen Datum: derselbe Monat, falls
// der Tag noch nicht erreicht ist, sonst der Folgemonat.
function nextMonthlyDueDate(from, day) {
  let due = new Date(from.getFullYear(), from.getMonth(), day);
  if (due.getTime() <= from.getTime()) {
    due = new Date(from.getFullYear(), from.getMonth() + 1, day);
  }
  return due;
}

function isRecurrenceDue(task, now) {
  if (task.status !== 'done') return false;
  const lastDone = new Date(task.updated_at || task.created_at);
  if (task.recurrence === 'monthly' && task.recurrence_day) {
    const due = nextMonthlyDueDate(lastDone, task.recurrence_day);
    return now >= due.getTime() - 24 * 60 * 60 * 1000;
  }
  if (!RECURRENCE_MS[task.recurrence]) return false;
  return now - lastDone.getTime() >= RECURRENCE_MS[task.recurrence];
}

async function reopenDueRecurringTasks(list) {
  const now = Date.now();
  const due = list.filter((t) => isRecurrenceDue(t, now));
  if (!due.length) return list;

  const reopened = await Promise.all(
    due.map((t) => {
      const resetSteps = Array.isArray(t.steps) ? t.steps.map((s) => ({ ...s, done: false })) : t.steps;
      return window.api.tasks.update(t.id, { status: 'open', steps: resetSteps }).catch(() => null);
    })
  );

  const byId = new Map(reopened.filter(Boolean).map((t) => [t.id, t]));
  return list.map((t) => byId.get(t.id) || t);
}

async function loadTasks() {
  hint.textContent = 'Lade Aufgaben...';
  try {
    const fetched = await window.api.tasks.list();
    tasks = await reopenDueRecurringTasks(fetched);
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
    priority: 2,
    recurrence: 'none',
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

const seriesDrawer = document.getElementById('seriesDrawer');
const seriesBackdrop = document.getElementById('seriesBackdrop');

function openSeriesDrawer() {
  seriesDrawer.classList.add('open');
  seriesBackdrop.classList.add('open');
}

function closeSeriesDrawer() {
  seriesDrawer.classList.remove('open');
  seriesBackdrop.classList.remove('open');
}

document.getElementById('seriesToggleBtn').addEventListener('click', openSeriesDrawer);
document.getElementById('seriesCloseBtn').addEventListener('click', closeSeriesDrawer);
seriesBackdrop.addEventListener('click', closeSeriesDrawer);
document.getElementById('refreshBtn').addEventListener('click', () => loadTasks());
document.getElementById('settingsBtn').addEventListener('click', () => {
  window.api.openSettingsWindow();
});

window.api.tasks.onChanged(() => loadTasks());
window.addEventListener('focus', () => loadTasks());

loadTasks();

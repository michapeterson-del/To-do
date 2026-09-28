const analyzingView = document.getElementById('analyzingView');
const errorView = document.getElementById('errorView');
const errorText = document.getElementById('errorText');
const resultView = document.getElementById('resultView');
const titleInput = document.getElementById('titleInput');
const descriptionInput = document.getElementById('descriptionInput');
const categoryToggle = document.getElementById('categoryToggle');
const duplicateNotice = document.getElementById('duplicateNotice');
const updateFields = document.getElementById('updateFields');
const createFields = document.getElementById('createFields');
const matchedTitleDuplicate = document.getElementById('matchedTitleDuplicate');
const matchedTitleUpdate = document.getElementById('matchedTitleUpdate');
const updateNoteInput = document.getElementById('updateNoteInput');
const saveAsNewBtn = document.getElementById('saveAsNewBtn');
const resultActions = document.getElementById('resultActions');
const submitBtn = document.getElementById('submitBtn');
const saveErrorText = document.getElementById('saveErrorText');
const eventNotice = document.getElementById('eventNotice');
const eventLabel = document.getElementById('eventLabel');
const addEventBtn = document.getElementById('addEventBtn');

let currentCategory = 'today';
let mode = 'create'; // 'create' | 'update' | 'duplicate'
let lastDraft = null;

function showView(view) {
  analyzingView.hidden = view !== 'analyzing';
  errorView.hidden = view !== 'error';
  resultView.hidden = view !== 'result';
}

function setCategory(category) {
  currentCategory = category === 'process' || category === 'private' ? category : 'today';
  categoryToggle.querySelectorAll('.cat-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.category === currentCategory);
  });
}

function setMode(nextMode) {
  mode = nextMode;
  duplicateNotice.hidden = mode !== 'duplicate';
  updateFields.hidden = mode !== 'update';
  createFields.hidden = mode !== 'create';
  resultActions.hidden = mode === 'duplicate';
}

categoryToggle.querySelectorAll('.cat-btn').forEach((btn) => {
  btn.addEventListener('click', () => setCategory(btn.dataset.category));
});

function formatEventLabel(datetime) {
  const date = new Date(datetime);
  if (Number.isNaN(date.getTime())) return datetime;
  return date.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

addEventBtn.addEventListener('click', async () => {
  if (!lastDraft?.event_datetime) return;
  addEventBtn.disabled = true;
  try {
    await window.api.calendar.addEvent({
      title: lastDraft.event_title || titleInput.value.trim() || 'Termin',
      datetime: lastDraft.event_datetime,
    });
  } catch (err) {
    saveErrorText.textContent = `Termin konnte nicht erstellt werden: ${err.message || err}`;
    saveErrorText.hidden = false;
  } finally {
    addEventBtn.disabled = false;
  }
});

showView('analyzing');

window.api.capture.onAnalyzing(() => {
  showView('analyzing');
});

window.api.capture.onResult((draft) => {
  lastDraft = draft;
  if (draft.action === 'duplicate') {
    setMode('duplicate');
    matchedTitleDuplicate.textContent = draft.matched_task_title || '';
  } else if (draft.action === 'update') {
    setMode('update');
    matchedTitleUpdate.textContent = draft.matched_task_title || '';
    updateNoteInput.value = draft.update_note || '';
  } else {
    setMode('create');
    titleInput.value = draft.title || '';
    descriptionInput.value = draft.description || '';
    setCategory(draft.category);
  }
  if (draft.event_datetime) {
    eventNotice.hidden = false;
    eventLabel.textContent = formatEventLabel(draft.event_datetime);
  } else {
    eventNotice.hidden = true;
  }
  showView('result');
  if (mode === 'create') {
    titleInput.focus();
    titleInput.select();
  } else if (mode === 'update') {
    updateNoteInput.focus();
  }
});

window.api.capture.onError((message) => {
  errorText.textContent = message;
  showView('error');
});

saveAsNewBtn.addEventListener('click', () => {
  setMode('create');
  titleInput.value = lastDraft?.matched_task_title || '';
  descriptionInput.value = '';
  setCategory('today');
  titleInput.focus();
  titleInput.select();
});

resultView.addEventListener('submit', async (e) => {
  e.preventDefault();

  let payload;
  if (mode === 'update') {
    const updateNote = updateNoteInput.value.trim();
    if (!updateNote) return;
    payload = {
      action: 'update',
      matched_task_id: lastDraft.matched_task_id,
      matched_task_steps: lastDraft.matched_task_steps,
      update_note: updateNote,
    };
  } else {
    const title = titleInput.value.trim();
    if (!title) return;
    payload = {
      action: 'create',
      title,
      description: descriptionInput.value.trim(),
      category: currentCategory,
    };
  }

  submitBtn.disabled = true;
  saveErrorText.hidden = true;
  try {
    await window.api.capture.submit(payload);
  } catch (err) {
    saveErrorText.textContent = `Speichern fehlgeschlagen: ${err.message || err}`;
    saveErrorText.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById('discardBtn').addEventListener('click', () => {
  window.api.capture.discard();
});
document.getElementById('closeBtn').addEventListener('click', () => {
  window.api.capture.discard();
});
document.getElementById('retryBtn').addEventListener('click', () => {
  window.api.capture.triggerNow();
});
document.getElementById('cancelErrorBtn').addEventListener('click', () => {
  window.api.capture.discard();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.api.capture.discard();
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !resultView.hidden && mode !== 'duplicate') {
    e.preventDefault();
    resultView.requestSubmit();
  }
});

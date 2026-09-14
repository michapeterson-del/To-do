const analyzingView = document.getElementById('analyzingView');
const errorView = document.getElementById('errorView');
const errorText = document.getElementById('errorText');
const resultView = document.getElementById('resultView');
const titleInput = document.getElementById('titleInput');
const descriptionInput = document.getElementById('descriptionInput');
const categoryToggle = document.getElementById('categoryToggle');

let currentCategory = 'today';

function showView(view) {
  analyzingView.hidden = view !== 'analyzing';
  errorView.hidden = view !== 'error';
  resultView.hidden = view !== 'result';
}

function setCategory(category) {
  currentCategory = category === 'process' ? 'process' : 'today';
  categoryToggle.querySelectorAll('.cat-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.category === currentCategory);
  });
}

categoryToggle.querySelectorAll('.cat-btn').forEach((btn) => {
  btn.addEventListener('click', () => setCategory(btn.dataset.category));
});

window.api.capture.onAnalyzing(() => {
  showView('analyzing');
});

window.api.capture.onResult((draft) => {
  titleInput.value = draft.title || '';
  descriptionInput.value = draft.description || '';
  setCategory(draft.category);
  showView('result');
  titleInput.focus();
  titleInput.select();
});

window.api.capture.onError((message) => {
  errorText.textContent = message;
  showView('error');
});

resultView.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;
  window.api.capture.submit({
    title,
    description: descriptionInput.value.trim(),
    category: currentCategory,
  });
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
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !resultView.hidden) {
    e.preventDefault();
    resultView.requestSubmit();
  }
});

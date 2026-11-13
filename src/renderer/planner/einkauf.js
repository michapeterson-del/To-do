// Einkaufs-Dashboard: zeigt den neuesten Bericht des KI-Agenten
// "Einkaufs-Analyst" (Tabelle public.einkauf_reports) an.
//
// Diese Datei ist bewusst unabhaengig von Electron: dieselbe Funktion steckt
// 1:1 auch in mobile/index.html. Aenderungen bitte an beiden Stellen machen.
//
// Alle Inhalte vom Agenten werden per textContent gesetzt (nie innerHTML).

function createEinkaufDashboard({ root, loadReport, getTasks, createTask }) {
  const PROBLEMS = {
    overdue: { label: 'Überfällig', icon: '⏰' },
    unconfirmed: { label: 'Nicht bestätigt', icon: '❔' },
    date_mismatch: { label: 'Termin ≠ Wunsch', icon: '📅' },
    partial: { label: 'Teillieferung', icon: '📦' },
    price: { label: 'Preis', icon: '💶' },
  };
  const CHANGES = { new: 'NEU', worse: 'schlimmer', better: 'besser' };
  const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat('de-DE');

  let report = null;
  let filter = 'all';
  let error = '';
  let loading = false;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function items() {
    return Array.isArray(report && report.items) ? report.items.filter((i) => i && typeof i === 'object') : [];
  }

  function sortItems(list) {
    return list.slice().sort((a, b) => {
      const sev = (Number(b.severity) || 0) - (Number(a.severity) || 0);
      if (sev) return sev;
      const days = (Number(b.days_overdue) || 0) - (Number(a.days_overdue) || 0);
      if (days) return days;
      return (Number(b.open_value_eur) || 0) - (Number(a.open_value_eur) || 0);
    });
  }

  function taskTitleFor(item) {
    const problem = PROBLEMS[item.problem] ? PROBLEMS[item.problem].label : item.problem || 'Problem';
    const days = Number(item.days_overdue) > 0 ? ` (${item.days_overdue} Tage)` : '';
    return `${item.order || '?'} – ${item.supplier || 'Lieferant'}: ${problem}${days}`.slice(0, 200);
  }

  function existingTaskFor(item) {
    if (!item.order) return null;
    const order = String(item.order).toLowerCase();
    return (getTasks() || []).find((t) => t.status !== 'done' && String(t.title || '').toLowerCase().includes(order)) || null;
  }

  function kpi(label, value, tone) {
    const tile = el('div', 'ek-kpi' + (tone ? ` ek-tone-${tone}` : ''));
    tile.appendChild(el('div', 'ek-kpi-value', value));
    tile.appendChild(el('div', 'ek-kpi-label', label));
    return tile;
  }

  function renderItem(item) {
    const card = el('li', `ek-item ek-sev-${Math.min(3, Math.max(1, Number(item.severity) || 1))}`);

    const head = el('div', 'ek-item-head');
    head.appendChild(el('span', 'ek-order', item.order || '—'));
    head.appendChild(el('span', 'ek-supplier', item.supplier || ''));
    if (CHANGES[item.change]) head.appendChild(el('span', `ek-change ek-change-${item.change}`, CHANGES[item.change]));
    card.appendChild(head);

    if (item.article) card.appendChild(el('div', 'ek-article', item.article));

    const meta = el('div', 'ek-meta');
    const p = PROBLEMS[item.problem];
    meta.appendChild(el('span', 'ek-problem', p ? `${p.icon} ${p.label}` : item.problem || 'Problem'));
    if (Number(item.days_overdue) > 0) meta.appendChild(el('span', 'ek-days', `${item.days_overdue} Tage`));
    if (item.due_date) meta.appendChild(el('span', 'ek-muted', `Termin ${formatDate(item.due_date)}`));
    if (Number(item.open_value_eur) > 0) meta.appendChild(el('span', 'ek-muted', `offen ${eur.format(Number(item.open_value_eur))}`));
    card.appendChild(meta);

    if (item.note) card.appendChild(el('div', 'ek-note', item.note));

    const existing = existingTaskFor(item);
    const btn = el('button', 'btn ek-task-btn', existing ? '✓ Aufgabe vorhanden' : '+ Aufgabe');
    btn.type = 'button';
    btn.disabled = Boolean(existing);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Wird angelegt...';
      try {
        const lines = [
          item.article ? `Artikel: ${item.article}` : '',
          item.due_date ? `Termin: ${formatDate(item.due_date)}` : '',
          Number(item.open_value_eur) > 0 ? `Offener Wert: ${eur.format(Number(item.open_value_eur))}` : '',
          item.note || '',
          '(aus dem Einkaufs-Dashboard)',
        ].filter(Boolean);
        await createTask({
          title: taskTitleFor(item),
          description: lines.join('\n'),
          category: 'today',
          priority: Math.min(3, Math.max(1, Number(item.severity) || 2)),
        });
        btn.textContent = '✓ Aufgabe vorhanden';
      } catch (err) {
        btn.disabled = false;
        btn.textContent = `Fehler: ${err.message || err}`;
      }
    });
    card.appendChild(btn);
    return card;
  }

  function render() {
    root.innerHTML = '';

    const head = el('div', 'ek-head');
    head.appendChild(el('h2', 'ek-title', '📦 Einkauf – offene Bestellungen'));
    const refresh = el('button', 'btn btn-ghost', loading ? '…' : '⟳');
    refresh.type = 'button';
    refresh.title = 'Neu laden';
    refresh.addEventListener('click', () => load());
    head.appendChild(refresh);
    root.appendChild(head);

    if (error) {
      root.appendChild(el('p', 'ek-error', error));
      return;
    }
    if (!report) {
      root.appendChild(
        el('p', 'ek-empty', loading ? 'Lade Bericht...' : 'Noch kein Bericht vom Einkaufs-Agenten da. Er schreibt werktags gegen 7:05 einen neuen.')
      );
      return;
    }

    const created = new Date(report.created_at);
    const ageHours = (Date.now() - created.getTime()) / 36e5;
    const stand = el('p', 'ek-stand' + (ageHours > 30 ? ' ek-stale' : ''));
    stand.textContent =
      `Stand: ${formatDateTime(report.created_at)}` +
      (report.data_as_of ? ` · xentral-Daten von ${formatDateTime(report.data_as_of)}` : '') +
      (ageHours > 30 ? ' · ⚠ älter als ein Tag – ist der Agent gelaufen?' : '');
    root.appendChild(stand);

    const s = report.summary && typeof report.summary === 'object' ? report.summary : {};
    const kpis = el('div', 'ek-kpis');
    const n = (v) => (Number.isFinite(Number(v)) ? num.format(Number(v)) : '–');
    kpis.appendChild(kpi('Überfällige Positionen', n(s.overdue_positions), Number(s.overdue_positions) > 0 ? 'bad' : ''));
    kpis.appendChild(kpi('Betroffene Bestellungen', n(s.overdue_orders), ''));
    kpis.appendChild(kpi('Überfälliger Wert', Number.isFinite(Number(s.overdue_value_eur)) ? eur.format(Number(s.overdue_value_eur)) : '–', ''));
    kpis.appendChild(kpi('Nicht bestätigt', n(s.unconfirmed_orders), Number(s.unconfirmed_orders) > 0 ? 'warn' : ''));
    root.appendChild(kpis);

    const highlights = Array.isArray(report.highlights) ? report.highlights.filter((h) => typeof h === 'string' && h.trim()) : [];
    if (highlights.length) {
      const box = el('ul', 'ek-highlights');
      for (const h of highlights.slice(0, 6)) box.appendChild(el('li', '', h));
      root.appendChild(box);
    }

    const all = items();
    const chips = el('div', 'ek-chips');
    const chipDefs = [['all', 'Alle', all.length]].concat(
      Object.keys(PROBLEMS)
        .map((key) => [key, `${PROBLEMS[key].icon} ${PROBLEMS[key].label}`, all.filter((i) => i.problem === key).length])
        .filter(([, , count]) => count > 0)
    );
    for (const [key, label, count] of chipDefs) {
      const chip = el('button', 'ek-chip' + (filter === key ? ' active' : ''), `${label} ${count}`);
      chip.type = 'button';
      chip.addEventListener('click', () => {
        filter = key;
        render();
      });
      chips.appendChild(chip);
    }
    root.appendChild(chips);

    const visible = sortItems(filter === 'all' ? all : all.filter((i) => i.problem === filter));
    const list = el('ul', 'ek-list');
    if (!visible.length) list.appendChild(el('li', 'ek-empty', 'Keine Auffälligkeiten – alles im grünen Bereich. 🎉'));
    for (const item of visible) list.appendChild(renderItem(item));
    root.appendChild(list);
  }

  async function load() {
    loading = true;
    error = '';
    render();
    try {
      report = await loadReport();
    } catch (err) {
      error = `Fehler beim Laden: ${err.message || err}`;
    }
    loading = false;
    render();
  }

  return { load, render };
}

if (typeof module !== 'undefined') module.exports = { createEinkaufDashboard };

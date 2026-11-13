// Einkaufs-Dashboard: zeigt den neuesten Bericht des KI-Agenten
// "Einkaufs-Analyst" (Tabelle public.einkauf_reports) an.
//
// Diese Datei ist bewusst unabhaengig von Electron: dieselbe Funktion steckt
// 1:1 auch in mobile/index.html. Aenderungen bitte an beiden Stellen machen.
//
// Alle Inhalte vom Agenten werden per textContent gesetzt (nie innerHTML).

function createEinkaufDashboard({ root, loadReport, loadSuggestions, updateSuggestion, getTasks, createTask }) {
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

  const KINDS = {
    promotion: { label: 'Promotion → Vertrieb', icon: '📣' },
    price_change: { label: 'Preisänderung', icon: '💶' },
    delivery_date: { label: 'Liefertermin', icon: '🚚' },
    other: { label: 'Sonstiges', icon: '✉️' },
  };

  let report = null;
  let filter = 'all';
  let error = '';
  let loading = false;
  let tab = 'orders';
  let suggestions = [];
  let mailError = '';
  let mailFilter = 'all';

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

  function kindOf(m) {
    return KINDS[m.kind] ? m.kind : 'other';
  }

  function openSuggestions() {
    return suggestions.filter((m) => m && m.status === 'open');
  }

  function render() {
    root.innerHTML = '';

    const head = el('div', 'ek-head');
    head.appendChild(el('h2', 'ek-title', '📦 Einkauf'));
    const refresh = el('button', 'btn btn-ghost', loading ? '…' : '⟳');
    refresh.type = 'button';
    refresh.title = 'Neu laden';
    refresh.addEventListener('click', () => load());
    head.appendChild(refresh);
    root.appendChild(head);

    const tabs = el('div', 'ek-tabs');
    const openCount = openSuggestions().length;
    for (const [key, label] of [
      ['orders', 'Offene Bestellungen'],
      ['mail', `📬 Postfach${openCount ? ` (${openCount})` : ''}`],
    ]) {
      const t = el('button', 'ek-tab' + (tab === key ? ' active' : ''), label);
      t.type = 'button';
      t.addEventListener('click', () => {
        tab = key;
        render();
      });
      tabs.appendChild(t);
    }
    root.appendChild(tabs);

    if (tab === 'mail') renderMail();
    else renderOrders();
  }

  function renderSuggestion(m) {
    const kind = KINDS[kindOf(m)];
    const card = el('li', `ek-item ek-mail ek-kind-${kindOf(m)}` + (m.status !== 'open' ? ' ek-closed' : ''));

    const head = el('div', 'ek-item-head');
    head.appendChild(el('span', 'ek-problem', `${kind.icon} ${kind.label}`));
    if (m.received_at) head.appendChild(el('span', 'ek-when', formatDateTime(m.received_at)));
    card.appendChild(head);

    const who = [m.supplier, m.sender && m.sender !== m.supplier ? m.sender : ''].filter(Boolean).join(' · ');
    if (who) card.appendChild(el('div', 'ek-supplier', who));
    if (m.subject) card.appendChild(el('div', 'ek-order', m.subject));
    if (m.summary) card.appendChild(el('div', 'ek-article', m.summary));

    const d = m.details && typeof m.details === 'object' ? m.details : {};
    const money = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? '?' : eur.format(Number(v)));
    const day = (v) => (v ? formatDate(v) : '?');
    const facts = el('div', 'ek-meta');
    if (m.order_no) facts.appendChild(el('span', '', `Bestellung ${m.order_no}`));
    if (m.article) facts.appendChild(el('span', 'ek-muted', m.article));
    if (d.old_price != null || d.new_price != null) facts.appendChild(el('span', 'ek-days', `${money(d.old_price)} → ${money(d.new_price)}`));
    if (d.old_date || d.new_date) facts.appendChild(el('span', 'ek-days', `${day(d.old_date)} → ${day(d.new_date)}`));
    if (d.valid_from || d.valid_until) facts.appendChild(el('span', 'ek-muted', `gültig ${day(d.valid_from)} – ${day(d.valid_until)}`));
    if (facts.childNodes.length) card.appendChild(facts);

    if (m.suggestion) {
      const sug = el('div', 'ek-suggestion');
      sug.appendChild(el('strong', '', 'Vorschlag: '));
      sug.appendChild(document.createTextNode(m.suggestion));
      card.appendChild(sug);
    }

    if (m.status !== 'open') {
      card.appendChild(el('div', 'ek-muted', m.status === 'done' ? '✓ erledigt' : 'ignoriert'));
      return card;
    }

    const actions = el('div', 'ek-actions');
    const buttons = [];
    const setStatus = async (status) => {
      await updateSuggestion(m.id, { status });
      m.status = status;
      render();
    };
    const wire = (label, extraClass, fn) => {
      const b = el('button', 'btn ek-task-btn' + (extraClass ? ` ${extraClass}` : ''), label);
      b.type = 'button';
      b.addEventListener('click', async () => {
        buttons.forEach((x) => (x.disabled = true));
        try {
          await fn();
        } catch (err) {
          buttons.forEach((x) => (x.disabled = false));
          b.textContent = `Fehler: ${err.message || err}`;
        }
      });
      buttons.push(b);
      actions.appendChild(b);
    };
    wire('+ Aufgabe', '', async () => {
      const lines = [
        m.summary || '',
        m.suggestion ? `Vorschlag: ${m.suggestion}` : '',
        m.subject ? `Mail: ${m.subject}${m.sender ? ` (${m.sender})` : ''}` : '',
        '(aus dem Postfach-Agenten)',
      ].filter(Boolean);
      const title = `${kind.icon} ${m.supplier ? m.supplier + ': ' : ''}${m.suggestion || m.subject || kind.label}`.slice(0, 200);
      await createTask({
        title,
        description: lines.join('\n'),
        category: 'today',
        priority: m.kind === 'delivery_date' || m.kind === 'price_change' ? 3 : 2,
      });
      await setStatus('done');
    });
    wire('✓ Erledigt', '', () => setStatus('done'));
    wire('Ignorieren', 'ek-quiet', () => setStatus('dismissed'));
    card.appendChild(actions);
    return card;
  }

  function renderMail() {
    if (mailError) {
      root.appendChild(el('p', 'ek-empty', mailError));
      return;
    }
    const open = openSuggestions();
    const chips = el('div', 'ek-chips');
    const defs = [['all', 'Alle offen', open.length]]
      .concat(
        Object.keys(KINDS)
          .map((k) => [k, `${KINDS[k].icon} ${KINDS[k].label}`, open.filter((m) => kindOf(m) === k).length])
          .filter(([, , c]) => c > 0)
      )
      .concat([['closed', 'Erledigt', suggestions.length - open.length]]);
    for (const [key, label, count] of defs) {
      const chip = el('button', 'ek-chip' + (mailFilter === key ? ' active' : ''), `${label} ${count}`);
      chip.type = 'button';
      chip.addEventListener('click', () => {
        mailFilter = key;
        render();
      });
      chips.appendChild(chip);
    }
    root.appendChild(chips);

    let visible;
    if (mailFilter === 'closed') visible = suggestions.filter((m) => m && m.status !== 'open');
    else if (mailFilter === 'all') visible = open;
    else visible = open.filter((m) => kindOf(m) === mailFilter);

    const list = el('ul', 'ek-list');
    if (!visible.length) {
      const text = loading ? 'Lade Vorschläge...' : mailFilter === 'closed' ? 'Noch nichts erledigt.' : 'Keine offenen Vorschläge aus dem Postfach. 📭';
      list.appendChild(el('li', 'ek-empty', text));
    }
    for (const m of visible) list.appendChild(renderSuggestion(m));
    root.appendChild(list);
  }

  function renderOrders() {
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
    const [rep, mails] = await Promise.allSettled([loadReport(), loadSuggestions ? loadSuggestions() : Promise.resolve([])]);
    if (rep.status === 'fulfilled') report = rep.value;
    else error = `Fehler beim Laden: ${rep.reason && rep.reason.message ? rep.reason.message : rep.reason}`;
    mailError = '';
    if (mails.status === 'fulfilled') suggestions = Array.isArray(mails.value) ? mails.value : [];
    else {
      const msg = String(mails.reason && mails.reason.message ? mails.reason.message : mails.reason);
      mailError = /\b404\b|PGRST20[05]|postfach_vorschlaege/.test(msg)
        ? 'Der Postfach-Agent ist noch nicht eingerichtet (Tabelle postfach_vorschlaege fehlt).'
        : `Fehler beim Laden: ${msg}`;
    }
    loading = false;
    render();
  }

  return { load, render };
}

if (typeof module !== 'undefined') module.exports = { createEinkaufDashboard };

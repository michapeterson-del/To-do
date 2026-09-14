// Schlanker REST-Client fuer Supabase (PostgREST). Bewusst ohne
// @supabase/supabase-js, um auf eine zusaetzliche Abhaengigkeit zu
// verzichten - Electron bringt ein globales fetch() bereits mit.

function baseHeaders(config, prefer) {
  const headers = {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

function restUrl(config, pathAndQuery) {
  const base = config.supabaseUrl.replace(/\/$/, '');
  return `${base}/rest/v1/${pathAndQuery}`;
}

async function request(config, method, pathAndQuery, body, prefer) {
  const res = await fetch(restUrl(config, pathAndQuery), {
    method,
    headers: baseHeaders(config, prefer),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase ${method} ${pathAndQuery} fehlgeschlagen (${res.status}): ${text}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function listTasks(config) {
  return request(config, 'GET', 'tasks?select=*&order=created_at.asc');
}

async function createTask(config, task) {
  const payload = {
    title: task.title,
    description: task.description || '',
    category: task.category === 'process' ? 'process' : 'today',
    status: 'open',
    source: task.source === 'screenshot' ? 'screenshot' : 'manual',
  };
  const result = await request(config, 'POST', 'tasks', payload, 'return=representation');
  return Array.isArray(result) ? result[0] : result;
}

async function updateTask(config, id, patch) {
  const result = await request(config, 'PATCH', `tasks?id=eq.${encodeURIComponent(id)}`, patch, 'return=representation');
  return Array.isArray(result) ? result[0] : result;
}

async function deleteTask(config, id) {
  await request(config, 'DELETE', `tasks?id=eq.${encodeURIComponent(id)}`);
}

module.exports = { listTasks, createTask, updateTask, deleteTask };

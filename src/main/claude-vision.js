// Schickt einen Screenshot an die Claude API (Vision) und laesst daraus
// eine Aufgabe extrahieren. Nutzt die HTTP-API direkt statt des SDKs, um
// keine zusaetzliche Abhaengigkeit zu brauchen.

const PROMPT = `Du siehst einen Screenshot vom Bildschirm eines Nutzers bei der Arbeit.

Erkenne daraus EINE konkrete, umsetzbare Aufgabe, die der Nutzer wahrscheinlich
erledigen oder notieren moechte (z.B. eine E-Mail beantworten, ein Ticket
bearbeiten, einen Fehler beheben, einen Prozess optimieren).

Entscheide, ob es sich eher um Folgendes handelt:
- "today": eine konkrete Aufgabe fuer heute
- "process": eine uebergeordnete Aufgabe / ein Prozess, der optimiert oder
  verbessert werden soll

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in genau diesem Format, ohne
weiteren Text, ohne Markdown-Codeblock:
{"title": "kurzer Aufgabentitel", "description": "1-2 Saetze Kontext", "category": "today oder process"}`;

function parseTaskJson(raw) {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Die KI-Antwort konnte nicht als Aufgabe interpretiert werden.');
  }

  const title = String(parsed.title || '').slice(0, 200).trim();
  if (!title) {
    throw new Error('Auf dem Screenshot wurde keine erkennbare Aufgabe gefunden.');
  }
  const description = String(parsed.description || '').slice(0, 1000).trim();
  const category = parsed.category === 'process' ? 'process' : 'today';
  return { title, description, category };
}

async function analyzeScreenshot(config, pngBase64) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.claudeModel || 'claude-sonnet-5',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: pngBase64 } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Claude API Fehler (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json();
  const textBlock = Array.isArray(data.content) ? data.content.find((c) => c.type === 'text') : null;
  if (!textBlock) {
    throw new Error('Keine Textantwort von Claude erhalten.');
  }
  return parseTaskJson(textBlock.text);
}

module.exports = { analyzeScreenshot };

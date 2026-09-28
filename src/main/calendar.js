// Legt einen erkannten Termin direkt im Kalender an.
//
// Reihenfolge:
// 1. Windows: per PowerShell/COM direkt in die laufende Outlook-Installation
//    (kein Dialog, kein Import-Klick).
// 2. Mac: per AppleScript direkt in Kalender.app (kein Import-Dialog).
// 3. iCloud CalDAV, falls Apple-ID + App-spezifisches Passwort hinterlegt
//    sind (fuer den Fall, dass kein Outlook/Mac-Kalender genutzt wird).
// 4. Sonst/Fallback: .ics-Datei, die mit dem Standard-Kalenderprogramm
//    geoeffnet wird (ein Bestaetigungsklick noetig).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { shell } = require('electron');
const { execFile } = require('child_process');

function buildIcs({ title, datetime }) {
  const start = datetime.replace(/[-:]/g, '');
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@aufgabenplaner`;
  const escaped = String(title).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aufgabenplaner//DE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${start}`,
    `SUMMARY:${escaped}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
  return { uid, ics };
}

// --- iCloud CalDAV ---------------------------------------------------

async function caldavRequest(url, { method, depth, body, auth }) {
  const authHeader = 'Basic ' + Buffer.from(`${auth.email}:${auth.password}`).toString('base64');
  let currentUrl = url;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(currentUrl, {
      method,
      redirect: 'manual',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'text/xml; charset="utf-8"',
        Accept: '*/*',
        'User-Agent': 'Aufgabenplaner-CalDAV/1.0',
        ...(depth !== undefined ? { Depth: String(depth) } : {}),
      },
      body,
    });
    if ([301, 302, 307, 308].includes(res.status) && res.headers.get('location')) {
      currentUrl = new URL(res.headers.get('location'), currentUrl).toString();
      continue;
    }
    return { res, finalUrl: currentUrl };
  }
  throw new Error('Zu viele Weiterleitungen bei der iCloud-Anfrage.');
}

function extractHref(xmlBlock) {
  const match = /<[^<>]*:?href[^<>]*>([^<]+)<\/[^<>]*:?href>/i.exec(xmlBlock);
  return match ? match[1].trim() : null;
}

async function propfind(url, propBody, auth, depth) {
  const { res, finalUrl } = await caldavRequest(url, { method: 'PROPFIND', depth, auth, body: propBody });
  const text = await res.text();
  if (res.status !== 207) {
    const detail = text.replace(/\s+/g, ' ').trim().slice(0, 300);
    const wwwAuth = res.headers.get('www-authenticate') || '(keiner)';
    throw new Error(
      `iCloud-Anfrage fehlgeschlagen (${res.status} ${res.statusText}) bei ${url}. ` +
        `WWW-Authenticate: ${wwwAuth}. Antwort: ${detail || '(leer)'}`
    );
  }
  return { text, finalUrl };
}

async function discoverCalendarUrl(auth) {
  const principalBody =
    '<?xml version="1.0" encoding="utf-8" ?><D:propfind xmlns:D="DAV:">' +
    '<D:prop><D:current-user-principal/></D:prop></D:propfind>';
  const { text: principalXml, finalUrl: principalHost } = await propfind(
    'https://caldav.icloud.com/',
    principalBody,
    auth,
    0
  );
  const principalHref = extractHref(principalXml);
  if (!principalHref) throw new Error('Konnte iCloud-Konto nicht ermitteln.');
  const principalUrl = new URL(principalHref, principalHost).toString();

  const homeBody =
    '<?xml version="1.0" encoding="utf-8" ?>' +
    '<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">' +
    '<D:prop><C:calendar-home-set/></D:prop></D:propfind>';
  const { text: homeXml, finalUrl: homeHost } = await propfind(principalUrl, homeBody, auth, 0);
  const homeHref = extractHref(homeXml);
  if (!homeHref) throw new Error('Konnte iCloud-Kalender-Ordner nicht ermitteln.');
  const homeUrl = new URL(homeHref, homeHost).toString();

  const listBody =
    '<?xml version="1.0" encoding="utf-8" ?>' +
    '<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">' +
    '<D:prop><D:resourcetype/><D:displayname/></D:prop></D:propfind>';
  const { text: listXml, finalUrl: listHost } = await propfind(homeUrl, listBody, auth, 1);

  const responseBlocks = listXml.split(/<[^<>]*:?response>/i).filter((b) => /calendar/i.test(b) && /resourcetype/i.test(b));
  for (const block of responseBlocks) {
    if (/<[^<>]*:?collection\s*\/>/i.test(block) && /<[^<>]*:?calendar\s*\/>/i.test(block)) {
      const href = extractHref(block);
      if (href && new URL(href, listHost).toString() !== homeUrl) {
        return new URL(href, listHost).toString();
      }
    }
  }
  throw new Error('Keinen beschreibbaren iCloud-Kalender gefunden.');
}

async function addEventViaCalDav({ title, datetime }, auth) {
  const calendarUrl = await discoverCalendarUrl(auth);
  const { uid, ics } = buildIcs({ title, datetime });
  const eventUrl = new URL(`${uid}.ics`, calendarUrl).toString();

  const authHeader = 'Basic ' + Buffer.from(`${auth.email}:${auth.password}`).toString('base64');
  const res = await fetch(eventUrl, {
    method: 'PUT',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'text/calendar; charset=utf-8',
    },
    body: ics,
  });
  if (!res.ok) {
    throw new Error(`Termin konnte nicht bei iCloud gespeichert werden (${res.status}).`);
  }
}

// --- macOS: AppleScript -----------------------------------------------

function escapeAppleScriptText(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function runAppleScript(script) {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

async function addEventMac({ title, datetime }) {
  const [, y, mo, d, h, mi] = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}$/.exec(datetime) || [];
  if (!y) throw new Error('Ungueltiges Termin-Datum.');
  const safeTitle = escapeAppleScriptText(title);

  const script = `
    set theDate to (current date)
    set year of theDate to ${Number(y)}
    set month of theDate to ${Number(mo)}
    set day of theDate to ${Number(d)}
    set hours of theDate to ${Number(h)}
    set minutes of theDate to ${Number(mi)}
    set seconds of theDate to 0
    set endDate to theDate + (30 * minutes)
    tell application "Calendar"
      tell calendar 1
        make new event at end with properties {summary:"${safeTitle}", start date:theDate, end date:endDate}
      end tell
    end tell
  `;
  await runAppleScript(script);
}

// --- Windows: Outlook per COM/PowerShell ------------------------------

function escapePowerShellSingleQuoted(text) {
  return String(text).replace(/'/g, "''");
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
      }
    );
  });
}

async function addEventOutlook({ title, datetime }) {
  const [, y, mo, d, h, mi] = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}$/.exec(datetime) || [];
  if (!y) throw new Error('Ungueltiges Termin-Datum.');
  const safeTitle = escapePowerShellSingleQuoted(title);
  const startStr = `${y}-${mo}-${d} ${h}:${mi}:00`;

  const script = `
    $ol = New-Object -ComObject Outlook.Application
    $appt = $ol.CreateItem(1)
    $appt.Subject = '${safeTitle}'
    $appt.Start = [datetime]::Parse('${startStr}')
    $appt.Duration = 30
    $appt.ReminderSet = $true
    $appt.Save()
  `;
  await runPowerShell(script);
}

// --- Fallback: .ics-Datei oeffnen --------------------------------------

async function addEventViaIcsFile(payload) {
  const { ics } = buildIcs(payload);
  const filePath = path.join(os.tmpdir(), `termin-${Date.now()}.ics`);
  fs.writeFileSync(filePath, ics, 'utf8');
  await shell.openPath(filePath);
}

// --- Einstiegspunkt ------------------------------------------------------

async function addCalendarEvent(config, payload) {
  if (process.platform === 'win32') {
    try {
      await addEventOutlook(payload);
      return;
    } catch (err) {
      console.error('Outlook-Automatisierung fehlgeschlagen, weiche auf .ics-Datei aus:', err);
    }
  }
  if (process.platform === 'darwin') {
    await addEventMac(payload);
    return;
  }
  if (config.icloudEmail && config.icloudAppPassword) {
    try {
      await addEventViaCalDav(payload, { email: config.icloudEmail, password: config.icloudAppPassword });
      return;
    } catch (err) {
      console.error('iCloud CalDAV fehlgeschlagen, weiche auf .ics-Datei aus:', err);
    }
  }
  await addEventViaIcsFile(payload);
}

module.exports = { addCalendarEvent };

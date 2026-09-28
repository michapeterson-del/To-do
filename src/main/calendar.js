// Legt einen erkannten Termin direkt im Kalender an.
//
// Auf dem Mac per AppleScript direkt in Kalender.app (kein Import-Dialog,
// kein Klicken in einer fremden App noetig - macOS fragt nur beim allerersten
// Mal einmalig nach der Automatisierungs-Berechtigung). Auf anderen Systemen
// als Fallback ueber eine .ics-Datei, die mit dem Standard-Kalenderprogramm
// geoeffnet wird.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { shell } = require('electron');
const { execFile } = require('child_process');

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

function toIcsDate(datetime) {
  return datetime.replace(/[-:]/g, '');
}

function escapeIcsText(text) {
  return String(text).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

async function addEventViaIcs({ title, datetime }) {
  const start = toIcsDate(datetime);
  const uid = `${Date.now()}@aufgabenplaner`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aufgabenplaner//DE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${start}`,
    `SUMMARY:${escapeIcsText(title)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');

  const filePath = path.join(os.tmpdir(), `termin-${Date.now()}.ics`);
  fs.writeFileSync(filePath, ics, 'utf8');
  await shell.openPath(filePath);
}

async function addCalendarEvent(payload) {
  if (process.platform === 'darwin') {
    await addEventMac(payload);
  } else {
    await addEventViaIcs(payload);
  }
}

module.exports = { addCalendarEvent };

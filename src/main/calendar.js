// Legt einen erkannten Termin direkt im Kalender an.
//
// Reihenfolge:
// 1. Windows: per PowerShell/COM direkt in die laufende Outlook-Installation
//    (kein Dialog, kein Import-Klick).
// 2. Mac: per AppleScript direkt in Kalender.app (kein Import-Dialog).
// 3. Sonst/Fallback: .ics-Datei, die mit dem Standard-Kalenderprogramm
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
  await addEventViaIcsFile(payload);
}

module.exports = { addCalendarEvent };

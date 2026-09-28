// Erstellt eine .ics-Datei fuer einen erkannten Termin und oeffnet sie mit
// dem Standard-Kalenderprogramm des Systems (z.B. Apple Kalender), das dann
// den Import-Dialog zeigt. Kein Login/API-Zugang noetig.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { shell } = require('electron');

function toIcsDate(datetime) {
  // "2026-09-30T14:00:00" -> "20260930T140000"
  return datetime.replace(/[-:]/g, '');
}

function escapeIcsText(text) {
  return String(text).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

async function addCalendarEvent({ title, datetime }) {
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

module.exports = { addCalendarEvent };

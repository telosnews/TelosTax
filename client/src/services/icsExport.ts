/**
 * Generate an .ics (iCalendar) file from tax deadlines and trigger download.
 *
 * The file is compatible with Apple Calendar, Google Calendar, Outlook, etc.
 */

import type { TaxDeadline } from './taxCalendarService';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a Date as an iCalendar all-day date: YYYYMMDD */
function icsDate(iso: string): string {
  return iso.replace(/-/g, '');
}

/** Format current UTC timestamp for DTSTAMP: YYYYMMDDTHHmmssZ */
function icsNow(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Escape text per RFC 5545 */
function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function buildVEvent(deadline: TaxDeadline, stamp: string): string {
  const dateStr = icsDate(deadline.date);
  // All-day event: DTSTART is the day, DTEND is the next day
  const [y, m, d] = deadline.date.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  const endStr = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;

  const summary = deadline.amount
    ? `${deadline.label} — $${deadline.amount.toLocaleString()}`
    : deadline.label;

  const lines = [
    'BEGIN:VEVENT',
    `UID:telostax-${deadline.id}@telostax.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${endStr}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(deadline.notes)}`,
    // Set a reminder 7 days before
    'BEGIN:VALARM',
    'TRIGGER:-P7D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(deadline.label)} is in 7 days`,
    'END:VALARM',
    // Set a reminder 1 day before
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(deadline.label)} is tomorrow`,
    'END:VALARM',
    'END:VEVENT',
  ];

  return lines.join('\r\n');
}

export function generateICS(deadlines: TaxDeadline[]): string {
  const stamp = icsNow();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TelosTax//Tax Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:TelosTax Deadlines',
    'X-WR-TIMEZONE:America/New_York',
    ...deadlines.map(d => buildVEvent(d, stamp)),
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

export function downloadICS(deadlines: TaxDeadline[]): void {
  const ics = generateICS(deadlines);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'telostax-deadlines.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

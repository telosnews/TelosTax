/**
 * Add AcroForm fields to NM PIT-1 flat PDF.
 *
 * The NM PIT-1 is a 2-page print-only form with no interactive fields.
 * This script overlays AcroForm text fields at the correct positions.
 *
 * Usage: npx tsx scripts/add-nm-fields.ts
 */
import { PDFDocument } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const INPUT = resolve(__dirname, '../client/public/state-forms/nm-pit1.pdf');
const OUTPUT = INPUT;

interface FieldDef {
  name: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Page dimensions: 612 x 792 (standard letter)
// Coordinates from bottom-left corner

const fields: FieldDef[] = [
  // ── Page 1: Taxpayer Information ────────────────────────────
  { name: 'Taxpayer Name 1a', page: 0, x: 36, y: 666, width: 270, height: 14 },
  { name: 'SSN 1b', page: 0, x: 340, y: 666, width: 120, height: 14 },
  { name: 'Spouse Name 2a', page: 0, x: 36, y: 636, width: 270, height: 14 },
  { name: 'SSN 2b', page: 0, x: 340, y: 636, width: 120, height: 14 },
  { name: 'Mailing Address 3b', page: 0, x: 36, y: 596, width: 275, height: 14 },
  { name: 'City', page: 0, x: 36, y: 573, width: 180, height: 14 },
  { name: 'State', page: 0, x: 228, y: 573, width: 40, height: 14 },
  { name: 'ZIP', page: 0, x: 280, y: 573, width: 80, height: 14 },

  // ── Page 1: Exemptions ─────────────────────────────────────
  { name: 'Exemptions 5', page: 0, x: 36, y: 508, width: 40, height: 14 },

  // ── Page 1: Income Lines 9-22 ──────────────────────────────
  { name: 'Line 9', page: 0, x: 478, y: 292, width: 100, height: 14 },
  { name: 'Line 10', page: 0, x: 478, y: 270, width: 100, height: 14 },
  { name: 'Line 11', page: 0, x: 478, y: 248, width: 100, height: 14 },
  { name: 'Line 12', page: 0, x: 478, y: 226, width: 100, height: 14 },
  { name: 'Line 13', page: 0, x: 478, y: 198, width: 100, height: 14 },
  { name: 'Line 14', page: 0, x: 478, y: 178, width: 100, height: 14 },
  { name: 'Line 15', page: 0, x: 478, y: 158, width: 100, height: 14 },
  { name: 'Line 17', page: 0, x: 478, y: 118, width: 100, height: 14 },
  { name: 'Line 18', page: 0, x: 478, y: 93, width: 100, height: 14 },
  { name: 'Line 19', page: 0, x: 478, y: 65, width: 100, height: 14 },
  { name: 'Line 20', page: 0, x: 478, y: 43, width: 100, height: 14 },
  { name: 'Line 21', page: 0, x: 478, y: 23, width: 100, height: 14 },
  { name: 'Line 22', page: 0, x: 478, y: 3, width: 100, height: 14 },

  // ── Page 2: Header ─────────────────────────────────────────
  { name: 'Page 2 SSN', page: 1, x: 36, y: 720, width: 140, height: 14 },

  // ── Page 2: Credits & Payments (Lines 23-42) ────────────────
  { name: 'Line 23', page: 1, x: 478, y: 668, width: 100, height: 14 },
  { name: 'Line 24', page: 1, x: 478, y: 648, width: 100, height: 14 },
  { name: 'Line 25', page: 1, x: 478, y: 624, width: 100, height: 14 },
  { name: 'Line 26', page: 1, x: 478, y: 582, width: 100, height: 14 },
  { name: 'Line 27', page: 1, x: 478, y: 560, width: 100, height: 14 },
  { name: 'Line 28', page: 1, x: 478, y: 538, width: 100, height: 14 },
  { name: 'Line 29', page: 1, x: 478, y: 514, width: 100, height: 14 },
  { name: 'Line 30', page: 1, x: 478, y: 492, width: 100, height: 14 },
  { name: 'Line 31', page: 1, x: 478, y: 472, width: 100, height: 14 },
  { name: 'Line 32', page: 1, x: 478, y: 452, width: 100, height: 14 },
  { name: 'Line 33', page: 1, x: 478, y: 430, width: 100, height: 14 },
  { name: 'Line 34', page: 1, x: 478, y: 408, width: 100, height: 14 },
  { name: 'Line 36', page: 1, x: 478, y: 378, width: 100, height: 14 },
  { name: 'Line 37', page: 1, x: 478, y: 358, width: 100, height: 14 },
  { name: 'Line 38', page: 1, x: 478, y: 336, width: 100, height: 14 },
  { name: 'Line 39', page: 1, x: 478, y: 314, width: 100, height: 14 },
  { name: 'Line 40', page: 1, x: 478, y: 292, width: 100, height: 14 },
  { name: 'Line 41', page: 1, x: 478, y: 272, width: 100, height: 14 },
  { name: 'Line 42', page: 1, x: 478, y: 252, width: 100, height: 14 },
];

async function main() {
  const bytes = readFileSync(INPUT);
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  const pages = doc.getPages();

  for (const f of fields) {
    const tf = form.createTextField(f.name);
    tf.addToPage(pages[f.page], {
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      borderWidth: 0,
    });
  }

  const outBytes = await doc.save();
  writeFileSync(OUTPUT, outBytes);
  console.log(`Added ${fields.length} AcroForm fields to ${OUTPUT}`);
}

main();

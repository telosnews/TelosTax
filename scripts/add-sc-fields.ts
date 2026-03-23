/**
 * Add AcroForm fields to SC SC1040 flat PDF.
 *
 * The SC1040 is a 3-page print-only form with no interactive fields.
 * This script overlays AcroForm text fields at the correct positions.
 *
 * Usage: npx tsx scripts/add-sc-fields.ts
 */
import { PDFDocument } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const INPUT = resolve(__dirname, '../client/public/state-forms/sc-1040.pdf');
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
  { name: 'Your SSN', page: 0, x: 72, y: 640, width: 140, height: 14 },
  { name: 'Spouse SSN', page: 0, x: 72, y: 614, width: 140, height: 14 },
  { name: 'First Name MI', page: 0, x: 36, y: 560, width: 250, height: 14 },
  { name: 'Last Name', page: 0, x: 300, y: 560, width: 200, height: 14 },
  { name: 'Suffix', page: 0, x: 510, y: 560, width: 50, height: 14 },
  { name: 'Spouse First Name', page: 0, x: 36, y: 538, width: 250, height: 14 },
  { name: 'Spouse Last Name', page: 0, x: 300, y: 538, width: 200, height: 14 },
  { name: 'Spouse Suffix', page: 0, x: 510, y: 538, width: 50, height: 14 },
  { name: 'Mailing Address', page: 0, x: 100, y: 514, width: 380, height: 14 },
  { name: 'County Code', page: 0, x: 510, y: 514, width: 50, height: 14 },
  { name: 'City', page: 0, x: 36, y: 492, width: 220, height: 14 },
  { name: 'State', page: 0, x: 270, y: 492, width: 40, height: 14 },
  { name: 'ZIP', page: 0, x: 320, y: 492, width: 80, height: 14 },
  { name: 'Phone', page: 0, x: 420, y: 492, width: 140, height: 14 },

  // ── Page 1: Dependents ─────────────────────────────────────
  { name: 'Num Federal Deps', page: 0, x: 530, y: 338, width: 40, height: 14 },
  { name: 'Num Deps Under 6', page: 0, x: 530, y: 318, width: 40, height: 14 },
  { name: 'Num Taxpayers 65+', page: 0, x: 530, y: 298, width: 40, height: 14 },

  // ── Page 2: Header ─────────────────────────────────────────
  { name: 'Page 2 SSN', page: 1, x: 310, y: 754, width: 140, height: 14 },

  // ── Page 2: Income Lines 1-10 ──────────────────────────────
  { name: 'Line 1', page: 1, x: 450, y: 720, width: 100, height: 14 },
  { name: 'Line 2a', page: 1, x: 380, y: 694, width: 70, height: 14 },
  { name: 'Line 2', page: 1, x: 480, y: 660, width: 70, height: 14 },
  { name: 'Line 3', page: 1, x: 480, y: 640, width: 70, height: 14 },

  // Subtractions (Lines f-w, line 4)
  { name: 'Line 4f', page: 1, x: 380, y: 620, width: 70, height: 14 },
  { name: 'Line 4o', page: 1, x: 380, y: 442, width: 70, height: 14 },
  { name: 'Line 4w', page: 1, x: 380, y: 270, width: 70, height: 14 },
  { name: 'Line 4', page: 1, x: 480, y: 248, width: 70, height: 14 },

  // SC Income Subject to Tax and Tax
  { name: 'Line 5', page: 1, x: 480, y: 222, width: 70, height: 14 },
  { name: 'Line 6', page: 1, x: 380, y: 200, width: 70, height: 14 },
  { name: 'Line 10', page: 1, x: 480, y: 148, width: 70, height: 14 },

  // ── Page 3: Header ─────────────────────────────────────────
  { name: 'Page 3 SSN', page: 2, x: 310, y: 754, width: 140, height: 14 },

  // ── Page 3: Credits (Lines 11-15) ──────────────────────────
  { name: 'Line 11', page: 2, x: 380, y: 718, width: 70, height: 14 },
  { name: 'Line 14', page: 2, x: 480, y: 678, width: 70, height: 14 },
  { name: 'Line 15', page: 2, x: 480, y: 658, width: 70, height: 14 },

  // ── Page 3: Payments (Lines 16-23) ─────────────────────────
  { name: 'Line 16', page: 2, x: 380, y: 636, width: 70, height: 14 },
  { name: 'Line 17', page: 2, x: 380, y: 616, width: 70, height: 14 },
  { name: 'Line 18', page: 2, x: 380, y: 596, width: 70, height: 14 },
  { name: 'Line 22', page: 2, x: 480, y: 522, width: 70, height: 14 },
  { name: 'Line 23', page: 2, x: 480, y: 492, width: 70, height: 14 },

  // ── Page 3: Refund / Balance Due ───────────────────────────
  { name: 'Line 24', page: 2, x: 480, y: 470, width: 70, height: 14 },
  { name: 'Line 25', page: 2, x: 480, y: 448, width: 70, height: 14 },
  { name: 'Line 30', page: 2, x: 480, y: 364, width: 70, height: 14 },
  { name: 'Line 31', page: 2, x: 480, y: 342, width: 70, height: 14 },
  { name: 'Line 34', page: 2, x: 480, y: 292, width: 70, height: 14 },
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

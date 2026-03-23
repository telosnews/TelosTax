/**
 * Add AcroForm fields to DC D-40 flat PDF.
 *
 * The DC D-40 is a 3-page print-only form with no interactive fields.
 * This script overlays AcroForm text fields at the correct positions.
 *
 * Usage: npx tsx scripts/add-dc-fields.ts
 */
import { PDFDocument } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const INPUT = resolve(__dirname, '../client/public/state-forms/dc-d40.pdf');
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
// Page 0 = D-40 page 1, Page 1 = D-40 page 2, Page 2 = D-40 page 3

const fields: FieldDef[] = [
  // ── Page 1: Personal Information ────────────────────────────
  { name: 'Your TIN', page: 0, x: 82, y: 685, width: 170, height: 14 },
  { name: 'Spouse TIN', page: 0, x: 388, y: 685, width: 170, height: 14 },
  { name: 'Your First Name', page: 0, x: 82, y: 650, width: 185, height: 14 },
  { name: 'Your MI', page: 0, x: 272, y: 650, width: 25, height: 14 },
  { name: 'Your Last Name', page: 0, x: 310, y: 650, width: 210, height: 14 },
  { name: 'Spouse First Name', page: 0, x: 82, y: 625, width: 185, height: 14 },
  { name: 'Spouse MI', page: 0, x: 272, y: 625, width: 25, height: 14 },
  { name: 'Spouse Last Name', page: 0, x: 310, y: 625, width: 210, height: 14 },
  { name: 'Home Address', page: 0, x: 82, y: 598, width: 440, height: 14 },
  { name: 'City', page: 0, x: 82, y: 571, width: 260, height: 14 },
  { name: 'State', page: 0, x: 365, y: 571, width: 40, height: 14 },
  { name: 'ZIP', page: 0, x: 420, y: 571, width: 105, height: 14 },
  { name: 'Email', page: 0, x: 82, y: 544, width: 440, height: 14 },

  // ── Page 1: Income Information ──────────────────────────────
  { name: 'Line a', page: 0, x: 412, y: 235, width: 130, height: 14 },
  { name: 'Line b', page: 0, x: 412, y: 213, width: 130, height: 14 },
  { name: 'Line c', page: 0, x: 412, y: 191, width: 130, height: 14 },
  { name: 'Line d', page: 0, x: 412, y: 169, width: 130, height: 14 },

  // ── Page 1: Line 4 — Federal AGI ───────────────────────────
  { name: 'Line 4', page: 0, x: 430, y: 118, width: 120, height: 14 },

  // ── Page 2: Header ─────────────────────────────────────────
  { name: 'Page 2 Last Name', page: 1, x: 100, y: 752, width: 200, height: 14 },
  { name: 'Page 2 TIN', page: 1, x: 100, y: 735, width: 200, height: 14 },

  // ── Page 2: Additions to DC Income (Lines 5-7) ─────────────
  { name: 'Line 5', page: 1, x: 440, y: 695, width: 100, height: 14 },
  { name: 'Line 6', page: 1, x: 440, y: 675, width: 100, height: 14 },
  { name: 'Line 7', page: 1, x: 440, y: 652, width: 100, height: 14 },

  // ── Page 2: Subtractions from DC Income (Lines 8-16) ────────
  { name: 'Line 8', page: 1, x: 440, y: 624, width: 100, height: 14 },
  { name: 'Line 9', page: 1, x: 440, y: 604, width: 100, height: 14 },
  { name: 'Line 10', page: 1, x: 440, y: 584, width: 100, height: 14 },
  { name: 'Line 11', page: 1, x: 440, y: 564, width: 100, height: 14 },
  { name: 'Line 12', page: 1, x: 440, y: 544, width: 100, height: 14 },
  { name: 'Line 13', page: 1, x: 440, y: 524, width: 100, height: 14 },
  { name: 'Line 14', page: 1, x: 440, y: 504, width: 100, height: 14 },
  { name: 'Line 15', page: 1, x: 440, y: 484, width: 100, height: 14 },
  { name: 'Line 16', page: 1, x: 440, y: 461, width: 100, height: 14 },

  // ── Page 2: Deductions & Tax (Lines 18-28) ──────────────────
  { name: 'Line 18', page: 1, x: 440, y: 408, width: 100, height: 14 },
  { name: 'Line 19', page: 1, x: 440, y: 386, width: 100, height: 14 },
  { name: 'Line 20', page: 1, x: 440, y: 362, width: 100, height: 14 },
  { name: 'Line 21', page: 1, x: 440, y: 335, width: 100, height: 14 },
  { name: 'Line 22', page: 1, x: 440, y: 310, width: 100, height: 14 },
  { name: 'Line 23', page: 1, x: 440, y: 290, width: 100, height: 14 },
  { name: 'Line 24', page: 1, x: 440, y: 270, width: 100, height: 14 },
  { name: 'Line 25', page: 1, x: 440, y: 248, width: 100, height: 14 },
  { name: 'Line 26', page: 1, x: 440, y: 226, width: 100, height: 14 },
  { name: 'Line 27b', page: 1, x: 440, y: 170, width: 100, height: 14 },
  { name: 'Line 27d', page: 1, x: 440, y: 148, width: 100, height: 14 },
  { name: 'Line 27e', page: 1, x: 440, y: 128, width: 100, height: 14 },
  { name: 'Line 28', page: 1, x: 440, y: 106, width: 100, height: 14 },

  // ── Page 3: Header ─────────────────────────────────────────
  { name: 'Page 3 Last Name', page: 2, x: 100, y: 752, width: 200, height: 14 },
  { name: 'Page 3 TIN', page: 2, x: 100, y: 735, width: 200, height: 14 },

  // ── Page 3: Credits & Payments (Lines 29-43) ────────────────
  { name: 'Line 29', page: 2, x: 440, y: 704, width: 100, height: 14 },
  { name: 'Line 30', page: 2, x: 440, y: 681, width: 100, height: 14 },
  { name: 'Line 31', page: 2, x: 440, y: 658, width: 100, height: 14 },
  { name: 'Line 32', page: 2, x: 440, y: 636, width: 100, height: 14 },
  { name: 'Line 33', page: 2, x: 440, y: 614, width: 100, height: 14 },
  { name: 'Line 34', page: 2, x: 440, y: 592, width: 100, height: 14 },
  { name: 'Line 35', page: 2, x: 440, y: 570, width: 100, height: 14 },
  { name: 'Line 36', page: 2, x: 440, y: 548, width: 100, height: 14 },
  { name: 'Line 37', page: 2, x: 440, y: 526, width: 100, height: 14 },
  { name: 'Line 38', page: 2, x: 440, y: 504, width: 100, height: 14 },
  { name: 'Line 39', page: 2, x: 440, y: 482, width: 100, height: 14 },
  { name: 'Line 40', page: 2, x: 440, y: 460, width: 100, height: 14 },
  { name: 'Line 41', page: 2, x: 440, y: 438, width: 100, height: 14 },
  { name: 'Line 42', page: 2, x: 440, y: 416, width: 100, height: 14 },
  { name: 'Line 43', page: 2, x: 440, y: 394, width: 100, height: 14 },
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

/**
 * Add AcroForm fields to WV IT-140 flat PDF.
 *
 * The WV booklet only provides a print-only PDF with no interactive fields.
 * This script overlays AcroForm text fields at the correct positions based
 * on the form layout, producing a fillable version.
 *
 * Usage: npx tsx scripts/add-wv-fields.ts
 */
import { PDFDocument, PDFTextField, rgb } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const INPUT = resolve(__dirname, '../client/public/state-forms/wv-it140.pdf');
const OUTPUT = INPUT; // overwrite in place

interface FieldDef {
  name: string;
  page: number; // 0-indexed
  x: number;
  y: number;
  width: number;
  height: number;
}

// Page dimensions are approximately 612 x 792 (standard letter)
// Coordinates are from bottom-left corner
// Page 0 = IT-140 page 1, Page 1 = IT-140 page 2

const fields: FieldDef[] = [
  // ── Page 1: Identity ──────────────────────────────────────
  { name: 'SSN', page: 0, x: 36, y: 718, width: 120, height: 14 },
  { name: 'Spouse SSN', page: 0, x: 300, y: 718, width: 120, height: 14 },
  { name: 'Last Name', page: 0, x: 36, y: 693, width: 230, height: 14 },
  { name: 'Suffix', page: 0, x: 270, y: 693, width: 40, height: 14 },
  { name: 'Your First Name', page: 0, x: 320, y: 693, width: 200, height: 14 },
  { name: 'MI', page: 0, x: 540, y: 693, width: 30, height: 14 },
  { name: 'Spouse Last Name', page: 0, x: 36, y: 672, width: 230, height: 14 },
  { name: 'Spouse Suffix', page: 0, x: 270, y: 672, width: 40, height: 14 },
  { name: 'Spouse First Name', page: 0, x: 320, y: 672, width: 200, height: 14 },
  { name: 'Spouse MI', page: 0, x: 540, y: 672, width: 30, height: 14 },
  { name: 'Address Line 1', page: 0, x: 36, y: 651, width: 260, height: 14 },
  { name: 'Address Line 2', page: 0, x: 300, y: 651, width: 270, height: 14 },
  { name: 'City', page: 0, x: 36, y: 630, width: 230, height: 14 },
  { name: 'State', page: 0, x: 300, y: 630, width: 50, height: 14 },
  { name: 'ZIP', page: 0, x: 360, y: 630, width: 80, height: 14 },

  // ── Page 1: Exemptions ────────────────────────────────────
  { name: 'Exemption a', page: 0, x: 530, y: 472, width: 30, height: 14 },
  { name: 'Exemption b', page: 0, x: 530, y: 454, width: 30, height: 14 },
  { name: 'Exemption c', page: 0, x: 530, y: 432, width: 30, height: 14 },
  { name: 'Exemption e', page: 0, x: 530, y: 355, width: 30, height: 14 },

  // ── Page 1: Income Lines 1-8 ──────────────────────────────
  { name: 'Line 1', page: 0, x: 460, y: 320, width: 90, height: 14 },
  { name: 'Line 2', page: 0, x: 460, y: 300, width: 90, height: 14 },
  { name: 'Line 3', page: 0, x: 460, y: 280, width: 90, height: 14 },
  { name: 'Line 4', page: 0, x: 460, y: 260, width: 90, height: 14 },
  { name: 'Line 5', page: 0, x: 460, y: 240, width: 90, height: 14 },
  { name: 'Line 6', page: 0, x: 460, y: 220, width: 90, height: 14 },
  { name: 'Line 7', page: 0, x: 460, y: 200, width: 90, height: 14 },
  { name: 'Line 8', page: 0, x: 460, y: 176, width: 90, height: 14 },

  // ── Page 2: Tax/Credits/Payments Lines 9-28 ───────────────
  { name: 'Page 2 Name', page: 1, x: 90, y: 740, width: 200, height: 14 },
  { name: 'Page 2 SSN', page: 1, x: 420, y: 740, width: 120, height: 14 },
  { name: 'Line 9', page: 1, x: 460, y: 718, width: 90, height: 14 },
  { name: 'Line 10', page: 1, x: 460, y: 698, width: 90, height: 14 },
  { name: 'Line 11', page: 1, x: 460, y: 678, width: 90, height: 14 },
  { name: 'Line 12', page: 1, x: 460, y: 658, width: 90, height: 14 },
  { name: 'Line 13', page: 1, x: 460, y: 632, width: 90, height: 14 },
  { name: 'Line 14', page: 1, x: 460, y: 612, width: 90, height: 14 },
  { name: 'Line 15', page: 1, x: 460, y: 586, width: 90, height: 14 },
  { name: 'Line 16', page: 1, x: 460, y: 566, width: 90, height: 14 },
  { name: 'Line 17', page: 1, x: 460, y: 546, width: 90, height: 14 },
  { name: 'Line 18', page: 1, x: 460, y: 526, width: 90, height: 14 },
  { name: 'Line 19', page: 1, x: 460, y: 506, width: 90, height: 14 },
  { name: 'Line 20', page: 1, x: 460, y: 486, width: 90, height: 14 },
  { name: 'Line 21', page: 1, x: 460, y: 460, width: 90, height: 14 },
  { name: 'Line 22', page: 1, x: 460, y: 440, width: 90, height: 14 },
  { name: 'Line 23', page: 1, x: 460, y: 420, width: 90, height: 14 },
  { name: 'Line 24', page: 1, x: 460, y: 396, width: 90, height: 14 },
  { name: 'Line 25', page: 1, x: 460, y: 376, width: 90, height: 14 },
  { name: 'Line 26', page: 1, x: 460, y: 350, width: 90, height: 14 },
  { name: 'Line 27', page: 1, x: 460, y: 324, width: 90, height: 14 },
  { name: 'Line 28', page: 1, x: 460, y: 304, width: 90, height: 14 },
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

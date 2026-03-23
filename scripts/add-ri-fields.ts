/**
 * Add AcroForm fields to RI RI-1040 flat PDF.
 *
 * The RI-1040 is a 5-page form (pages 1-2 are main return, 3-5 are schedules).
 * This script overlays AcroForm text fields at the correct positions.
 *
 * Usage: npx tsx scripts/add-ri-fields.ts
 */
import { PDFDocument } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const INPUT = resolve(__dirname, '../client/public/state-forms/ri-1040.pdf');
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
  { name: 'Your SSN', page: 0, x: 60, y: 700, width: 150, height: 14 },
  { name: 'Spouse SSN', page: 0, x: 280, y: 700, width: 150, height: 14 },
  { name: 'Your First Name', page: 0, x: 60, y: 676, width: 130, height: 14 },
  { name: 'Your MI', page: 0, x: 198, y: 676, width: 22, height: 14 },
  { name: 'Your Last Name', page: 0, x: 228, y: 676, width: 170, height: 14 },
  { name: 'Your Suffix', page: 0, x: 410, y: 676, width: 40, height: 14 },
  { name: 'Spouse First Name', page: 0, x: 60, y: 654, width: 130, height: 14 },
  { name: 'Spouse MI', page: 0, x: 198, y: 654, width: 22, height: 14 },
  { name: 'Spouse Last Name', page: 0, x: 228, y: 654, width: 170, height: 14 },
  { name: 'Spouse Suffix', page: 0, x: 410, y: 654, width: 40, height: 14 },
  { name: 'Address', page: 0, x: 60, y: 632, width: 400, height: 14 },
  { name: 'City', page: 0, x: 60, y: 610, width: 210, height: 14 },
  { name: 'State', page: 0, x: 285, y: 610, width: 40, height: 14 },
  { name: 'ZIP', page: 0, x: 340, y: 610, width: 80, height: 14 },
  { name: 'City of Legal Residence', page: 0, x: 60, y: 588, width: 160, height: 14 },

  // ── Page 1: Income, Tax and Credits (Lines 1-13a) ───────────
  { name: 'Line 1', page: 0, x: 478, y: 454, width: 100, height: 14 },
  { name: 'Line 2', page: 0, x: 478, y: 432, width: 100, height: 14 },
  { name: 'Line 3', page: 0, x: 478, y: 410, width: 100, height: 14 },
  { name: 'Line 4', page: 0, x: 478, y: 388, width: 100, height: 14 },
  { name: 'Line 5', page: 0, x: 478, y: 366, width: 100, height: 14 },
  { name: 'Line 6', page: 0, x: 478, y: 340, width: 100, height: 14 },
  { name: 'Line 7', page: 0, x: 478, y: 316, width: 100, height: 14 },
  { name: 'Line 8', page: 0, x: 478, y: 292, width: 100, height: 14 },
  { name: 'Line 9a', page: 0, x: 340, y: 266, width: 80, height: 14 },
  { name: 'Line 9b', page: 0, x: 340, y: 244, width: 80, height: 14 },
  { name: 'Line 9c', page: 0, x: 340, y: 222, width: 80, height: 14 },
  { name: 'Line 9d', page: 0, x: 478, y: 200, width: 100, height: 14 },
  { name: 'Line 10a', page: 0, x: 478, y: 178, width: 100, height: 14 },
  { name: 'Line 10b', page: 0, x: 478, y: 156, width: 100, height: 14 },
  { name: 'Line 11', page: 0, x: 478, y: 134, width: 100, height: 14 },
  { name: 'Line 12a', page: 0, x: 478, y: 110, width: 100, height: 14 },
  { name: 'Line 12b', page: 0, x: 478, y: 90, width: 100, height: 14 },
  { name: 'Line 13a', page: 0, x: 478, y: 66, width: 100, height: 14 },

  // ── Page 2: Header ─────────────────────────────────────────
  { name: 'Page 2 Name', page: 1, x: 60, y: 732, width: 240, height: 14 },
  { name: 'Page 2 SSN', page: 1, x: 430, y: 732, width: 140, height: 14 },

  // ── Page 2: Payments (Lines 13b-18) ─────────────────────────
  { name: 'Line 13b', page: 1, x: 478, y: 700, width: 100, height: 14 },
  { name: 'Line 14a', page: 1, x: 340, y: 668, width: 80, height: 14 },
  { name: 'Line 14b', page: 1, x: 340, y: 640, width: 80, height: 14 },
  { name: 'Line 14c', page: 1, x: 340, y: 612, width: 80, height: 14 },
  { name: 'Line 14d', page: 1, x: 340, y: 584, width: 80, height: 14 },
  { name: 'Line 14e', page: 1, x: 340, y: 556, width: 80, height: 14 },
  { name: 'Line 14f', page: 1, x: 340, y: 528, width: 80, height: 14 },
  { name: 'Line 14g', page: 1, x: 478, y: 500, width: 100, height: 14 },
  { name: 'Line 14h', page: 1, x: 478, y: 472, width: 100, height: 14 },
  { name: 'Line 14i', page: 1, x: 478, y: 448, width: 100, height: 14 },
  { name: 'Line 15a', page: 1, x: 478, y: 418, width: 100, height: 14 },
  { name: 'Line 15b', page: 1, x: 478, y: 388, width: 100, height: 14 },
  { name: 'Line 15c', page: 1, x: 478, y: 360, width: 100, height: 14 },
  { name: 'Line 16', page: 1, x: 478, y: 324, width: 100, height: 14 },
  { name: 'Line 17', page: 1, x: 478, y: 296, width: 100, height: 14 },
  { name: 'Line 18', page: 1, x: 340, y: 268, width: 80, height: 14 },
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

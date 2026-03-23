/**
 * Extract fillable form pages from state tax booklets.
 *
 * Inspects each booklet PDF for AcroForm fields, identifies which pages
 * contain fields, and extracts those pages into standalone PDFs.
 *
 * Usage:
 *   npx tsx scripts/extract-state-form-pages.ts
 */
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from 'pdf-lib';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, basename } from 'path';

const BOOKLETS_DIR = resolve(__dirname, '../docs/state-tax-booklets');
const OUTPUT_DIR = resolve(__dirname, '../client/public/state-forms');

// Booklets to process: [filename, output name, description]
const BOOKLETS: [string, string, string][] = [
  ['CO-2025-Book104.pdf', 'co-104.pdf', 'Colorado Form 104'],
  ['HI-2025-N11-Instructions.pdf', 'hi-n11.pdf', 'Hawaii Form N-11'],
  ['ID-2025-Form40-Instructions.pdf', 'id-40.pdf', 'Idaho Form 40'],
  ['KS-2025-Income-Tax-Booklet.pdf', 'ks-k40.pdf', 'Kansas Form K-40'],
  ['MA-2025-Form1-Instructions.pdf', 'ma-1.pdf', 'Massachusetts Form 1'],
  ['NE-2025-1040N-Booklet.pdf', 'ne-1040n.pdf', 'Nebraska Form 1040N'],
  ['OK-2025-Form511-Packet.pdf', 'ok-511.pdf', 'Oklahoma Form 511'],
];

async function getFieldPages(doc: PDFDocument): Promise<Set<number>> {
  const form = doc.getForm();
  const fields = form.getFields();
  const pages = doc.getPages();
  const fieldPages = new Set<number>();

  for (const field of fields) {
    // Get widgets (visual representations) of each field
    const widgets = field.acroField.getWidgets();
    for (const widget of widgets) {
      // Find which page this widget belongs to
      const widgetPage = widget.P();
      if (widgetPage) {
        for (let i = 0; i < pages.length; i++) {
          if (pages[i].ref === widgetPage) {
            fieldPages.add(i);
            break;
          }
        }
      }
    }
  }

  return fieldPages;
}

async function processBooklet(bookletFile: string, outputFile: string, description: string) {
  const inputPath = resolve(BOOKLETS_DIR, bookletFile);
  if (!existsSync(inputPath)) {
    console.log(`  SKIP: ${bookletFile} not found`);
    return;
  }

  const bytes = readFileSync(inputPath);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const totalPages = doc.getPageCount();

  console.log(`\n${description} (${bookletFile})`);
  console.log(`  Total pages: ${totalPages}`);

  // Find pages with form fields
  const fieldPages = await getFieldPages(doc);

  if (fieldPages.size === 0) {
    console.log('  WARNING: No field pages found via widget analysis. Trying field name heuristic...');
    // Fallback: try to identify form pages by checking field count
    const form = doc.getForm();
    const fields = form.getFields();
    console.log(`  Total fields: ${fields.length}`);
    if (fields.length > 0) {
      console.log(`  Field names sample: ${fields.slice(0, 5).map(f => f.getName()).join(', ')}`);
    }
    return;
  }

  const sortedPages = [...fieldPages].sort((a, b) => a - b);
  console.log(`  Pages with fields: ${sortedPages.map(p => p + 1).join(', ')} (${fieldPages.size} pages)`);

  // Extract those pages into a new PDF
  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(doc, sortedPages);
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  // Copy form fields — copyPages copies the visual appearance but not the AcroForm.
  // Instead, load the original and remove non-form pages.
  // Better approach: reload the original and remove instruction pages.
  const doc2 = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const allPageIndices = Array.from({ length: totalPages }, (_, i) => i);
  const pagesToRemove = allPageIndices.filter(i => !fieldPages.has(i));

  // Remove pages in reverse order to maintain indices
  for (const idx of pagesToRemove.reverse()) {
    doc2.removePage(idx);
  }

  const outputPath = resolve(OUTPUT_DIR, outputFile);
  const outputBytes = await doc2.save();
  writeFileSync(outputPath, outputBytes);
  console.log(`  Saved: ${outputFile} (${doc2.getPageCount()} pages, ${(outputBytes.length / 1024).toFixed(0)} KB)`);

  // Verify the extracted form has fields
  const verifyDoc = await PDFDocument.load(outputBytes);
  const verifyFields = verifyDoc.getForm().getFields().length;
  console.log(`  Verified: ${verifyFields} form fields in extracted PDF`);
}

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Extracting form pages from state tax booklets...');
  console.log(`Input: ${BOOKLETS_DIR}`);
  console.log(`Output: ${OUTPUT_DIR}`);

  for (const [bookletFile, outputFile, description] of BOOKLETS) {
    try {
      await processBooklet(bookletFile, outputFile, description);
    } catch (err) {
      console.error(`  ERROR processing ${bookletFile}: ${err}`);
    }
  }

  console.log('\nDone.');
}

main();

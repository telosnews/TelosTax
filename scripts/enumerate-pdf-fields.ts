/**
 * Dev tool: Enumerate all AcroForm fields in an IRS fillable PDF.
 *
 * Usage:
 *   npx tsx scripts/enumerate-pdf-fields.ts client/public/irs-forms/f1040.pdf
 *   npx tsx scripts/enumerate-pdf-fields.ts client/public/irs-forms/f1040s1.pdf
 */
import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'fs';
import { resolve } from 'path';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx scripts/enumerate-pdf-fields.ts <path-to-pdf>');
    process.exit(1);
  }

  const absolutePath = resolve(filePath);
  console.log(`\n📄 Loading: ${absolutePath}\n`);

  const pdfBytes = readFileSync(absolutePath);
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();
  const fields = form.getFields();

  console.log(`Found ${fields.length} form fields:\n`);
  console.log('TYPE'.padEnd(20) + 'NAME');
  console.log('─'.repeat(80));

  for (const field of fields) {
    const typeName = field.constructor.name;
    const name = field.getName();
    console.log(`${typeName.padEnd(20)} ${name}`);
  }

  console.log(`\n✅ Total: ${fields.length} fields\n`);
}

main().catch(console.error);

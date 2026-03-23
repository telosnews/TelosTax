import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';

async function main() {
  const bytes = fs.readFileSync('client/public/irs-forms/f1040.pdf');
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();

  const fields = form.getFields();

  // Collect all Page1 fields with their positions
  const page1Fields: Array<{
    name: string;
    shortName: string;
    type: string;
    maxLen: number | undefined;
    x: number;
    y: number;
    w: number;
    h: number;
  }> = [];

  for (const f of fields) {
    const name = f.getName();
    if (!name.includes('Page1')) continue;

    const type = f.constructor.name;
    let maxLen: number | undefined;
    if (type === 'PDFTextField') {
      const tf = form.getTextField(name);
      maxLen = tf.getMaxLength();
    }

    const widgets = f.acroField.getWidgets();
    for (const w of widgets) {
      const r = w.getRectangle();
      const shortName = name
        .replace('topmostSubform[0].Page1[0].', '')
        .replace('Table_Dependents[0].', 'Dep.')
        .replace('Address_ReadOrder[0].', 'Addr.')
        .replace('Checkbox_ReadOrder[0].', 'CB.')
        .replace('Dependents_ReadOrder[0].', 'DepRO.')
        .replace('SSN_ReadOrder[0].', 'SSN.');

      page1Fields.push({
        name,
        shortName,
        type: type.replace('PDF', ''),
        maxLen,
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
  }

  // Sort by Y descending (top of page first), then X ascending
  page1Fields.sort((a, b) => b.y - a.y || a.x - b.x);

  // Group by approximate Y position (within 5px)
  let lastY = -1;
  console.log('Page 1 Fields — sorted top-to-bottom, left-to-right');
  console.log('='.repeat(120));

  for (const f of page1Fields) {
    if (lastY === -1 || Math.abs(f.y - lastY) > 5) {
      console.log(`\n── y≈${f.y} ──`);
      lastY = f.y;
    }
    const mlStr = f.maxLen !== undefined ? ` maxLen=${f.maxLen}` : '';
    const typeStr = f.type === 'CheckBox' ? ' [CB]' : '';
    console.log(`  ${f.shortName.padEnd(55)} x=${String(f.x).padStart(3)} w=${String(f.w).padStart(3)}${mlStr}${typeStr}`);
  }
}

main().catch(console.error);

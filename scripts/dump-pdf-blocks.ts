/**
 * Debug script: dump all text blocks from a PDF with their coordinates.
 * Usage: npx tsx scripts/dump-pdf-blocks.ts test-corpus/forms/test-1040-2024-hoh.pdf
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: npx tsx scripts/dump-pdf-blocks.ts <pdf-path>');
  process.exit(1);
}

async function main() {
  const buf = readFileSync(resolve(filePath));
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  console.log(`Pages: ${pdf.numPages}\n`);

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    console.log(`=== Page ${i} (${viewport.width} x ${viewport.height}) ===`);

    const blocks: Array<{ text: string; x: number; y: number }> = [];
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim()) {
        blocks.push({
          text: item.str.trim(),
          x: Math.round(item.transform[4] * 10) / 10,
          y: Math.round((viewport.height - item.transform[5]) * 10) / 10,
        });
      }
    }

    // Sort by Y then X for readability
    blocks.sort((a, b) => a.y - b.y || a.x - b.x);

    for (const b of blocks) {
      const xStr = String(b.x).padStart(6);
      const yStr = String(b.y).padStart(6);
      console.log(`  x=${xStr}  y=${yStr}  "${b.text}"`);
    }
    console.log(`  --- ${blocks.length} blocks ---\n`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });

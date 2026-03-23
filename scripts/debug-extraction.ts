/**
 * Debug script: run the extraction algorithm against a test PDF and print results.
 * Usage: npx tsx scripts/debug-extraction.ts test-corpus/forms/test-1040-2024-hoh.pdf
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: npx tsx scripts/debug-extraction.ts <pdf-path>');
  process.exit(1);
}

// ─── Inline the extraction logic to debug ───────────

interface TextBlock {
  text: string;
  x: number;
  y: number;
  page: number;
}

function parseDollarValue(raw: string): number | null {
  let cleaned = raw.replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }
  // Reject strings with non-numeric characters (e.g., "1a", "2b", "Form")
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

function detectValueColumnX(blocks: TextBlock[], page: number): number {
  const valueXPositions: number[] = [];
  for (const b of blocks) {
    if (b.page !== page) continue;
    if (b.x < 200) continue; // Skip left sidebar
    const num = parseDollarValue(b.text);
    if (num !== null && Math.abs(num) >= 100) {
      valueXPositions.push(Math.round(b.x / 20) * 20);
    }
  }
  if (valueXPositions.length === 0) return 540;
  const freq = new Map<number, number>();
  for (const x of valueXPositions) {
    freq.set(x, (freq.get(x) || 0) + 1);
  }
  console.log('  Column X frequency:', Object.fromEntries(freq));
  let bestX = 540;
  let bestCount = 0;
  for (const [x, count] of freq) {
    if (count > bestCount || (count === bestCount && x > bestX)) {
      bestX = x;
      bestCount = count;
    }
  }
  return bestX;
}

function findColumnValue(
  blocks: TextBlock[],
  keywords: string[],
  valueColumnX: number,
  debug = false,
  strictColumnOnly = false,
): number {
  const labelBlocks = blocks.filter(b =>
    keywords.some(kw => b.text.toLowerCase().includes(kw)),
  );
  if (labelBlocks.length === 0) {
    if (debug) console.log('    NO label match for keywords:', keywords);
    return 0;
  }

  if (debug) {
    console.log(`    Labels matched: ${labelBlocks.map(b => `"${b.text}" @(${b.x},${b.y},p${b.page})`).join(', ')}`);
  }

  for (const labelBlock of labelBlocks) {
    const candidates: Array<{ value: number; x: number; dy: number; text: string }> = [];
    for (const block of blocks) {
      if (block === labelBlock || block.page !== labelBlock.page) continue;
      const parsed = parseDollarValue(block.text);
      if (parsed === null) continue;
      if (Math.abs(parsed) <= 50 && block.text.trim().length <= 2) continue;
      if (Math.abs(parsed) > 10_000_000) continue;
      const dy = Math.abs(block.y - labelBlock.y);
      if (dy > 8) continue;
      const distFromColumn = Math.abs(block.x - valueColumnX);
      if (distFromColumn < 40) {
        candidates.push({ value: parsed, x: block.x, dy, text: block.text });
      }
    }
    if (debug && candidates.length > 0) {
      console.log(`    Column candidates: ${candidates.map(c => `${c.value}("${c.text}")@x=${c.x},dy=${c.dy.toFixed(1)}`).join(', ')}`);
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.dy - b.dy);
      const result = Math.round(candidates[0].value * 100) / 100;
      if (debug) console.log(`    → Column pick: ${result} ("${candidates[0].text}" @x=${candidates[0].x})`);
      return result;
    }
  }

  // Fallback — outer value column only (x > 500), disabled in strict mode
  if (strictColumnOnly) {
    if (debug) console.log('    → 0 (strict mode, no column match)');
    return 0;
  }
  for (const labelBlock of labelBlocks) {
    const candidates: Array<{ value: number; x: number; distance: number; text: string }> = [];
    for (const block of blocks) {
      if (block === labelBlock || block.page !== labelBlock.page) continue;
      if (block.x < 500) continue;
      const parsed = parseDollarValue(block.text);
      if (parsed === null) continue;
      if (Math.abs(parsed) <= 50 && block.text.trim().length <= 2) continue;
      if (Math.abs(parsed) > 10_000_000) continue;
      const dy = Math.abs(block.y - labelBlock.y);
      const dx = block.x - labelBlock.x;
      if (dy < 15 && dx > 0) {
        candidates.push({ value: parsed, x: block.x, distance: dx, text: block.text });
      }
    }
    if (debug && candidates.length > 0) {
      console.log(`    Fallback candidates: ${candidates.map(c => `${c.value}("${c.text}")@x=${c.x}`).join(', ')}`);
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.distance - a.distance);
      const result = Math.round(candidates[0].value * 100) / 100;
      if (debug) console.log(`    → Fallback pick: ${result} ("${candidates[0].text}" @x=${candidates[0].x})`);
      return result;
    }
  }

  if (debug) console.log('    → 0 (no match)');
  return 0;
}

// ─── Keywords ───────────

const FORM_1040_TEXT_KEYWORDS: Record<string, string[]> = {
  wages:          ['w-2, box 1', 'wages, salaries', 'wages'],
  interest:       ['taxable interest'],
  dividends:      ['ordinary dividends'],
  iraDistrib:     ['ira distributions'],
  pensions:       ['pensions and annuities'],
  socialSecurity: ['social security benefits'],
  capitalGain:    ['capital gain or (loss)', 'capital gain'],
  totalIncome:    ['total income'],
  agi:            ['adjusted gross income'],
  deduction:      ['standard deduction or itemized', 'standard deduction'],
  taxableIncome:  ['taxable income'],
  totalTax:       ['total tax'],
  estimatedPmts:  ['estimated tax payments'],
  totalPayments:  ['total payments'],
  refund:         ['refunded to you'],
  amountOwed:     ['amount you owe'],
};

const STRICT_COLUMN_FIELDS = new Set([
  'interest', 'dividends', 'iraDistrib', 'pensions', 'socialSecurity',
]);

// ─── Main ───────────

async function main() {
  const buf = readFileSync(resolve(filePath));
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  // Extract blocks from first 2 pages
  const blocks: TextBlock[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 2); i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim()) {
        blocks.push({
          text: item.str.trim(),
          x: item.transform[4],
          y: viewport.height - item.transform[5],
          page: i,
        });
      }
    }
  }

  console.log(`Total blocks: ${blocks.length}\n`);

  // Detect column X
  const pages = [...new Set(blocks.map(b => b.page))];
  for (const page of pages) {
    console.log(`Page ${page} column detection:`);
    const colX = detectValueColumnX(blocks, page);
    console.log(`  → Column X = ${colX}\n`);
  }

  const defaultColumnX = detectValueColumnX(blocks, pages[0]);
  console.log(`\nUsing defaultColumnX = ${defaultColumnX}\n`);
  console.log('='.repeat(70));

  // Extract each field
  for (const [key, keywords] of Object.entries(FORM_1040_TEXT_KEYWORDS)) {
    const strict = STRICT_COLUMN_FIELDS.has(key);
    console.log(`\n${key} (keywords: ${JSON.stringify(keywords)})${strict ? ' [STRICT]' : ''}:`);
    const value = findColumnValue(blocks, keywords, defaultColumnX, true, strict);
    console.log(`  RESULT: ${value}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });

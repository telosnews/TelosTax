/**
 * Competitor tax provider metadata and export instructions.
 *
 * Used by the CompetitorImportPanel to show provider-specific guidance
 * and auto-detect providers from uploaded 1040 PDFs.
 */

export interface CompetitorProvider {
  id: string;
  name: string;
  instructions: string[];
  pdfHints: string[];
}

export const COMPETITOR_PROVIDERS: CompetitorProvider[] = [
  {
    id: 'turbotax',
    name: 'TurboTax',
    instructions: [
      'Log in to your TurboTax account at myturbotax.intuit.com',
      'Find your completed return under "Tax Home"',
      'Click "Download/print return (PDF)"',
      'Save the PDF file to your computer',
    ],
    pdfHints: ['TurboTax', 'Intuit'],
  },
  {
    id: 'hrblock',
    name: 'H&R Block',
    instructions: [
      'Log in to your H&R Block account at hrblock.com',
      'Go to "Tax Returns" and select the year',
      'Click "Download" or "View/Print Return"',
      'Save the PDF file to your computer',
    ],
    pdfHints: ['H&R Block', 'HRBlock', 'H&R BLOCK'],
  },
  {
    id: 'taxact',
    name: 'TaxAct',
    instructions: [
      'Log in to your TaxAct account at taxact.com',
      'Navigate to "My Taxes" and find the return year',
      'Click "Print/Download" to generate a PDF',
      'Save the PDF file to your computer',
    ],
    pdfHints: ['TaxAct'],
  },
  {
    id: 'freetaxusa',
    name: 'FreeTaxUSA',
    instructions: [
      'Log in to your FreeTaxUSA account at freetaxusa.com',
      'Go to "Prior Year Returns"',
      'Click "Print/Download" on the return',
      'Save the PDF file to your computer',
    ],
    pdfHints: ['FreeTaxUSA', 'TaxHawk'],
  },
  {
    id: 'cashapp',
    name: 'Cash App Taxes',
    instructions: [
      'Open Cash App and go to the "Taxes" section',
      'Find your filed return under "Tax Returns"',
      'Tap "Download PDF" or "View Return"',
      'Save the PDF file to your device',
    ],
    pdfHints: ['Cash App', 'Credit Karma'],
  },
  {
    id: 'other',
    name: 'Other Provider',
    instructions: [
      'Log in to your tax software account',
      'Find and download your completed Form 1040 as a PDF',
      'The PDF should be a digitally-generated 1040 (not a scan)',
    ],
    pdfHints: [],
  },
];

/**
 * Detect which provider generated a 1040 PDF from its text content.
 * Returns the provider ID or undefined if not detected.
 */
export function detectProvider(fullText: string): string | undefined {
  const lower = fullText.toLowerCase();
  for (const provider of COMPETITOR_PROVIDERS) {
    if (provider.id === 'other') continue;
    if (provider.pdfHints.some(hint => lower.includes(hint.toLowerCase()))) {
      return provider.id;
    }
  }
  return undefined;
}

/**
 * Get a provider by its ID. Returns the "Other" provider as fallback.
 */
export function getProvider(id: string): CompetitorProvider {
  return COMPETITOR_PROVIDERS.find(p => p.id === id) || COMPETITOR_PROVIDERS[COMPETITOR_PROVIDERS.length - 1];
}

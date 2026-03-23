/**
 * PII Scanner — shared between server and client.
 *
 * Detects personally identifiable information in text using regex patterns.
 * Returns structured results indicating what was found and sanitized text
 * with PII replaced by placeholders.
 *
 * Used by:
 *   - Client: Primary gate — blocks sending messages containing PII.
 *             In Private mode, warns but allows (data stays local).
 *   - Server: Defense-in-depth — catches anything the client missed.
 */

// ─── Types ─────────────────────────────────────────

export interface PIIScanResult {
  /** Whether any PII was detected. */
  hasPII: boolean;
  /** The text with PII replaced by placeholders. */
  sanitized: string;
  /** Count of PII items detected. */
  detectedCount: number;
  /** Types of PII detected (e.g., 'ssn', 'email'). */
  detectedTypes: string[];
  /** Human-readable warnings for the user. */
  warnings: string[];
}

// ─── Warning Messages ──────────────────────────────

const PII_WARNINGS: Record<string, string> = {
  ssn: 'Social Security Number detected — this will be removed before sending.',
  ssn_partial: 'Partial SSN detected — this will be removed before sending.',
  email: 'Email address detected — this will be removed before sending.',
  phone: 'Phone number detected — this will be removed before sending.',
  ein: 'Employer Identification Number (EIN) detected — this will be removed before sending.',
  address: 'Street address detected — this will be removed before sending.',
  zip_code: 'ZIP code detected — this will be removed before sending.',
  dob: 'Date of birth detected — this will be removed before sending.',
  bank_account: 'Bank account or routing number detected — this will be removed before sending.',
  credit_card: 'Credit card number detected — this will be removed before sending.',
  ip_pin: 'IRS Identity Protection PIN detected — this will be removed before sending.',
  drivers_license: "Driver's license number detected — this will be removed before sending.",
};

// ─── Patterns ──────────────────────────────────────

/**
 * Unicode-aware separator class for SSN patterns.
 * Matches ASCII hyphen, en-dash, em-dash, figure dash, non-breaking hyphen,
 * thin space, non-breaking space, zero-width space, dots, slashes, and spaces.
 */
const SEP = '[-\\s./\\u2010\\u2011\\u2012\\u2013\\u2014\\u00A0\\u2009\\u200B]';

/** Full SSN: 123-45-6789 with any common separator (including Unicode dashes). */
const SSN_FULL = new RegExp(`\\b\\d{3}${SEP}?\\d{2}${SEP}?\\d{4}\\b`, 'g');

/** Partial SSN mentioned near "ssn" / "social security" context. */
const SSN_CONTEXT =
  /(?:ssn|social\s*security(?:\s*number)?|last\s*(?:four|4)(?:\s*digits?)?)\s*(?:is|are|:|-|=)?\s*(\d{4})\b/gi;

/** Email addresses. */
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi;

/** US phone numbers: (555) 123-4567, 555-123-4567, +1 555 123-4567, etc. */
const PHONE =
  /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

/** EIN (Employer Identification Number): 12-3456789. */
const EIN = /\b\d{2}[-]\d{7}\b/g;

/**
 * US street addresses — simple heuristic:
 * Starts with a number, then street words, then common suffix.
 */
const STREET_ADDRESS =
  /\b\d{1,6}\s+[A-Za-z]+(?:\s+[A-Za-z]+){0,3}\s+(?:st(?:reet)?|ave(?:nue)?|blvd|boulevard|dr(?:ive)?|ln|lane|rd|road|ct|court|pl(?:ace)?|way|cir(?:cle)?|pkwy|parkway|ter(?:race)?|trl|trail|loop|hwy|highway|run|pass|xing|crossing|sq(?:uare)?|commons?|row|al(?:ley)?|mews|plaza|plz|esplanade|walk|path|pike|spur|crescent|cres|glen|knoll|ridge|view|meadow|grove|isle|landing|point|bay|bend|cove|heights?|manor|garden|pond|shore|spring|summit|valley)\b\.?(?:\s+(?:apt|suite|ste|unit|#|fl(?:oor)?|rm|room|bldg|building)\s*\.?\s*[A-Za-z0-9-]+)?/gi;

/**
 * ZIP codes (standalone 5-digit or ZIP+4).
 * Negative lookbehinds prevent matching dollar amounts and common income contexts.
 */
const ZIP_CODE = /(?<!\d)(?<!\$)(?<!earned\s)(?<!made\s)(?<!income\s)(?<!salary\s)(?<!wages\s)(?<!paid\s)\b\d{5}(?:-\d{4})?\b(?!\d)/gi;

/**
 * Date of birth — when mentioned near DOB/born/birthday context.
 */
const DOB_CONTEXT =
  /(?:born|birthday|date\s*of\s*birth|dob)\s*(?:on|is|:|-|=)?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\w+\s+\d{1,2},?\s+\d{4})/gi;

/**
 * Bank account / routing numbers — long digit sequences near banking context.
 */
const BANK_CONTEXT =
  /(?:account|routing|acct)\s*(?:#|number|num|no)?\.?\s*(?:is|:|-|=)?\s*(\d{4,17})\b/gi;

/**
 * Credit card numbers — 13-19 digits with optional separators.
 * Validated with the Luhn algorithm to reduce false positives.
 */
const CREDIT_CARD = /\b(\d[ -]?){13,19}\b/g;

/**
 * IRS Identity Protection PIN — 6-digit number in context of "IP PIN" / "identity protection pin".
 */
const IP_PIN_CONTEXT =
  /(?:ip\s*pin|identity\s*protection\s*pin)\s*(?:is|:|-|=)?\s*(\d{6})\b/gi;

/**
 * Driver's license — alphanumeric string near "driver's license" / "DL" context.
 */
const DRIVERS_LICENSE_CONTEXT =
  /(?:driver'?s?\s*licen[cs]e|DL)\s*(?:#|number|num|no)?\.?\s*(?:is|:|-|=)?\s*([A-Za-z0-9]{5,20})\b/gi;

/** Luhn checksum validation for credit card numbers. */
function luhnCheck(digits: string): boolean {
  const nums = digits.replace(/\D/g, '');
  if (nums.length < 13 || nums.length > 19) return false;
  let sum = 0;
  let alternate = false;
  for (let i = nums.length - 1; i >= 0; i--) {
    let n = parseInt(nums[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// ─── Core Scanner ──────────────────────────────────

/**
 * Scan text for PII and return structured results.
 * Returns both the sanitized text and metadata about what was found.
 */
export function scanForPII(text: string): PIIScanResult {
  if (!text) {
    return {
      hasPII: false,
      sanitized: '',
      detectedCount: 0,
      detectedTypes: [],
      warnings: [],
    };
  }

  // Normalize Unicode to catch fullwidth digits (e.g., ０１２３ → 0123)
  text = text.normalize('NFKC');
  // Strip zero-width characters that can break regex matching
  text = text.replace(/[\u200B-\u200F\u2028-\u202F\u00AD\uFEFF\u200D]/g, '');

  let sanitized = text;
  const types = new Set<string>();
  let count = 0;

  // Order matters: strip more specific context-aware patterns first,
  // then generic patterns. This prevents SSN regex from matching
  // bank routing numbers or DOB dates.

  // 1. Bank account/routing numbers (context-aware — must precede SSN)
  sanitized = sanitized.replace(BANK_CONTEXT, (match, digits) => {
    types.add('bank_account');
    count++;
    return match.replace(digits, '[ACCOUNT]');
  });

  // 1b. Credit card numbers (Luhn-validated — after bank to avoid overlap)
  sanitized = sanitized.replace(CREDIT_CARD, (match) => {
    if (luhnCheck(match)) {
      types.add('credit_card');
      count++;
      return '[CARD]';
    }
    return match;
  });

  // 2. Date of birth in context
  sanitized = sanitized.replace(DOB_CONTEXT, (match, date) => {
    types.add('dob');
    count++;
    return match.replace(date, '[DOB]');
  });

  // 2b. IRS Identity Protection PIN (context-aware)
  sanitized = sanitized.replace(IP_PIN_CONTEXT, (match, pin) => {
    types.add('ip_pin');
    count++;
    return match.replace(pin, '[IP_PIN]');
  });

  // 2c. Driver's license (context-aware)
  sanitized = sanitized.replace(DRIVERS_LICENSE_CONTEXT, (match, dlNum) => {
    types.add('drivers_license');
    count++;
    return match.replace(dlNum, '[DL]');
  });

  // 3. SSN mentioned in context ("my SSN is 1234")
  sanitized = sanitized.replace(SSN_CONTEXT, (match, digits) => {
    types.add('ssn_partial');
    count++;
    return match.replace(digits, '[SSN4]');
  });

  // 4. SSN (full) — 3-2-4 pattern
  sanitized = sanitized.replace(SSN_FULL, () => {
    types.add('ssn');
    count++;
    return '[SSN]';
  });

  // 5. Email
  sanitized = sanitized.replace(EMAIL, () => {
    types.add('email');
    count++;
    return '[EMAIL]';
  });

  // 6. EIN (before phone, since EIN is 2-7 digits)
  sanitized = sanitized.replace(EIN, () => {
    types.add('ein');
    count++;
    return '[EIN]';
  });

  // 7. Phone
  sanitized = sanitized.replace(PHONE, (match) => {
    if (match.startsWith('$')) return match;
    types.add('phone');
    count++;
    return '[PHONE]';
  });

  // 8. Street addresses
  sanitized = sanitized.replace(STREET_ADDRESS, () => {
    types.add('address');
    count++;
    return '[ADDRESS]';
  });

  // 9. ZIP codes (after address stripping to avoid double-matching)
  sanitized = sanitized.replace(ZIP_CODE, (match) => {
    if (match.startsWith('[')) return match;
    types.add('zip_code');
    count++;
    return '[ZIP]';
  });

  const detectedTypes = Array.from(types);

  return {
    hasPII: count > 0,
    sanitized,
    detectedCount: count,
    detectedTypes,
    warnings: detectedTypes.map((t) => PII_WARNINGS[t] || `${t} detected.`),
  };
}

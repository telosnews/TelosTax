/**
 * PII Stripping Service — Unit Tests
 *
 * Tests that personally identifiable information is correctly detected
 * and replaced, while preserving tax-relevant data like dollar amounts
 * and employer/payer names.
 */

import { describe, it, expect } from 'vitest';
import { stripPII, stripContext, stripConversationHistory } from '../src/services/piiStripper.js';

// ═══════════════════════════════════════════════════════════════════════════════
// SSN Detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('stripPII — SSN patterns', () => {
  it('strips full SSN with dashes (123-45-6789)', () => {
    const { sanitized, strippedTypes } = stripPII('My SSN is 123-45-6789');
    expect(sanitized).toBe('My SSN is [SSN]');
    expect(strippedTypes).toContain('ssn');
  });

  it('strips full SSN with spaces (123 45 6789)', () => {
    const { sanitized } = stripPII('SSN: 123 45 6789');
    expect(sanitized).toContain('[SSN]');
    expect(sanitized).not.toMatch(/\d{3}\s\d{2}\s\d{4}/);
  });

  it('strips partial SSN in context ("my SSN is 1234")', () => {
    const { sanitized, strippedTypes } = stripPII('last four of my SSN is 5678');
    expect(sanitized).toContain('[SSN4]');
    expect(sanitized).not.toContain('5678');
    expect(strippedTypes).toContain('ssn_partial');
  });

  it('strips "social security number" context', () => {
    const { sanitized } = stripPII('social security number: 9012');
    expect(sanitized).toContain('[SSN4]');
    expect(sanitized).not.toContain('9012');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Email Detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('stripPII — email patterns', () => {
  it('strips standard email addresses', () => {
    const { sanitized, strippedTypes } = stripPII('Contact me at john.doe@example.com');
    expect(sanitized).toBe('Contact me at [EMAIL]');
    expect(strippedTypes).toContain('email');
  });

  it('strips email with plus addressing', () => {
    const { sanitized } = stripPII('user+taxes@gmail.com');
    expect(sanitized).toBe('[EMAIL]');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Phone Detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('stripPII — phone patterns', () => {
  it('strips phone with dashes (555-123-4567)', () => {
    const { sanitized, strippedTypes } = stripPII('Call me at 555-123-4567');
    expect(sanitized).toContain('[PHONE]');
    expect(sanitized).not.toContain('555-123-4567');
    expect(strippedTypes).toContain('phone');
  });

  it('strips phone with dots (555.123.4567)', () => {
    const { sanitized } = stripPII('Phone: 555.123.4567');
    expect(sanitized).toContain('[PHONE]');
  });

  it('strips phone with parens ((555) 123-4567)', () => {
    const { sanitized } = stripPII('(555) 123-4567');
    expect(sanitized).toContain('[PHONE]');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EIN Detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('stripPII — EIN patterns', () => {
  it('strips EIN (12-3456789)', () => {
    const { sanitized, strippedTypes } = stripPII('Employer EIN: 12-3456789');
    expect(sanitized).toContain('[EIN]');
    expect(sanitized).not.toContain('12-3456789');
    expect(strippedTypes).toContain('ein');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Address Detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('stripPII — address patterns', () => {
  it('strips street addresses with common suffixes', () => {
    const { sanitized, strippedTypes } = stripPII('I live at 123 Main Street');
    expect(sanitized).toContain('[ADDRESS]');
    expect(sanitized).not.toContain('123 Main Street');
    expect(strippedTypes).toContain('address');
  });

  it('strips addresses with "Ave", "Dr", "Blvd"', () => {
    expect(stripPII('456 Oak Ave').sanitized).toContain('[ADDRESS]');
    expect(stripPII('789 Pine Dr').sanitized).toContain('[ADDRESS]');
    expect(stripPII('101 Sunset Blvd').sanitized).toContain('[ADDRESS]');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ZIP Code Detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('stripPII — ZIP code patterns', () => {
  it('strips standalone 5-digit ZIP codes', () => {
    const { sanitized, strippedTypes } = stripPII('My ZIP code is 90210');
    expect(sanitized).toContain('[ZIP]');
    expect(sanitized).not.toContain('90210');
    expect(strippedTypes).toContain('zip_code');
  });

  it('strips ZIP+4 codes (may match as SSN due to digit overlap)', () => {
    const { sanitized, strippedCount } = stripPII('zip: 60601-1234');
    // ZIP+4 (5-4 digits) overlaps with SSN pattern (3-2-4 digits)
    // Either [ZIP] or [SSN] is acceptable — the PII is stripped either way
    expect(sanitized).not.toContain('60601');
    expect(strippedCount).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Date of Birth Detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('stripPII — DOB patterns', () => {
  it('strips DOB in "born on" context', () => {
    const { sanitized, strippedTypes } = stripPII('I was born on 03/15/1990');
    expect(sanitized).toContain('[DOB]');
    expect(sanitized).not.toContain('03/15/1990');
    expect(strippedTypes).toContain('dob');
  });

  it('strips DOB with "date of birth" context', () => {
    const { sanitized } = stripPII('date of birth: 1990-03-15');
    expect(sanitized).toContain('[DOB]');
    expect(sanitized).not.toContain('1990-03-15');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Bank Account Detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('stripPII — bank account patterns', () => {
  it('strips account numbers in context', () => {
    const { sanitized, strippedTypes } = stripPII('My account number is 123456789012');
    expect(sanitized).toContain('[ACCOUNT]');
    expect(sanitized).not.toContain('123456789012');
    expect(strippedTypes).toContain('bank_account');
  });

  it('strips routing numbers in context', () => {
    const { sanitized } = stripPII('routing number: 021000021');
    expect(sanitized).toContain('[ACCOUNT]');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Preservation of Tax-Relevant Data
// ═══════════════════════════════════════════════════════════════════════════════

describe('stripPII — preserves tax-relevant data', () => {
  it('preserves dollar amounts', () => {
    const { sanitized } = stripPII('I made $75,000 from my job');
    expect(sanitized).toContain('$75,000');
  });

  it('preserves employer names', () => {
    const { sanitized } = stripPII('I worked at Acme Corporation');
    expect(sanitized).toContain('Acme Corporation');
  });

  it('preserves income type descriptions', () => {
    const { sanitized } = stripPII('I have a 1099-NEC from freelance work');
    expect(sanitized).toContain('1099-NEC');
    expect(sanitized).toContain('freelance');
  });

  it('preserves filing status descriptions', () => {
    const { sanitized } = stripPII('I am married filing jointly');
    expect(sanitized).toBe('I am married filing jointly');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('stripPII — edge cases', () => {
  it('handles empty string', () => {
    const { sanitized, strippedCount } = stripPII('');
    expect(sanitized).toBe('');
    expect(strippedCount).toBe(0);
  });

  it('handles string with no PII', () => {
    const msg = 'I want to know about the standard deduction for 2025';
    const { sanitized, strippedCount } = stripPII(msg);
    expect(sanitized).toBe(msg);
    expect(strippedCount).toBe(0);
  });

  it('handles mixed PII types in a single message', () => {
    const msg = 'My name is at 123 Main St and my SSN is 123-45-6789, email john@test.com';
    const { sanitized, strippedTypes } = stripPII(msg);
    expect(sanitized).not.toContain('123-45-6789');
    expect(sanitized).not.toContain('john@test.com');
    expect(sanitized).toContain('[SSN]');
    expect(sanitized).toContain('[EMAIL]');
    expect(strippedTypes.length).toBeGreaterThanOrEqual(2);
  });

  it('returns stripped count > 0 when PII found', () => {
    const { strippedCount } = stripPII('SSN: 123-45-6789, email: a@b.com');
    expect(strippedCount).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// stripContext
// ═══════════════════════════════════════════════════════════════════════════════

describe('stripContext', () => {
  it('removes blocked PII keys from context object', () => {
    const context = {
      currentStep: 'w2_income',
      firstName: 'John',
      lastName: 'Doe',
      ssnLastFour: '1234',
      dateOfBirth: '1990-01-01',
      addressStreet: '123 Main St',
      addressCity: 'Anytown',
      addressZip: '12345',
      filingStatus: 'single',
      incomeDiscovery: { w2: 'yes' },
    };

    const cleaned = stripContext(context);

    expect(cleaned).not.toHaveProperty('firstName');
    expect(cleaned).not.toHaveProperty('lastName');
    expect(cleaned).not.toHaveProperty('ssnLastFour');
    expect(cleaned).not.toHaveProperty('dateOfBirth');
    expect(cleaned).not.toHaveProperty('addressStreet');
    expect(cleaned).not.toHaveProperty('addressCity');
    expect(cleaned).not.toHaveProperty('addressZip');

    // Non-PII fields preserved
    expect(cleaned.currentStep).toBe('w2_income');
    expect(cleaned.filingStatus).toBe('single');
    expect(cleaned.incomeDiscovery).toEqual({ w2: 'yes' });
  });

  it('drops non-allowlisted keys (allowlist approach)', () => {
    const context = {
      unknownField: { firstName: 'Jane', someValue: 42 },
      currentStep: 'w2_income',
    };
    const cleaned = stripContext(context);
    // Non-allowlisted keys are dropped entirely
    expect(cleaned).not.toHaveProperty('unknownField');
    // Allowlisted keys preserved
    expect(cleaned.currentStep).toBe('w2_income');
  });

  it('recursively strips non-allowlisted keys from nested allowed objects', () => {
    const context = {
      incomeTypeCounts: {
        w2: 2,
        '1099nec': 1,
        firstName: 'Jane', // PII that shouldn't be here
      },
    };
    const cleaned = stripContext(context);
    expect((cleaned.incomeTypeCounts as any).w2).toBe(2);
    expect((cleaned.incomeTypeCounts as any)['1099nec']).toBe(1);
    expect((cleaned.incomeTypeCounts as any).firstName).toBeUndefined();
  });

  it('handles empty context', () => {
    expect(stripContext({})).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// stripConversationHistory
// ═══════════════════════════════════════════════════════════════════════════════

describe('stripConversationHistory', () => {
  it('strips PII from each message in the history', () => {
    const history = [
      { role: 'user', content: 'My SSN is 123-45-6789' },
      { role: 'assistant', content: 'I noted your information.' },
      { role: 'user', content: 'My email is test@example.com' },
    ];

    const stripped = stripConversationHistory(history);

    expect(stripped[0].content).toContain('[SSN]');
    expect(stripped[0].content).not.toContain('123-45-6789');
    expect(stripped[1].content).toBe('I noted your information.');
    expect(stripped[2].content).toContain('[EMAIL]');
    expect(stripped[2].content).not.toContain('test@example.com');
  });

  it('preserves message roles', () => {
    const history = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    const stripped = stripConversationHistory(history);
    expect(stripped[0].role).toBe('user');
    expect(stripped[1].role).toBe('assistant');
  });
});

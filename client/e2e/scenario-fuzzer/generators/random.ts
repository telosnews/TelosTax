/**
 * Seeded PRNG (mulberry32) + randomization helpers.
 * Every scenario is fully deterministic given the same seed.
 */

export type Rng = ReturnType<typeof createRng>;

/** Create a seeded PRNG using the mulberry32 algorithm. */
export function createRng(seed: number) {
  let s = seed | 0;

  /** Returns a float in [0, 1). */
  function next(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  function int(min: number, max: number): number {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  /** Float in [min, max). */
  function float(min: number, max: number): number {
    return next() * (max - min) + min;
  }

  /** Round to 2 decimal places (dollars & cents). */
  function dollars(min: number, max: number): number {
    return Math.round(float(min, max) * 100) / 100;
  }

  /** Round to nearest whole dollar. */
  function wholeDollars(min: number, max: number): number {
    return Math.round(float(min, max));
  }

  /** Returns true with given probability (0-1). */
  function chance(p: number): boolean {
    return next() < p;
  }

  /** Pick one element from an array. */
  function pick<T>(arr: readonly T[]): T {
    return arr[int(0, arr.length - 1)];
  }

  /** Pick N unique elements from an array. */
  function pickN<T>(arr: readonly T[], n: number): T[] {
    const copy = [...arr];
    const result: T[] = [];
    const count = Math.min(n, copy.length);
    for (let i = 0; i < count; i++) {
      const idx = int(0, copy.length - 1);
      result.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return result;
  }

  /** Pick from weighted options: [value, weight][] */
  function weighted<T>(options: readonly [T, number][]): T {
    const totalWeight = options.reduce((sum, [, w]) => sum + w, 0);
    let r = next() * totalWeight;
    for (const [value, weight] of options) {
      r -= weight;
      if (r <= 0) return value;
    }
    return options[options.length - 1][0];
  }

  /** Generate a UUID v4 (deterministic from seed). */
  function uuid(): string {
    const hex = '0123456789abcdef';
    let id = '';
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        id += '-';
      } else if (i === 14) {
        id += '4';
      } else if (i === 19) {
        id += hex[int(8, 11)];
      } else {
        id += hex[int(0, 15)];
      }
    }
    return id;
  }

  const FIRST_NAMES = [
    'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
    'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
    'Thomas', 'Sarah', 'Charles', 'Karen', 'Daniel', 'Lisa', 'Matthew', 'Nancy',
    'Anthony', 'Betty', 'Mark', 'Margaret', 'Andrew', 'Sandra', 'Steven', 'Ashley',
    'Paul', 'Dorothy', 'Joshua', 'Kimberly', 'Kenneth', 'Emily', 'Kevin', 'Donna',
  ];

  const LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
    'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  ];

  const EMPLOYER_NAMES = [
    'Acme Corp', 'Globex Inc', 'Initech LLC', 'Umbrella Corp', 'Cyberdyne Systems',
    'Wayne Enterprises', 'Stark Industries', 'Hooli Inc', 'Pied Piper LLC', 'Dunder Mifflin',
    'Prestige Worldwide', 'Sterling Cooper', 'Vandelay Industries', 'Bluth Company',
    'MomCorp', 'Planet Express', 'Aperture Science', 'Massive Dynamic', 'Oscorp Industries',
  ];

  const BROKER_NAMES = [
    'Fidelity Investments', 'Charles Schwab', 'Vanguard', 'TD Ameritrade',
    'E*TRADE', 'Robinhood', 'Interactive Brokers', 'Merrill Lynch',
  ];

  const STREET_NAMES = [
    'Main St', 'Oak Ave', 'Elm St', 'Park Blvd', 'Cedar Ln', 'Maple Dr',
    'Washington Ave', 'Lake Rd', 'Hill St', 'Pine Ave', 'River Rd', 'Church St',
  ];

  const CITIES = [
    'Springfield', 'Riverside', 'Fairview', 'Madison', 'Georgetown', 'Clinton',
    'Arlington', 'Salem', 'Franklin', 'Chester', 'Greenville', 'Bristol',
  ];

  function firstName(): string {
    return pick(FIRST_NAMES);
  }

  function lastName(): string {
    return pick(LAST_NAMES);
  }

  function employerName(): string {
    return pick(EMPLOYER_NAMES);
  }

  function brokerName(): string {
    return pick(BROKER_NAMES);
  }

  /** Generate a fake SSN (000-00-0000 range, never real). */
  function ssn(): string {
    return `000-${int(10, 99)}-${int(1000, 9999)}`;
  }

  /** Generate a fake EIN. */
  function ein(): string {
    return `${int(10, 99)}-${int(1000000, 9999999)}`;
  }

  /** Generate a date string (YYYY-MM-DD) within a year range. */
  function dateInYear(year: number): string {
    const month = int(1, 12);
    const day = int(1, 28); // safe for all months
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /** Generate a date of birth for a given age (approximate). */
  function dateOfBirth(minAge: number, maxAge: number): string {
    const age = int(minAge, maxAge);
    const year = 2025 - age;
    return dateInYear(year);
  }

  /** Generate a street address. */
  function address(): { street: string; city: string; zip: string } {
    return {
      street: `${int(100, 9999)} ${pick(STREET_NAMES)}`,
      city: pick(CITIES),
      zip: String(int(10000, 99999)),
    };
  }

  /** Generate a stock ticker-like description. */
  function stockDescription(): string {
    const tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'V', 'JNJ',
      'WMT', 'PG', 'MA', 'HD', 'DIS', 'BAC', 'XOM', 'PFE', 'KO', 'CSCO', 'VZ', 'INTC'];
    return `${int(1, 500)} shares ${pick(tickers)}`;
  }

  /** Generate a crypto description. */
  function cryptoDescription(): string {
    const coins = ['BTC', 'ETH', 'SOL', 'ADA', 'DOGE', 'DOT', 'AVAX', 'MATIC', 'LINK', 'XRP'];
    return `${float(0.01, 10).toFixed(4)} ${pick(coins)}`;
  }

  /** Generate a business name. */
  function businessName(): string {
    const types = ['Consulting', 'Design', 'Photography', 'Development', 'Coaching', 'Marketing',
      'Writing', 'Tutoring', 'Cleaning', 'Landscaping', 'Catering', 'Repair'];
    return `${lastName()} ${pick(types)}`;
  }

  return {
    next, int, float, dollars, wholeDollars, chance, pick, pickN, weighted,
    uuid, firstName, lastName, employerName, brokerName, ssn, ein,
    dateInYear, dateOfBirth, address, stockDescription, cryptoDescription, businessName,
  };
}

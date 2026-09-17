/** Currency knowledge needed to print amounts and spell them out. */
const CURRENCIES = {
  INR: { major: 'Rupees', minor: 'Paise', style: 'prefix', grouping: 'indian' },
  AED: { major: 'AED', minor: 'Fils', style: 'suffix', grouping: 'western' },
  USD: { major: 'Dollars', minor: 'Cents', style: 'suffix', grouping: 'western' },
  EUR: { major: 'Euros', minor: 'Cents', style: 'suffix', grouping: 'western' },
  GBP: { major: 'Pounds', minor: 'Pence', style: 'suffix', grouping: 'western' },
  SAR: { major: 'SAR', minor: 'Halalas', style: 'suffix', grouping: 'western' },
};

const DEFAULT_CURRENCY = { major: '', minor: 'Cents', style: 'suffix', grouping: 'western' };

export const currencyInfo = (code) => CURRENCIES[String(code || '').toUpperCase()] ?? { ...DEFAULT_CURRENCY, major: code ?? '' };

/** Rounds to 2 decimals without the usual floating-point surprises. */
export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Formats a number for documents: Indian grouping for INR (1,00,000),
 * western grouping otherwise. Decimals are shown only when needed.
 */
export function formatAmount(value, code, { forceDecimals } = {}) {
  const amount = round2(value ?? 0);
  const { grouping } = currencyInfo(code);
  const locale = grouping === 'indian' ? 'en-IN' : 'en-US';
  const hasFraction = Math.abs(amount % 1) > 0.0001;
  const digits = forceDecimals ?? hasFraction ? 2 : 0;
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: 2 }).format(amount);
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  const rest = n % 10;
  return `${TENS[Math.floor(n / 10)]}${rest ? `-${ONES[rest]}` : ''}`;
}

function threeDigits(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ');
}

function westernWords(n) {
  if (n === 0) return 'Zero';
  const scales = [
    [1_000_000_000, 'Billion'],
    [1_000_000, 'Million'],
    [1_000, 'Thousand'],
  ];
  const parts = [];
  let rest = n;
  for (const [value, name] of scales) {
    if (rest >= value) {
      parts.push(`${westernWords(Math.floor(rest / value))} ${name}`);
      rest %= value;
    }
  }
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

function indianWords(n) {
  if (n === 0) return 'Zero';
  const scales = [
    [10_000_000, 'Crore'],
    [100_000, 'Lakh'],
    [1_000, 'Thousand'],
  ];
  const parts = [];
  let rest = n;
  for (const [value, name] of scales) {
    if (rest >= value) {
      parts.push(`${indianWords(Math.floor(rest / value))} ${name}`);
      rest %= value;
    }
  }
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

/**
 * Spells out an amount the way the templates do:
 *   INR → "Rupees Ten Thousand Only"
 *   AED → "Twelve Thousand Nine Hundred Forty AED and Twenty Fils Only"
 */
export function amountInWords(value, code) {
  const { major, minor, style, grouping } = currencyInfo(code);
  const amount = round2(Math.abs(value ?? 0));
  const whole = Math.floor(amount);
  const fraction = Math.round((amount - whole) * 100);
  const toWords = grouping === 'indian' ? indianWords : westernWords;

  const wholeWords = toWords(whole);
  const fractionWords = fraction ? `${toWords(fraction)} ${minor}` : '';

  if (style === 'prefix') {
    return [major, wholeWords, fractionWords && `and ${fractionWords}`, 'Only'].filter(Boolean).join(' ');
  }
  return [wholeWords, major, fractionWords && `and ${fractionWords}`, 'Only'].filter(Boolean).join(' ');
}

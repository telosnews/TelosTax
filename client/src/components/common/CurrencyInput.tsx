import { useState, useRef, useEffect } from 'react';

interface CurrencyInputProps {
  value: number | undefined;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  /** Allow negative values (e.g., for gain/loss fields). Default false. */
  allowNegative?: boolean;
  /**
   * When true, onChange emits `undefined` instead of `0` when the field is
   * cleared. Use for truly optional dollar fields where "blank" and "$0"
   * have different meanings. Default false (emits 0 for backward compat).
   */
  optional?: boolean;
}

export default function CurrencyInput({
  value,
  onChange,
  placeholder = '0.00',
  className = '',
  disabled = false,
  id,
  allowNegative = false,
  optional = false,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(
    value !== undefined && value !== 0 ? value.toString() : '',
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);

  // Sync display value when external value changes (e.g., from store updates)
  // but only when the input is not focused (to avoid interrupting typing)
  useEffect(() => {
    if (isFocusedRef.current) return;
    if (value !== undefined && value !== 0) {
      setDisplayValue(value.toFixed(2));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pattern = allowNegative ? /[^0-9.\-]/g : /[^0-9.]/g;
    let raw = e.target.value.replace(pattern, '');

    // If negative allowed, ensure minus only appears at the start
    if (allowNegative && raw.includes('-')) {
      const hasLeadingMinus = raw.startsWith('-');
      raw = raw.replace(/-/g, '');
      if (hasLeadingMinus) raw = '-' + raw;
    }

    // Allow only one decimal point
    const parts = raw.split('.');
    const cleaned = parts.length > 2
      ? parts[0] + '.' + parts.slice(1).join('')
      : raw;

    setDisplayValue(cleaned);

    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      onChange(Math.round(num * 100) / 100);
    } else if (cleaned === '' || cleaned === '.' || cleaned === '-' || cleaned === '-.') {
      // For optional fields, emit undefined so the store can distinguish
      // "user left this blank" from "user typed $0.00".
      (onChange as (v: number | undefined) => void)(optional ? undefined : 0);
    }
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    if (value !== undefined && value !== 0) {
      setDisplayValue(value.toFixed(2));
    } else {
      setDisplayValue('');
    }
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
      <input
        id={id}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`input-field pl-7 ${className}`}
      />
    </div>
  );
}

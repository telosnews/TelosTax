import { useState, useRef, useEffect } from 'react';

interface EINInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Auto-formats employer identification numbers as XX-XXXXXXX.
 * Stores raw 9-digit string, displays formatted value.
 */
export default function EINInput({
  value,
  onChange,
  placeholder = 'XX-XXXXXXX',
  className = '',
  disabled = false,
  id,
}: EINInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);

  // Raw digits from value
  const digits = (value ?? '').replace(/\D/g, '').slice(0, 9);

  // Format: XX-XXXXXXX
  const format = (d: string): string => {
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}-${d.slice(2)}`;
  };

  const [displayValue, setDisplayValue] = useState(digits ? format(digits) : '');

  // Sync when external value changes (not during typing)
  useEffect(() => {
    if (isFocusedRef.current) return;
    setDisplayValue(digits ? format(digits) : '');
  }, [digits]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 9);
    setDisplayValue(format(raw));
    onChange(raw);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    setDisplayValue(digits ? format(digits) : '');
  };

  return (
    <input
      id={id}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={10}
      className={`input-field font-mono ${className}`}
      aria-label={id ? undefined : 'Employer Identification Number'}
    />
  );
}

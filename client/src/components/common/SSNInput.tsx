import { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { formatSSN, maskSSN, isValidSSN } from '@telostax/engine';

interface SSNInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  optional?: boolean;
}

/** Auto-hide timeout in milliseconds */
const AUTO_HIDE_MS = 10_000;

export default function SSNInput({ value, onChange, label, optional }: SSNInputProps) {
  const [visible, setVisible] = useState(false);
  const [touched, setTouched] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto-hide after 10 seconds
  useEffect(() => {
    if (visible) {
      clearTimer();
      timerRef.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    }
    return clearTimer;
  }, [visible, clearTimer]);

  const toggleVisibility = () => {
    const wasVisible = visible;
    setVisible((v) => !v);
    // Only refocus when revealing — refocusing on hide triggers onFocus → setVisible(true)
    if (!wasVisible) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip non-digits, cap at 9
    const raw = e.target.value.replace(/\D/g, '').slice(0, 9);
    onChange(raw);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  const digits = value.replace(/\D/g, '');
  const hasError = touched && digits.length > 0 && digits.length !== 9;

  // Display value: formatted when visible, masked when hidden
  const displayValue = (() => {
    if (!digits) return '';
    if (visible) return formatSSN(digits);
    if (digits.length === 9) return maskSSN(digits);
    // Partial input while hidden — show dots for entered chars
    return digits.replace(/./g, '•');
  })();

  return (
    <div>
      {label && (
        <div className="flex items-center gap-1.5 mb-1">
          <Lock className="w-3 h-3 text-slate-500" />
          <span className="text-sm text-slate-300 font-medium">
            {label}
            {optional && <span className="text-slate-500 font-normal ml-1">(optional)</span>}
          </span>
        </div>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type={visible ? 'text' : 'text'}
          inputMode="numeric"
          value={visible ? digits : displayValue}
          onChange={visible ? handleChange : (e) => {
            // When masked, user types raw digits
            const raw = e.target.value.replace(/\D/g, '').slice(0, 9);
            onChange(raw);
          }}
          onBlur={handleBlur}
          onFocus={() => {
            // Always show raw digits when editing — masked display breaks keystroke input
            if (!visible) setVisible(true);
          }}
          placeholder={visible ? '123-45-6789' : '•••-••-••••'}
          maxLength={visible ? 9 : 11}
          className={`input-field w-44 font-mono tracking-wide pr-9 ${
            hasError ? 'border-red-500 focus:border-red-500' : ''
          }`}
          aria-label={label || 'Social Security Number'}
        />
        <button
          type="button"
          onClick={toggleVisibility}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label={visible ? 'Hide SSN' : 'Show SSN'}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hasError && (
        <p className="text-xs text-red-400 mt-1">SSN must be exactly 9 digits</p>
      )}
    </div>
  );
}

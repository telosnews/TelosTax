interface ZIPInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Restricts input to digits and auto-formats as XXXXX or XXXXX-XXXX.
 */
export default function ZIPInput({
  value,
  onChange,
  placeholder = '94102',
  className = '',
  disabled = false,
  id,
}: ZIPInputProps) {
  const digits = (value ?? '').replace(/\D/g, '').slice(0, 9);

  const format = (d: string): string => {
    if (d.length <= 5) return d;
    return `${d.slice(0, 5)}-${d.slice(5)}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 9);
    onChange(raw);
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={format(digits)}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={10}
      className={`input-field ${className}`}
    />
  );
}

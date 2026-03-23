import { Check, X, HelpCircle } from 'lucide-react';

export interface PillOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

const DEFAULT_YES_NO_LATER: PillOption<'yes' | 'no' | 'later'>[] = [
  { value: 'yes', label: 'Yes', icon: <Check className="w-4 h-4" /> },
  { value: 'no', label: 'No', icon: <X className="w-4 h-4" /> },
  { value: 'later', label: 'Not sure', icon: <HelpCircle className="w-4 h-4" /> },
];

const DEFAULT_YES_NO: PillOption<'yes' | 'no'>[] = [
  { value: 'yes', label: 'Yes', icon: <Check className="w-4 h-4" /> },
  { value: 'no', label: 'No', icon: <X className="w-4 h-4" /> },
];

interface PillToggleProps<T extends string = string> {
  /** Current selected value. */
  value: T | undefined;
  /** Called when a pill is clicked. Receives undefined when deselecting. */
  onChange: (value: T | undefined) => void;
  /** Custom options. Defaults to Yes/No/Later. */
  options?: PillOption<T>[];
  /** Use the two-option Yes/No variant (no "Not sure"). */
  twoOption?: boolean;
  /** Optional size variant. */
  size?: 'sm' | 'md';
  /** Disable all pills. */
  disabled?: boolean;
}

function getSelectedStyle(value: string): string {
  switch (value) {
    case 'yes':
      return 'bg-telos-orange-600/20 text-telos-orange-300 border-telos-orange-500 shadow-sm shadow-telos-orange-500/10';
    case 'no':
      return 'bg-slate-700/80 text-slate-200 border-slate-500';
    case 'later':
      return 'bg-amber-600/20 text-amber-300 border-amber-500';
    default:
      return 'bg-telos-orange-600/20 text-telos-orange-300 border-telos-orange-500';
  }
}

const UNSELECTED_STYLE =
  'bg-surface-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-300';

export default function PillToggle<T extends string = string>({
  value,
  onChange,
  options,
  twoOption = false,
  size = 'md',
  disabled = false,
}: PillToggleProps<T>) {
  const items = options
    ?? (twoOption ? DEFAULT_YES_NO : DEFAULT_YES_NO_LATER) as unknown as PillOption<T>[];

  const sizeClasses = size === 'sm'
    ? 'px-4 py-1.5 text-sm gap-1.5'
    : 'px-5 py-2.5 text-sm gap-2';

  return (
    <div className="flex gap-2 flex-wrap" role="radiogroup">
      {items.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            onClick={() => !disabled && onChange(isSelected ? undefined : opt.value)}
            aria-checked={isSelected}
            disabled={disabled}
            className={`
              inline-flex items-center ${sizeClasses} rounded-full font-medium
              border transition-all duration-150
              ${disabled
                ? 'bg-surface-800 text-slate-600 border-slate-800 cursor-not-allowed'
                : isSelected ? getSelectedStyle(opt.value) : UNSELECTED_STYLE}
            `}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

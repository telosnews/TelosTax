import { Check } from 'lucide-react';
import { ReactNode } from 'react';

interface CardOption<T> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface CardSelectorProps<T> {
  options: CardOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
}

export default function CardSelector<T extends string | number>({
  options,
  value,
  onChange,
  columns = 1,
}: CardSelectorProps<T>) {
  const gridClass =
    columns === 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : columns === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1';

  return (
    <div className={`grid gap-3 ${gridClass}`}>
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isSelected}
            className={isSelected ? 'card-selected' : 'card-selectable'}
          >
            <div className="flex items-start gap-3">
              {option.icon && (
                <div className={`shrink-0 ${isSelected ? 'text-telos-orange-400' : 'text-slate-400'}`}>
                  {option.icon}
                </div>
              )}
              <div className="flex-1 text-left">
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${isSelected ? 'text-telos-orange-300' : 'text-slate-200'}`}>
                    {option.label}
                  </span>
                  {isSelected && <Check className="w-5 h-5 text-telos-orange-400 shrink-0" />}
                </div>
                {option.description && (
                  <p className="text-sm text-slate-400 mt-1">{option.description}</p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

import { useState } from 'react';
import { Megaphone, ChevronDown, ChevronUp } from 'lucide-react';

export interface WhatsNewItem {
  title: string;
  description: string;
  /** Bullet marker character. Defaults to '+'. Use '⚠' for warnings. */
  marker?: string;
}

interface WhatsNewCardProps {
  items: WhatsNewItem[];
}

export default function WhatsNewCard({ items }: WhatsNewCardProps) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="mt-4 mb-4 rounded-lg border border-slate-700 bg-surface-800 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-surface-700 transition-colors"
      >
        <Megaphone className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium text-amber-300">What changed for 2025</span>
        {open ? (
          <ChevronUp className="w-3 h-3 text-slate-400 ml-auto" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-400 ml-auto" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-3">
          <ul className="space-y-1.5 text-sm text-slate-400">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`mt-0.5 ${item.marker === '⚠' ? 'text-amber-400' : 'text-telos-orange-400'}`}>
                  {item.marker || '+'}
                </span>
                <span>
                  <strong className="text-slate-300">{item.title}</strong> — {item.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

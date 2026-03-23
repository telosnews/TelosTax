import { Plus } from 'lucide-react';

interface AddButtonProps {
  onClick: () => void;
  children: string;
}

/**
 * Prominent "add" button used on list-style steps (W-2s, 1099s, dependents, etc.).
 * Dashed border + centered layout makes it obvious this is the primary action.
 */
export default function AddButton({ onClick, children }: AddButtonProps) {
  return (
    <button
      onClick={onClick}
      className="mt-4 w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-slate-600 rounded-lg text-telos-blue-400 hover:text-telos-blue-300 hover:border-telos-blue-400/50 hover:bg-telos-blue-400/5 transition-all text-sm font-medium"
    >
      <Plus className="w-4 h-4" />
      {children}
    </button>
  );
}

import { ReactNode } from 'react';

interface SectionIntroProps {
  title: ReactNode;
  description: string;
  icon?: ReactNode;
  /** Optional transition message shown above the intro (e.g. "Great! Next we'll look at...") */
  transition?: string;
}

export default function SectionIntro({ title, description, icon, transition }: SectionIntroProps) {
  return (
    <div className="text-center py-8">
      {transition && (
        <div className="mb-6 text-sm text-slate-400 bg-surface-800 rounded-lg px-4 py-3 max-w-md mx-auto border border-slate-700">
          {transition}
        </div>
      )}
      {icon && (
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-telos-blue-600/20 text-telos-blue-400 mb-6">
          {icon}
        </div>
      )}
      <h1 className="text-3xl font-bold text-white mb-3">{title}</h1>
      <p className="text-slate-400 text-lg max-w-lg mx-auto">{description}</p>
    </div>
  );
}

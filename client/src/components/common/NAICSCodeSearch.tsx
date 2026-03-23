import { useState, useRef, useEffect, useCallback } from 'react';
import { NAICS_CODES, findNAICSByCode, type NAICSEntry } from '@telostax/engine';
import { Search, X, AlertTriangle } from 'lucide-react';

interface NAICSCodeSearchProps {
  value: string;
  onChange: (code: string, entry: NAICSEntry | undefined) => void;
  id?: string;
}

/**
 * Searchable NAICS code autocomplete for Schedule C Line B.
 * Searches by code number or description text. Displays SSTB badge when applicable.
 */
export default function NAICSCodeSearch({ value, onChange, id }: NAICSCodeSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<NAICSEntry[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Resolve the currently selected entry for display
  const selectedEntry = value ? findNAICSByCode(value) : undefined;

  // Search logic — filters NAICS_CODES by query
  const doSearch = useCallback((q: string) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      return;
    }
    const lower = q.toLowerCase().trim();
    const matches = NAICS_CODES.filter(
      (entry) =>
        entry.description.toLowerCase().includes(lower) ||
        entry.code.includes(lower),
    );
    // Cap at 50 to keep the dropdown manageable
    setResults(matches.slice(0, 50));
    setHighlightIndex(0);
  }, []);

  // Debounced search on query change
  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 150);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current || !isOpen) return;
    const items = listRef.current.querySelectorAll('[role="option"]');
    if (items[highlightIndex]) {
      items[highlightIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex, isOpen]);

  const selectEntry = (entry: NAICSEntry) => {
    onChange(entry.code, entry);
    setQuery('');
    setIsOpen(false);
  };

  const clearSelection = () => {
    onChange('', undefined);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'ArrowDown' && query.length >= 2) {
        setIsOpen(true);
        doSearch(query);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[highlightIndex]) {
          selectEntry(results[highlightIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // If a code is selected, show the selected state
  if (selectedEntry) {
    return (
      <div ref={containerRef} className="relative">
        <div className="input-field flex items-center justify-between gap-2 cursor-pointer" onClick={() => { clearSelection(); setTimeout(() => inputRef.current?.focus(), 50); }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-telos-blue-400 font-mono text-sm shrink-0">{selectedEntry.code}</span>
            <span className="text-white truncate">{selectedEntry.description}</span>
            {selectedEntry.isSSTB && (
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
                <AlertTriangle className="w-2.5 h-2.5" />
                SSTB
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); clearSelection(); }}
            className="shrink-0 p-1 text-slate-400 hover:text-slate-200 transition-colors"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="input-field pl-9"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search by code or description (e.g., 541511 or software)"
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-slate-600 bg-surface-900 shadow-xl"
        >
          {results.map((entry, idx) => (
            <li
              key={entry.code}
              role="option"
              aria-selected={idx === highlightIndex}
              className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-sm border-b border-slate-700/50 last:border-b-0 transition-colors ${
                idx === highlightIndex
                  ? 'bg-telos-blue-500/20 text-white'
                  : 'text-slate-300 hover:bg-slate-700/50'
              }`}
              onClick={() => selectEntry(entry)}
              onMouseEnter={() => setHighlightIndex(idx)}
            >
              <span className="font-mono text-xs text-telos-blue-400 shrink-0 w-14">{entry.code}</span>
              <span className="truncate">{entry.description}</span>
              {entry.isSSTB && (
                <span className="shrink-0 ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
                  SSTB
                </span>
              )}
            </li>
          ))}
          {results.length === 50 && (
            <li className="px-3 py-2 text-xs text-slate-500 text-center">
              Showing first 50 results — type more to narrow down
            </li>
          )}
        </ul>
      )}

      {/* No results */}
      {isOpen && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-600 bg-surface-900 shadow-xl px-3 py-3 text-sm text-slate-400">
          No matching business codes found. Try a different search term.
        </div>
      )}
    </div>
  );
}

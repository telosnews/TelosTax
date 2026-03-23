import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DeadlineEvent {
  label: string;
  date: string; // ISO "YYYY-MM-DD"
  status: 'overdue' | 'due_soon' | 'upcoming' | 'completed';
  amount?: number;
}

interface DeadlineCalendarProps {
  deadlines: DeadlineEvent[];
}

const STATUS_COLORS: Record<string, string> = {
  overdue:   '#EF4444',
  due_soon:  '#F59E0B',
  upcoming:  '#3B82F6',
  completed: '#10B981',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fmtDollars(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function DeadlineCalendar({ deadlines }: DeadlineCalendarProps) {
  // Group deadlines by date
  const byDate = useMemo(() => {
    const map = new Map<string, DeadlineEvent[]>();
    for (const d of deadlines) {
      const existing = map.get(d.date) || [];
      existing.push(d);
      map.set(d.date, existing);
    }
    return map;
  }, [deadlines]);

  // Find the first deadline month for initial view
  const sorted = useMemo(
    () => [...deadlines].sort((a, b) => a.date.localeCompare(b.date)),
    [deadlines],
  );
  const firstDate = sorted[0]?.date;
  const initYear = firstDate ? parseInt(firstDate.slice(0, 4)) : new Date().getFullYear();
  const initMonth = firstDate ? parseInt(firstDate.slice(5, 7)) - 1 : new Date().getMonth();

  const [viewYear, setViewYear] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    return toKey(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  // Build calendar grid for current month
  const grid = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{ day: number; key: string; isCurrentMonth: boolean }> = [];

    // Previous month filler
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const pm = viewMonth === 0 ? 11 : viewMonth - 1;
      const py = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({ day: d, key: toKey(py, pm, d), isCurrentMonth: false });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, key: toKey(viewYear, viewMonth, d), isCurrentMonth: true });
    }

    // Next month filler (fill to 6 rows = 42 cells, or 5 rows = 35 cells)
    const totalRows = cells.length > 35 ? 42 : 35;
    const remaining = totalRows - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nm = viewMonth === 11 ? 0 : viewMonth + 1;
      const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
      cells.push({ day: d, key: toKey(ny, nm, d), isCurrentMonth: false });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  // Tooltip for hovered day
  const hoveredDeadlines = hoveredDay ? byDate.get(hoveredDay) : null;

  return (
    <div className="rounded-lg bg-surface-900/60 border border-slate-700/50 p-4 mb-3 relative">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h4 className="text-sm font-semibold text-slate-200">
          {MONTHS[viewMonth]} {viewYear}
        </h4>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {grid.map((cell, i) => {
          const events = byDate.get(cell.key);
          const isToday = cell.key === today;
          const hasEvents = !!events && events.length > 0;

          return (
            <div
              key={i}
              className={`relative flex flex-col items-center py-1.5 min-h-[40px] border-t border-slate-700/30 transition-colors ${
                cell.isCurrentMonth ? '' : 'opacity-30'
              } ${hasEvents ? 'cursor-pointer hover:bg-slate-700/30 rounded' : ''}`}
              onMouseEnter={() => hasEvents ? setHoveredDay(cell.key) : setHoveredDay(null)}
              onMouseLeave={() => setHoveredDay(null)}
            >
              {/* Day number */}
              <span
                className={`text-xs leading-none ${
                  isToday
                    ? 'bg-telos-blue-500 text-white w-5 h-5 rounded-full flex items-center justify-center font-bold'
                    : cell.isCurrentMonth
                      ? 'text-slate-300'
                      : 'text-slate-600'
                }`}
              >
                {cell.day}
              </span>

              {/* Event dots */}
              {hasEvents && (
                <div className="flex gap-0.5 mt-1">
                  {events.slice(0, 3).map((ev, j) => (
                    <div
                      key={j}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[ev.status] }}
                    />
                  ))}
                  {events.length > 3 && (
                    <span className="text-[8px] text-slate-500 leading-none ml-0.5">+{events.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hover tooltip */}
      {hoveredDeadlines && hoveredDay && (
        <div className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 shadow-xl max-w-[260px] pointer-events-none">
          {hoveredDeadlines.map((ev, i) => (
            <div key={i} className={i > 0 ? 'mt-1.5 pt-1.5 border-t border-slate-700/50' : ''}>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[ev.status] }} />
                <span className="text-xs font-medium text-slate-200 truncate">{ev.label}</span>
              </div>
              {ev.amount != null && ev.amount > 0 && (
                <span className="text-xs font-semibold text-white ml-3.5">{fmtDollars(ev.amount)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

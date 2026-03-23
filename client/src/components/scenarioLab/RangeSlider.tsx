import { useCallback, useState, useEffect, useRef } from 'react';
import { formatCurrency } from '../../utils/format';

interface RangeSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  format?: 'currency' | 'percent' | 'number';
  onChange: (value: number) => void;
  label?: string;
}

export default function RangeSlider({ value, min, max, step, format = 'currency', onChange, label }: RangeSliderProps) {
  // Local state for the number input — allows typing freely, clamp only on blur
  const [localInput, setLocalInput] = useState(String(value));
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalInput(String(value));
  }, [value]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalInput(e.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    const parsed = Number(localInput);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      const snapped = min + Math.round((clamped - min) / step) * step;
      onChange(Math.min(max, Math.max(min, snapped)));
    } else {
      setLocalInput(String(value));
    }
  }, [localInput, onChange, min, max, step, value]);

  const formatLabel = (v: number) => {
    if (format === 'currency') return formatCurrency(v);
    if (format === 'percent') return `${(v * 100).toFixed(1)}%`;
    return v.toLocaleString();
  };

  // Snap a raw value to the nearest step
  const snap = useCallback((raw: number) => {
    const clamped = Math.min(max, Math.max(min, raw));
    const snapped = min + Math.round((clamped - min) / step) * step;
    return Math.min(max, Math.max(min, snapped));
  }, [min, max, step]);

  // Convert a pointer clientX to a value
  const clientXToValue = useCallback((clientX: number) => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return snap(min + pct * (max - min));
  }, [min, max, snap, value]);

  // Pointer events for drag
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    onChange(clientXToValue(e.clientX));
  }, [onChange, clientXToValue]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    onChange(clientXToValue(e.clientX));
  }, [dragging, onChange, clientXToValue]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Keyboard support on the track
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    let next = value;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = snap(value + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = snap(value - step);
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else return;
    e.preventDefault();
    onChange(next);
  }, [value, step, min, max, snap, onChange]);

  const pct = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 min-w-0">
        {/* Custom slider track */}
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
          className="relative h-6 flex items-center cursor-pointer select-none touch-none focus:outline-none group"
        >
          {/* Track background */}
          <div className="absolute inset-x-0 h-2 rounded-full bg-slate-700" />
          {/* Filled portion */}
          <div
            className="absolute left-0 h-2 rounded-full bg-telos-orange-500"
            style={{ width: `${pct}%` }}
          />
          {/* Thumb */}
          <div
            className={`absolute w-5 h-5 rounded-full bg-telos-orange-500 border-[3px] border-surface-900 shadow-lg transition-transform ${
              dragging ? 'scale-110' : 'group-hover:scale-110'
            } group-focus-visible:ring-2 group-focus-visible:ring-telos-orange-500/40`}
            style={{
              left: `calc(${pct}% - 10px)`,
              boxShadow: '0 0 0 2px rgba(var(--color-telos-orange-500), 0.3), 0 2px 6px rgba(0,0,0,0.4)',
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
          <span>{formatLabel(min)}</span>
          <span>{formatLabel(max)}</span>
        </div>
      </div>
      <input
        type="number"
        value={localInput}
        onChange={handleInput}
        onBlur={handleBlur}
        min={min}
        max={max}
        step={step}
        className="w-28 bg-surface-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white tabular-nums text-right focus:outline-none focus:border-telos-orange-500 focus:ring-1 focus:ring-telos-orange-500/30"
        aria-label={label ? `${label} input` : undefined}
      />
    </div>
  );
}

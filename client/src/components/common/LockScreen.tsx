/**
 * Lock Screen — gates access to the app behind a passphrase.
 *
 * Two modes:
 * 1. Setup: First time — user creates a passphrase (with confirmation)
 * 2. Unlock: Subsequent visits — user enters passphrase to decrypt data
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { Lock, Eye, EyeOff, Shield } from 'lucide-react';

// ── Password strength helper ─────────────────────────────────────

interface StrengthResult {
  score: number; // 0-4
  label: string;
  color: string;
  bgColor: string;
}

function getPasswordStrength(pw: string): StrengthResult {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  score = Math.min(score, 4);

  const map: Record<number, Omit<StrengthResult, 'score'>> = {
    0: { label: 'Too short', color: 'text-red-400', bgColor: 'bg-red-500' },
    1: { label: 'Weak', color: 'text-red-400', bgColor: 'bg-red-500' },
    2: { label: 'Fair', color: 'text-amber-400', bgColor: 'bg-amber-500' },
    3: { label: 'Good', color: 'text-telos-blue-400', bgColor: 'bg-telos-blue-500' },
    4: { label: 'Strong', color: 'text-emerald-400', bgColor: 'bg-emerald-500' },
  };

  return { score, ...map[score] };
}

interface LockScreenProps {
  mode: 'setup' | 'unlock';
  onUnlock: (passphrase: string) => Promise<boolean>;
  error?: string | null;
  /** When true, renders just the form (no full-page wrapper, no logo). Used inline on Dashboard. */
  inline?: boolean;
}

export default function LockScreen({ mode, onUnlock, error: externalError, inline }: LockScreenProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(externalError ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Brute-force protection: exponential backoff after 3 failed attempts.
  // Persisted in sessionStorage so refreshing the page doesn't reset the counter.
  const [failCount, setFailCount] = useState(() => {
    const stored = sessionStorage.getItem('telostax:lock-fails');
    return stored ? parseInt(stored, 10) || 0 : 0;
  });
  const [lockedUntil, setLockedUntil] = useState(() => {
    const stored = sessionStorage.getItem('telostax:lock-until');
    const val = stored ? parseInt(stored, 10) || 0 : 0;
    return val > Date.now() ? val : 0;
  });
  const [backoffRemaining, setBackoffRemaining] = useState(0);

  // Sync to sessionStorage when values change
  useEffect(() => {
    sessionStorage.setItem('telostax:lock-fails', String(failCount));
  }, [failCount]);
  useEffect(() => {
    if (lockedUntil > 0) {
      sessionStorage.setItem('telostax:lock-until', String(lockedUntil));
    } else {
      sessionStorage.removeItem('telostax:lock-until');
    }
  }, [lockedUntil]);

  const strength = useMemo(() => getPasswordStrength(passphrase), [passphrase]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setError(externalError ?? null); }, [externalError]);

  // Countdown timer for backoff
  useEffect(() => {
    if (lockedUntil <= Date.now()) {
      setBackoffRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setBackoffRemaining(0);
        setLockedUntil(0);
      } else {
        setBackoffRemaining(remaining);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const isBackedOff = backoffRemaining > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isBackedOff) return;

    if (mode === 'setup') {
      if (passphrase.length < 8) {
        setError('Passphrase must be at least 8 characters');
        return;
      }
      if (passphrase !== confirm) {
        setError('Passphrases do not match');
        return;
      }
    }

    setLoading(true);
    try {
      const success = await onUnlock(passphrase);
      if (!success) {
        const newCount = failCount + 1;
        setFailCount(newCount);

        if (newCount >= 3) {
          // Exponential backoff: 5s, 10s, 20s, 40s... max 5 min
          const backoffMs = Math.min(5000 * Math.pow(2, newCount - 3), 300_000);
          const until = Date.now() + backoffMs;
          setLockedUntil(until);
          setError(`Too many failed attempts. Please wait ${Math.ceil(backoffMs / 1000)} seconds.`);
        } else {
          setError('Incorrect passphrase');
        }

        setPassphrase('');
        inputRef.current?.focus();
      } else {
        setFailCount(0);
        setLockedUntil(0);
        sessionStorage.removeItem('telostax:lock-fails');
        sessionStorage.removeItem('telostax:lock-until');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <div className="rounded-xl border border-slate-700 bg-surface-800/50 p-6">
      {/* Icon + heading */}
      <div className="flex justify-center mb-3">
        <div className="w-12 h-12 rounded-full bg-surface-700 border border-slate-600 flex items-center justify-center">
          {mode === 'setup'
            ? <Shield className="w-5 h-5 text-telos-blue-400" />
            : <Lock className="w-5 h-5 text-slate-400" />
          }
        </div>
      </div>

      <h2 className="text-lg font-semibold text-white text-center mb-2">
        {mode === 'setup' ? 'Create Your Passphrase' : 'Welcome Back'}
      </h2>

      {mode === 'setup' && (
        <p className="text-xs text-slate-400 text-center mb-5 leading-relaxed">
          Your tax data is encrypted on this device. Create a passphrase to get started.
          If you forget it, your data cannot be recovered.
        </p>
      )}
      {mode === 'unlock' && (
        <p className="text-xs text-slate-500 text-center mb-5">
          Enter your passphrase to unlock your encrypted tax data.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="passphrase" className="block text-xs font-medium text-slate-400 mb-1.5">
            {mode === 'setup' ? 'Create passphrase' : 'Passphrase'}
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              id="passphrase"
              type={showPassword ? 'text' : 'password'}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-900 border border-slate-600 rounded-lg text-white text-sm focus:border-telos-blue-500 focus:ring-1 focus:ring-telos-blue-500 focus:outline-none pr-10"
              placeholder={mode === 'setup' ? 'At least 8 characters' : 'Enter passphrase'}
              autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-300"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide passphrase' : 'Show passphrase'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {/* Strength meter — setup mode only */}
          {mode === 'setup' && passphrase.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1" role="meter" aria-valuenow={strength.score} aria-valuemin={0} aria-valuemax={4} aria-label={`Password strength: ${strength.label}`}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                      i < strength.score ? strength.bgColor : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
              <p className={`text-xs ${strength.color}`}>{strength.label}</p>
            </div>
          )}
        </div>

        {mode === 'setup' && (
          <div>
            <label htmlFor="confirm" className="block text-xs font-medium text-slate-400 mb-1.5">
              Confirm passphrase
            </label>
            <input
              id="confirm"
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-900 border border-slate-600 rounded-lg text-white text-sm focus:border-telos-blue-500 focus:ring-1 focus:ring-telos-blue-500 focus:outline-none"
              placeholder="Re-enter passphrase"
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 text-center" role="alert">{error}</p>
        )}

        <button
          type="submit"
          className="btn-primary w-full flex items-center justify-center gap-2"
          disabled={loading || !passphrase || isBackedOff}
        >
          {loading ? (
            <span className="animate-pulse">Unlocking...</span>
          ) : isBackedOff ? (
            <span>Try again in {backoffRemaining}s</span>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              {mode === 'setup' ? 'Set Up Encryption' : 'Unlock'}
            </>
          )}
        </button>
      </form>
    </div>
  );

  // Inline mode: just the form card, no full-page wrapper
  if (inline) {
    return (
      <div className="max-w-sm mx-auto">
        {formContent}
      </div>
    );
  }

  // Full-page mode (fallback, used if navigated directly while locked)
  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold">
            <span className="text-telos-orange-400">Telos</span>
            <span className="text-telos-blue-400">Tax</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Free, private, open-source tax prep.</p>
        </div>
        {formContent}
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Shield, Eye, EyeOff, Lock, Loader2, ChevronLeft } from 'lucide-react';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { setupEncryption } from '../../services/crypto';
import { loadAllReturns } from '../../api/client';
import SectionIntro from '../common/SectionIntro';

export default function EncryptionSetupStep() {
  const { currentStepIndex, goNext, goPrev } = useTaxReturnStore();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }
    if (passphrase !== confirm) {
      setError('Passphrases do not match');
      return;
    }

    setLoading(true);
    try {
      await setupEncryption(passphrase);
      await loadAllReturns(); // retroactively encrypts any plaintext data already saved
      goNext();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isFirst = currentStepIndex === 0;

  return (
    <div>
      <SectionIntro
        icon={<Shield className="w-8 h-8" />}
        title="Protect Your Data"
        description="Create a passphrase to encrypt your tax data. This protects your SSN, income, and personal information with AES-256 encryption."
      />

      <form onSubmit={handleSubmit} className="space-y-4 mt-6 max-w-md">
        <div>
          <label htmlFor="passphrase" className="block text-xs font-medium text-slate-400 mb-1.5">
            Create passphrase
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              id="passphrase"
              type={showPassword ? 'text' : 'password'}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-800 border border-slate-600 rounded-lg text-white text-sm focus:border-telos-blue-500 focus:ring-1 focus:ring-telos-blue-500 focus:outline-none pr-10"
              placeholder="At least 8 characters"
              autoComplete="new-password"
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
        </div>

        <div>
          <label htmlFor="confirm" className="block text-xs font-medium text-slate-400 mb-1.5">
            Confirm passphrase
          </label>
          <input
            id="confirm"
            type={showPassword ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface-800 border border-slate-600 rounded-lg text-white text-sm focus:border-telos-blue-500 focus:ring-1 focus:ring-telos-blue-500 focus:outline-none"
            placeholder="Re-enter passphrase"
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        {error && (
          <p className="text-sm text-red-400" role="alert">{error}</p>
        )}

        <p className="text-xs text-slate-500 leading-relaxed">
          Your passphrase encrypts all tax data on this device using AES-256. If you forget it, your data cannot be recovered.
        </p>

        <div className="flex items-center justify-between gap-3 pt-6 pb-6 sm:pb-0 sticky bottom-0 bg-surface-900 sm:static sm:bg-transparent z-10 border-t border-slate-700 sm:border-none mt-auto">
          {!isFirst ? (
            <button
              type="button"
              onClick={goPrev}
              disabled={loading}
              className={`btn-secondary flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          <button
            type="submit"
            disabled={loading || !passphrase}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Encrypting...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Set Up Encryption
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

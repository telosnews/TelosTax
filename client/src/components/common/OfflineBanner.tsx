import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <>
      {/* Spacer pushes page content down so the fixed banner doesn't overlap it */}
      <div className="h-9" aria-hidden="true" />
      <div role="alert" className="fixed top-0 inset-x-0 z-50 bg-amber-600 text-white text-center text-sm py-1.5 px-4 flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4" />
        You're offline — your data is saved locally and everything still works.
      </div>
    </>
  );
}

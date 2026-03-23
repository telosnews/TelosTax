/**
 * Forms Mode — Merged PDF Viewer (read-only)
 *
 * Displays a pre-generated merged PDF in the Syncfusion PDF viewer.
 * Used when multiple forms are selected in the sidebar. No form-field
 * editing — just navigation and magnification.
 *
 * Syncfusion's `documentPath` accepts Uint8Array directly (line 41614
 * of the es2015 bundle checks `instanceof Uint8Array`). This routes
 * through `initiatePageRender` → Uint8Array branch (line 41764) which
 * processes via WASM without any fetch() call, bypassing CSP issues.
 *
 * Uses the same deferred-init pattern as PdfFormViewer to survive StrictMode.
 */
import { useRef, useEffect, useState } from 'react';
import { PdfViewer, Toolbar, Magnification, Navigation, Print, TextSearch, ThumbnailView } from '@syncfusion/ej2-pdfviewer';

PdfViewer.Inject(Toolbar, Magnification, Navigation, Print, TextSearch, ThumbnailView);

const RESOURCE_URL = `${window.location.origin}/ej2-pdfviewer-lib`;

interface MergedPdfViewerProps {
  pdfBytes: Uint8Array;
}

export default function MergedPdfViewer({ pdfBytes }: MergedPdfViewerProps) {
  const viewerRef = useRef<PdfViewer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    const frameId = requestAnimationFrame(() => {
      if (cancelled) return;
      const el = containerRef.current;
      if (!el) return;

      const viewer = new PdfViewer({
        resourceUrl: RESOURCE_URL,
        // Syncfusion accepts Uint8Array here (line 41614 checks instanceof Uint8Array).
        // This routes through the direct WASM processing path, no fetch() needed.
        documentPath: pdfBytes as never,
        enableFormFields: false,
        enableFormDesigner: false,
        enableAnnotation: false,
        enableThumbnail: true,
        enableBookmark: false,
        enablePageOrganizer: false,
        toolbarSettings: {
          showTooltip: true,
          toolbarItems: ['PageNavigationTool', 'MagnificationTool', 'SearchOption', 'PrintTool', 'DownloadTool'] as never,
        },
        downloadFileName: 'TelosTax_Selected_Forms.pdf',
        height: '100%',
        width: '100%',
        documentLoad: () => setStatus('ready'),
        documentLoadFailed: () => setStatus('error'),
      });

      viewer.appendTo(el);
      viewerRef.current = viewer;
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      if (viewerRef.current) {
        try { viewerRef.current.destroy(); } catch { /* ignore */ }
        viewerRef.current = null;
      }
    };
  }, [pdfBytes]);

  return (
    <div ref={containerRef} className="flex-1 min-w-0 min-h-0 relative">
      {status === 'loading' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface-800 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-telos-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Loading selected forms...</p>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface-800">
          <div className="text-center max-w-md px-6">
            <p className="text-red-400 font-medium mb-2">Failed to load merged PDF</p>
            <p className="text-sm text-slate-400">Try deselecting some forms and re-selecting.</p>
          </div>
        </div>
      )}
    </div>
  );
}

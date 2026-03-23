import type { OCRStage } from '../../services/ocrService';

interface OCRProgressBarProps {
  stage: OCRStage;
  progress: number;      // 0-100
  pageNumber?: number;
  totalPages?: number;
}

function getStageLabel(
  stage: OCRStage,
  pageNumber?: number,
  totalPages?: number,
): string {
  switch (stage) {
    case 'loading':
      return 'Loading OCR engine\u2026';
    case 'recognizing':
      if (pageNumber && totalPages && totalPages > 1) {
        return `Scanning page ${pageNumber} of ${totalPages}\u2026`;
      }
      return 'Scanning document\u2026';
    case 'complete':
      return 'Extracting text\u2026';
  }
}

export default function OCRProgressBar({
  stage,
  progress,
  pageNumber,
  totalPages,
}: OCRProgressBarProps) {
  const label = getStageLabel(stage, pageNumber, totalPages);
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-amber-300 font-medium">{label}</span>
        <span className="text-slate-400 tabular-nums">{Math.round(clampedProgress)}%</span>
      </div>
      <div className="w-full h-2 bg-surface-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      <p className="text-xs text-amber-300/70">
        OCR accuracy on tax forms is typically 60-70%, but can be enhanced with AI. Please verify every value.
      </p>
    </div>
  );
}

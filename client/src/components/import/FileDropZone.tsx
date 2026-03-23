import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { FileInput, X, FileText, FileSpreadsheet, Image, Camera } from 'lucide-react';

interface FileDropZoneProps {
  accept: string;           // ".csv" or ".pdf,.jpg,.jpeg,.png,.tiff"
  onFile: (file: File) => void;
  label: string;
  sublabel?: string;
  disabled?: boolean;
  maxSizeMB?: number;
  /** Show a "Take a photo" button that opens the native camera. Default false. */
  enableCamera?: boolean;
  /** Allow multiple files to be dropped/selected at once. Default false. */
  multiple?: boolean;
}

export default function FileDropZone({
  accept,
  onFile,
  label,
  sublabel,
  disabled = false,
  maxSizeMB = 10,
  enableCamera = false,
  multiple = false,
}: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const acceptedExts = accept.split(',').map(a => a.trim().toLowerCase());
  const isPDF = acceptedExts.includes('.pdf');
  const isImage = acceptedExts.some(a => ['.jpg', '.jpeg', '.png', '.tiff', '.heic', '.heif'].includes(a));
  const Icon = isPDF ? FileText : isImage ? Image : FileSpreadsheet;

  // Only show camera button on touch-primary devices (phones/tablets) where
  // capture="environment" actually opens the camera app. On desktop browsers,
  // it just opens a file picker — same as "Browse files".
  const isTouchDevice = typeof window !== 'undefined'
    && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const showCamera = enableCamera && isTouchDevice;

  const validateAndEmit = (file: File) => {
    setError(null);

    // Check file extension (supports comma-separated accept strings)
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedExts.includes(ext)) {
      const labels = acceptedExts.map(a => a.toUpperCase().replace('.', '')).join(', ');
      setError(`Please select a ${labels} file`);
      return;
    }

    // Check file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File is too large (max ${maxSizeMB}MB)`);
      return;
    }

    if (!multiple) setSelectedFile(file);
    onFile(file);
  };

  /** Camera files bypass extension validation (camera always produces JPEG/HEIC)
   *  but still check MIME type and file size. */
  const validateCameraFile = (file: File) => {
    setError(null);

    // MIME-based validation: accept any image type from camera.
    // Also check extension as fallback — some platforms send empty MIME type.
    const hasImageMime = file.type.startsWith('image/');
    const hasImageExt = /\.(jpg|jpeg|png|tiff?|heic|heif)$/i.test(file.name);
    if (!hasImageMime && !hasImageExt) {
      setError('Camera produced a non-image file. Please try again.');
      return;
    }

    // Check file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File is too large (max ${maxSizeMB}MB)`);
      return;
    }

    setSelectedFile(file);
    onFile(file);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;

    if (multiple) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) validateAndEmit(file);
    } else {
      const file = e.dataTransfer.files[0];
      if (file) validateAndEmit(file);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (multiple) {
      const files = Array.from(e.target.files || []);
      for (const file of files) validateAndEmit(file);
    } else {
      const file = e.target.files?.[0];
      if (file) validateAndEmit(file);
    }
  };

  const handleCameraChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateCameraFile(file);
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  if (selectedFile) {
    return (
      <div className="border border-slate-600 bg-surface-800 rounded-xl p-4 flex items-center gap-3">
        <Icon className="w-6 h-6 text-telos-blue-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200 font-medium truncate">{selectedFile.name}</p>
          <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
        </div>
        <button
          onClick={handleRemove}
          className="text-slate-400 hover:text-red-400 transition-colors p-1"
          aria-label="Remove file"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${dragging
            ? 'border-telos-blue-400 bg-telos-blue-500/10'
            : 'border-slate-600 hover:border-slate-500 bg-surface-800/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <FileInput className={`w-8 h-8 mx-auto mb-3 ${dragging ? 'text-telos-blue-400' : 'text-slate-400'}`} />
        <p className="text-sm text-slate-300 font-medium">{label}</p>
        {sublabel && <p className="text-xs text-slate-400 mt-1">{sublabel}</p>}
        <button
          type="button"
          className="mt-3 text-xs font-medium text-telos-blue-400 hover:text-telos-blue-300 transition-colors"
          tabIndex={-1}
        >
          Browse files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
          multiple={multiple}
        />
      </div>

      {/* Camera capture button — only on mobile where capture="environment" opens the camera */}
      {showCamera && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) cameraInputRef.current?.click();
            }}
            disabled={disabled}
            className={`
              inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium
              border border-dashed border-amber-500/40 rounded-lg
              bg-amber-500/5 hover:bg-amber-500/10
              hover:border-amber-400/60
              text-amber-400 hover:text-amber-300
              transition-all
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <Camera className="w-4 h-4" />
            Take a photo
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCameraChange}
            className="hidden"
            disabled={disabled}
          />
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

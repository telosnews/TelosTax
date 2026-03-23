/**
 * Chat Input — unified input box with textarea, model picker, mic, and send.
 *
 * Single rounded container inspired by Claude / ChatGPT / Gemini:
 * - Top: auto-growing textarea
 * - Bottom toolbar: model picker (left), char count + mic + send (right)
 *
 * Enter to send, Shift+Enter for newline. 2 000-char limit.
 * Mic button uses the Web Speech API for hands-free dictation.
 */

import { ArrowUp, Square, Mic, MicOff, Plus, Upload } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import ModelPicker from './ModelPicker';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.tiff,.heic,.heif';
const ACCEPTED_MIMES = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/tiff', 'image/heic', 'image/heif',
]);

interface Props {
  onSend: (text: string) => void;
  onAttachFile?: (file: File) => void;
  disabled: boolean;
  /** Whether a message is currently in-flight (shows stop button). */
  isLoading?: boolean;
  /** Called when the user clicks the stop button to abort the in-flight request. */
  onStop?: () => void;
}

const MAX_CHARS = 4000;

/** Check if Web Speech API is available in this browser. */
const hasSpeechRecognition =
  typeof window !== 'undefined' &&
  !!(window.SpeechRecognition || window.webkitSpeechRecognition);

export default function ChatInput({ onSend, onAttachFile, disabled, isLoading, onStop }: Props) {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  /** Track the text that existed before this dictation session started. */
  const preVoiceTextRef = useRef('');
  /** Safari workaround: timeout to finalize results when isFinal never fires. */
  const safariTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  // Focus textarea when enabled
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  // Stop listening when disabled (e.g., message sending)
  useEffect(() => {
    if (disabled && isListening) {
      recognitionRef.current?.stop();
    }
  }, [disabled, isListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (safariTimeoutRef.current) clearTimeout(safariTimeoutRef.current);
    };
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    if (safariTimeoutRef.current) {
      clearTimeout(safariTimeoutRef.current);
      safariTimeoutRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    if (!hasSpeechRecognition || disabled) return;

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Capture what's in the textarea before dictation starts
    preVoiceTextRef.current = text;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Clear Safari timeout on each result
      if (safariTimeoutRef.current) {
        clearTimeout(safariTimeoutRef.current);
        safariTimeoutRef.current = null;
      }

      let interim = '';
      let final = '';

      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      const prefix = preVoiceTextRef.current;
      const separator = prefix && !prefix.endsWith(' ') ? ' ' : '';
      const combined = final + interim;

      setText(prefix + separator + combined);

      // Safari workaround: if we have interim results, set a timeout to
      // treat them as final (Safari sometimes never fires isFinal: true)
      if (interim && !final) {
        safariTimeoutRef.current = setTimeout(() => {
          preVoiceTextRef.current = prefix + separator + combined;
        }, 2000);
      }

      // Update preVoiceText when final results are confirmed
      if (final) {
        preVoiceTextRef.current = prefix + separator + final;
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are normal — user just didn't say anything
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition error:', event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (safariTimeoutRef.current) {
        clearTimeout(safariTimeoutRef.current);
        safariTimeoutRef.current = null;
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [disabled, text]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    if (isListening) stopListening();
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /** Validate and forward a file to the attachment handler. */
  const processFile = useCallback((file: File) => {
    if (!onAttachFile) return;
    // Check MIME type (fall back to extension for .heic which may lack a MIME)
    const hasValidMime = ACCEPTED_MIMES.has(file.type);
    const hasValidExt = /\.(pdf|jpe?g|png|tiff?|heic|heif)$/i.test(file.name);
    if (!hasValidMime && !hasValidExt) {
      alert('Unsupported file type. Please attach a PDF or image (JPG, PNG, HEIC).');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 25 MB.`);
      return;
    }
    onAttachFile(file);
  }, [onAttachFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    processFile(file);
  }, [processFile]);

  // ── Drag & drop handlers ──
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    if (disabled || !onAttachFile) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [disabled, onAttachFile, processFile]);

  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canSend = text.trim().length > 0 && !disabled && !isOverLimit;

  return (
    <div className="px-3 pb-3 pt-1">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileSelect}
        className="hidden"
        tabIndex={-1}
      />

      {/* Unified input container */}
      <div
        className={`relative rounded-2xl bg-surface-900 border transition-colors ${
          isDragOver
            ? 'border-telos-blue-500 bg-telos-blue-500/5'
            : 'border-slate-600/50 focus-within:border-slate-500'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drop overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-10 rounded-2xl flex items-center justify-center
                          bg-telos-blue-500/10 border-2 border-dashed border-telos-blue-500/40 pointer-events-none">
            <div className="flex items-center gap-2 text-telos-blue-400 text-sm font-medium">
              <Upload className="w-4 h-4" />
              Drop tax document here
            </div>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening...' : 'Ask about your taxes or enter data...'}
          disabled={disabled}
          rows={1}
          className="w-full bg-transparent px-4 pt-3 pb-1 text-sm text-white
                     placeholder-slate-500 resize-none focus:outline-none
                     disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: '36px', maxHeight: '120px' }}
        />

        {/* Toolbar row */}
        <div className="flex items-center gap-1 px-2 pb-2">
          {/* Attach file button */}
          {onAttachFile && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full
                         border border-slate-600/50 text-slate-400 hover:text-white hover:bg-surface-700
                         hover:border-slate-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Attach a tax document"
              title="Attach a tax document (PDF or photo)"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {/* Model picker */}
          <ModelPicker />

          <div className="flex-1" />

          {/* Character count */}
          {charCount > 0 && (
            <span
              className={`text-[10px] mr-1 ${
                isOverLimit ? 'text-red-400' : 'text-slate-500'
              }`}
            >
              {charCount}/{MAX_CHARS}
            </span>
          )}

          {/* Mic button */}
          {hasSpeechRecognition && (
            <button
              onClick={toggleListening}
              disabled={disabled}
              className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full
                         transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                         ${isListening
                           ? 'bg-red-600 hover:bg-red-500 text-white voice-pulse'
                           : 'text-slate-400 hover:text-white hover:bg-surface-700'
                         }`}
              aria-label={isListening ? 'Stop listening' : 'Start voice input'}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {/* Send / Stop button — circular */}
          {isLoading && onStop ? (
            <button
              onClick={onStop}
              className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full
                         bg-slate-200 hover:bg-white text-surface-900 transition-all duration-150"
              aria-label="Stop response"
              title="Stop response (Esc)"
            >
              <Square className="w-3.5 h-3.5" fill="currentColor" strokeWidth={0} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full
                         transition-all duration-150
                         ${canSend
                           ? 'bg-slate-200 hover:bg-white text-surface-900'
                           : 'bg-surface-700 text-slate-500 cursor-not-allowed'
                         }`}
              aria-label="Send message"
            >
              <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* Pulse animation for active mic */}
      {isListening && (
        <style>{`
          @keyframes voicePulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
            50% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
          }
          .voice-pulse { animation: voicePulse 1.5s ease-in-out infinite; }
        `}</style>
      )}
    </div>
  );
}

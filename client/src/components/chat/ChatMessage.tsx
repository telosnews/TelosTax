/**
 * Chat Message Bubble — renders a single user or assistant message.
 *
 * User messages: right-aligned, blue-tinted background, plain text.
 * Assistant messages: left-aligned, surface-700 background, markdown rendered.
 *
 * Assistant messages also show an action bar with:
 * - Thumbs up / down feedback (always visible)
 * - Copy to clipboard (hover-reveal)
 * - Regenerate (only on last assistant message, hidden if actions were applied)
 */

import { useState, useRef, useEffect } from 'react';
import { Copy, Check, RotateCcw, RefreshCw, Pencil, ThumbsUp, ThumbsDown, Volume2, VolumeX, FileText, Loader2 } from 'lucide-react';
import type { ChatMessageUI } from '../../store/chatStore';
import ActionPreview from './ActionPreview';
import MarkdownMessage from './MarkdownMessage';
import { injectStepLinks } from '../../services/stepLinkInjector';

interface Props {
  message: ChatMessageUI;
  isLastAssistant?: boolean;
  onActionsApplied: (messageId: string, summary: string) => void;
  onActionsDismissed: (messageId: string) => void;
  onFeedback: (messageId: string, feedback: 'up' | 'down') => void;
  onRegenerate: () => void;
  onFollowUp: (text: string) => void;
  onEditAndResend: (messageId: string, newText: string) => void;
  onRetry: (messageId: string) => void;
}

export default function ChatMessage({
  message,
  isLastAssistant,
  onActionsApplied,
  onActionsDismissed,
  onFeedback,
  onRegenerate,
  onFollowUp,
  onEditAndResend,
  onRetry,
}: Props) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const editRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      // Fallback for older browsers / non-HTTPS
      const textarea = document.createElement('textarea');
      textarea.value = message.content;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    if (isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
      return;
    }

    // Strip markdown syntax for cleaner speech
    const plain = message.content
      .replace(/#{1,6}\s/g, '')           // headings
      .replace(/\*\*(.+?)\*\*/g, '$1')    // bold
      .replace(/\*(.+?)\*/g, '$1')        // italic
      .replace(/`(.+?)`/g, '$1')          // inline code
      .replace(/```[\s\S]*?```/g, '')      // code blocks
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links
      .replace(/^[-*]\s/gm, '')           // list bullets
      .replace(/^\d+\.\s/gm, '')          // numbered lists
      .trim();

    const utterance = new SpeechSynthesisUtterance(plain);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synth.speak(utterance);
    setIsSpeaking(true);
  };

  const startEditing = () => {
    setEditText(message.content);
    setIsEditing(true);
  };

  const cancelEditing = () => setIsEditing(false);

  const saveEdit = () => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setIsEditing(false);
    onEditAndResend(message.id, trimmed);
  };

  // Auto-resize edit textarea and focus on open
  useEffect(() => {
    if (isEditing && editRef.current) {
      const el = editRef.current;
      el.focus();
      el.selectionStart = el.selectionEnd = el.value.length;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [isEditing]);

  // Auto-resize as user types
  useEffect(() => {
    if (editRef.current) {
      editRef.current.style.height = 'auto';
      editRef.current.style.height = `${editRef.current.scrollHeight}px`;
    }
  }, [editText]);

  // Show regenerate only on last assistant message, and only if actions weren't applied
  const showRegenerate = isLastAssistant && !message.actionsApplied;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`group relative max-w-[85%] rounded-xl px-3.5 py-2.5 ${
          isUser
            ? 'bg-telos-blue-600/30 border border-telos-blue-600/20 text-slate-100'
            : 'bg-surface-700 border border-slate-600/50 text-slate-200'
        }`}
      >
        {/* Attachment card (user messages with documents) */}
        {isUser && message.attachment && (
          <div className="mb-2 flex items-center gap-2 text-xs">
            <FileText className="w-4 h-4 text-telos-blue-400 flex-shrink-0" />
            <span className="text-slate-300 truncate max-w-[160px]">{message.attachment.fileName}</span>
            {message.attachment.status === 'extracting' && (
              <Loader2 className="w-3.5 h-3.5 text-telos-blue-400 animate-spin flex-shrink-0" />
            )}
            {message.attachment.status === 'ocr-processing' && (
              <span className="text-[10px] text-amber-400 flex-shrink-0">
                OCR {message.attachment.ocrProgress ?? 0}%
              </span>
            )}
            {message.attachment.status === 'done' && message.attachment.formType && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex-shrink-0">
                {message.attachment.formType}
              </span>
            )}
            {message.attachment.status === 'error' && (
              <span className="text-[10px] text-red-400 flex-shrink-0">Failed</span>
            )}
          </div>
        )}

        {/* Message content */}
        {isUser && isEditing ? (
          <div>
            <textarea
              ref={editRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                if (e.key === 'Escape') cancelEditing();
              }}
              className="w-full bg-transparent text-sm text-slate-100 leading-relaxed resize-none
                         focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                onClick={cancelEditing}
                className="text-xs font-medium px-3.5 py-1.5 rounded-full text-slate-300 hover:text-white
                           bg-surface-600 hover:bg-surface-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={!editText.trim()}
                className="text-xs font-medium px-3.5 py-1.5 rounded-full text-white
                           bg-slate-200 text-surface-900 hover:bg-white transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        ) : isUser ? (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        ) : (
          <MarkdownMessage content={injectStepLinks(message.content)} />
        )}

        {/* Action preview (assistant messages only) */}
        {message.actions && message.actions.length > 0 && (
          <ActionPreview
            actions={message.actions}
            messageId={message.id}
            applied={message.actionsApplied || false}
            dismissed={message.actionsDismissed || false}
            summary={message.actionsSummary}
            onApplied={onActionsApplied}
            onDismissed={onActionsDismissed}
          />
        )}

        {/* Follow-up chips (last assistant message only) */}
        {isLastAssistant && message.followUpChips && message.followUpChips.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-slate-600/30 flex flex-wrap gap-1.5">
            {message.followUpChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => onFollowUp(chip)}
                className="text-[11px] px-2.5 py-1 rounded-full
                           bg-telos-blue-500/10 border border-telos-blue-500/25
                           text-telos-blue-300 hover:bg-telos-blue-500/20 hover:border-telos-blue-500/40
                           transition-colors cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* ─── Action bar (assistant messages only) ─── */}
        {!isUser ? (
          <div className="flex items-center justify-between mt-1.5">
            {/* Left: feedback buttons */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onFeedback(message.id, 'up')}
                className={`p-1 rounded transition-colors ${
                  message.feedback === 'up'
                    ? 'text-emerald-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                aria-label="Good response"
                title="Good response"
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => onFeedback(message.id, 'down')}
                className={`p-1 rounded transition-colors ${
                  message.feedback === 'down'
                    ? 'text-red-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                aria-label="Poor response"
                title="Poor response"
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>

            {/* Right: copy, regenerate, timestamp */}
            <div className="flex items-center gap-0.5">
              {window.speechSynthesis && (
                <button
                  onClick={handleSpeak}
                  className={`p-1 rounded transition-all ${
                    isSpeaking
                      ? 'text-telos-blue-400 opacity-100'
                      : 'text-slate-500 opacity-0 group-hover:opacity-100 hover:text-slate-300'
                  }`}
                  aria-label={isSpeaking ? 'Stop speaking' : 'Read aloud'}
                  title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
                >
                  {isSpeaking
                    ? <VolumeX className="w-3 h-3" />
                    : <Volume2 className="w-3 h-3" />
                  }
                </button>
              )}
              <button
                onClick={handleCopy}
                className="p-1 rounded text-slate-500 opacity-0 group-hover:opacity-100 hover:text-slate-300 transition-all"
                aria-label="Copy message"
                title="Copy to clipboard"
              >
                {copied
                  ? <Check className="w-3 h-3 text-emerald-400" />
                  : <Copy className="w-3 h-3" />
                }
              </button>
              {showRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="p-1 rounded text-slate-500 opacity-0 group-hover:opacity-100 hover:text-slate-300 transition-all"
                  aria-label="Regenerate response"
                  title="Regenerate response"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
              <span className="text-[10px] text-slate-500 ml-1">
                {formatTime(message.timestamp)}
              </span>
            </div>
          </div>
        ) : (
          /* User message: timestamp, retry, edit, copy */
          !isEditing && (
          <div className="flex items-center justify-end gap-0.5 mt-1.5">
            <span className="text-[10px] text-telos-blue-400/60 mr-0.5">
              {formatTime(message.timestamp)}
            </span>
            <button
              onClick={() => onRetry(message.id)}
              className="p-0.5 rounded text-telos-blue-400/40 opacity-0 group-hover:opacity-100 hover:text-telos-blue-300 transition-all"
              aria-label="Retry this message"
              title="Retry"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
            <button
              onClick={startEditing}
              className="p-0.5 rounded text-telos-blue-400/40 opacity-0 group-hover:opacity-100 hover:text-telos-blue-300 transition-all"
              aria-label="Edit message"
              title="Edit"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={handleCopy}
              className="p-0.5 rounded text-telos-blue-400/40 opacity-0 group-hover:opacity-100 hover:text-telos-blue-300 transition-all"
              aria-label="Copy message"
              title="Copy to clipboard"
            >
              {copied
                ? <Check className="w-3 h-3 text-emerald-400" />
                : <Copy className="w-3 h-3" />
              }
            </button>
          </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── Formatting Helpers ──────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

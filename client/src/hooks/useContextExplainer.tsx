/**
 * Global "Ask TelosAI" context menu for the Interview view.
 *
 * Right-click any element in the wizard to get an AI explanation.
 * Walks up the DOM from the click target to find the nearest meaningful
 * context: form field labels, section headings, callout cards, warnings,
 * or any selected text.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { useTaxReturnStore } from '../store/taxReturnStore';

interface ExplainerTarget {
  text: string;
  kind: 'field' | 'heading' | 'callout' | 'warning' | 'selection' | 'text';
  x: number;
  y: number;
}

/**
 * Walk up from an element to find the nearest meaningful context.
 */
function findContext(target: HTMLElement): { text: string; kind: ExplainerTarget['kind'] } | null {
  // 1. Check for selected text first
  const selection = window.getSelection();
  if (selection && selection.toString().trim().length > 3) {
    return { text: selection.toString().trim().slice(0, 200), kind: 'selection' };
  }

  let el: HTMLElement | null = target;
  while (el && el.id !== 'main-content') {
    // 2. Form field label — look for <label> or parent FormField wrapper
    if (el.tagName === 'LABEL') {
      const labelText = el.textContent?.replace(/\*$/, '').trim();
      if (labelText) return { text: labelText, kind: 'field' };
    }

    // FormField wrapper: <div class="mb-4"> with a <label> child
    if (el.tagName === 'DIV' && el.classList.contains('mb-4')) {
      const label = el.querySelector('label');
      if (label) {
        const labelText = label.textContent?.replace(/\*$/, '').trim();
        if (labelText) return { text: labelText, kind: 'field' };
      }
    }

    // 3. Section heading (h1, h2, h3)
    if (/^H[1-3]$/.test(el.tagName)) {
      const headingText = el.textContent?.trim();
      if (headingText) return { text: headingText, kind: 'heading' };
    }

    // 4. Callout card — has rounded-lg border p-4 classes
    if (el.tagName === 'DIV' && el.classList.contains('rounded-lg') && el.classList.contains('border') && el.classList.contains('p-4')) {
      const title = el.querySelector('.font-medium')?.textContent?.trim();
      const body = el.querySelector('.text-slate-400')?.textContent?.trim();
      const text = [title, body].filter(Boolean).join(': ');
      if (text) return { text: text.slice(0, 300), kind: 'callout' };
    }

    // 5. Warning/error message
    if (el.getAttribute('role') === 'alert' || (el.tagName === 'P' && (el.classList.contains('text-red-400') || el.classList.contains('text-amber-400')))) {
      const text = el.textContent?.trim();
      if (text) return { text, kind: 'warning' };
    }

    // 6. Any element with substantial text content (fallback)
    if (el.tagName === 'P' || el.tagName === 'SPAN' || el.tagName === 'DIV') {
      const text = el.textContent?.trim();
      if (text && text.length > 5 && text.length < 300 && el.children.length < 3) {
        return { text, kind: 'text' };
      }
    }

    el = el.parentElement;
  }

  return null;
}

function buildPrompt(target: ExplainerTarget, stepLabel: string | undefined): { message: string; context: string } {
  const stepNote = stepLabel ? ` (on the "${stepLabel}" step)` : '';

  switch (target.kind) {
    case 'field':
      return {
        message: `Explain the **${target.text}** field${stepNote}. What goes here, what IRS rules apply, and what are common mistakes?`,
        context: `User right-clicked the "${target.text}" form field${stepNote} in the Interview view and wants an explanation.`,
      };
    case 'heading':
      return {
        message: `Explain this section: **${target.text}**${stepNote}. What is it for and what do I need to know?`,
        context: `User right-clicked the heading "${target.text}"${stepNote} and wants an overview.`,
      };
    case 'callout':
      return {
        message: `Explain this in more detail: "${target.text}"`,
        context: `User right-clicked a callout/info card${stepNote} with content: "${target.text}"`,
      };
    case 'warning':
      return {
        message: `I'm seeing this warning: "${target.text}". What does it mean and how do I fix it?`,
        context: `User right-clicked a warning/error message${stepNote}: "${target.text}"`,
      };
    case 'selection':
      return {
        message: `Explain this: "${target.text}"`,
        context: `User selected and right-clicked text${stepNote}: "${target.text}"`,
      };
    default:
      return {
        message: `Explain this: "${target.text}"`,
        context: `User right-clicked text${stepNote}: "${target.text}"`,
      };
  }
}

/**
 * Hook: attach to a container ref to enable right-click → "Ask TelosAI" on any element.
 * Returns a portal element to render in the component tree.
 */
export function useContextExplainer(containerRef: React.RefObject<HTMLElement | null>) {
  const [target, setTarget] = useState<ExplainerTarget | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const { openWithPrompt } = useChatStore();
  const { getCurrentStep } = useTaxReturnStore();

  // Handle right-click
  const handleContextMenu = useCallback((e: MouseEvent) => {
    const clickTarget = e.target as HTMLElement;
    // Don't intercept right-clicks on inputs (user may want paste/spell-check)
    if (clickTarget.tagName === 'INPUT' || clickTarget.tagName === 'TEXTAREA' || clickTarget.tagName === 'SELECT') {
      return;
    }

    const context = findContext(clickTarget);
    if (!context) return;

    e.preventDefault();
    setTarget({
      ...context,
      x: Math.min(e.clientX, window.innerWidth - 300),
      y: e.clientY,
    });
  }, []);

  // Attach handler — uses an interval to retry until the ref is available,
  // since the <main> element may not exist on the first render cycle.
  useEffect(() => {
    const attach = () => {
      const container = containerRef.current;
      if (!container) return false;
      container.addEventListener('contextmenu', handleContextMenu);
      return true;
    };

    if (attach()) {
      return () => containerRef.current?.removeEventListener('contextmenu', handleContextMenu);
    }

    // Retry until mounted
    const timer = setInterval(() => {
      if (attach()) clearInterval(timer);
    }, 200);

    return () => {
      clearInterval(timer);
      containerRef.current?.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [containerRef, handleContextMenu]);

  // Dismiss on outside click or scroll
  useEffect(() => {
    if (!target) return;
    const dismiss = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setTarget(null);
      }
    };
    const dismissScroll = () => setTarget(null);
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', dismiss);
      document.addEventListener('scroll', dismissScroll, true);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('scroll', dismissScroll, true);
    };
  }, [target]);

  // Handle explain action
  const handleExplain = useCallback(() => {
    if (!target) return;
    const step = getCurrentStep();
    const stepLabel = step?.label;
    const { message, context } = buildPrompt(target, stepLabel);
    setTarget(null);
    openWithPrompt(message, context);
  }, [target, getCurrentStep, openWithPrompt]);

  // Portal element
  const portal = target
    ? createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[10000] animate-in fade-in slide-in-from-top-1 duration-150"
          style={{ left: target.x, top: target.y }}
        >
          <div className="bg-surface-700/95 backdrop-blur-md border border-surface-500 rounded-xl shadow-xl px-3 py-2.5 flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-400 truncate max-w-[200px]">
              {target.text.length > 60 ? target.text.slice(0, 57) + '...' : target.text}
            </span>
            <button
              onClick={handleExplain}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                         border border-transparent hover:border-telos-orange-500/50
                         bg-surface-600 hover:bg-surface-500
                         shadow-sm hover:shadow-md hover:shadow-black/20
                         transition-all duration-200"
            >
              <Sparkles size={12} className="text-telos-orange-400 ai-sparkle" />
              <span>Ask <span className="text-telos-orange-400">Telos</span><span className="text-telos-blue-400">AI</span></span>
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  return portal;
}

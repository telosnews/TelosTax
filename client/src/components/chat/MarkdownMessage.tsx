/**
 * MarkdownMessage — renders assistant chat messages as sanitized Markdown.
 *
 * Uses react-markdown (renders MD → React elements, never dangerouslySetInnerHTML)
 * with rehype-sanitize as defense-in-depth against prompt injection attacks that
 * could embed HTML in the LLM's JSON `message` field.
 *
 * Security: images are stripped. Links are only rendered as clickable for internal
 * navigation fragments (#step-- and #tool--). All other links render as plain text
 * — the LLM should not generate arbitrary clickable URLs.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Components } from 'react-markdown';
import { useTaxReturnStore } from '../../store/taxReturnStore';
import { STEP_LINK_PREFIX, TOOL_LINK_PREFIX } from '../../services/stepLinkInjector';

/**
 * Extend the default hast-util-sanitize schema.
 *
 * Navigation uses fragment URLs (#step--id / #tool--id) instead of a custom
 * protocol because rehype-sanitize strips unknown protocols. Fragment-only URLs
 * have no protocol, so they always survive sanitization.
 */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    'p', 'strong', 'em', 'del', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'code', 'pre', 'br', 'hr', 'blockquote',
    'a', // allowed through sanitizer; component override handles security
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: ['href'], // only href passes through; component override validates the protocol
  },
  strip: ['script', 'style', 'iframe', 'form', 'input', 'img'],
};

const LINK_CLASS =
  'inline text-telos-blue-400 hover:text-telos-blue-300 underline underline-offset-2 decoration-telos-blue-400/40 hover:decoration-telos-blue-300/60 transition-colors cursor-pointer';

/** Build component overrides — needs store actions for navigation. */
function buildComponents(
  goToStep: (stepId: string) => void,
  setActiveTool: (toolId: string | null) => void,
): Components {
  return {
    p: ({ children }) => (
      <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-slate-100">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    ul: ({ children }) => (
      <ul className="list-disc list-inside space-y-0.5 mb-2 text-sm">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside space-y-0.5 mb-2 text-sm">{children}</ol>
    ),
    li: ({ children }) => <li className="text-sm">{children}</li>,
    h1: ({ children }) => (
      <h1 className="text-sm font-semibold text-slate-100 mt-3 mb-1">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-sm font-semibold text-slate-100 mt-3 mb-1">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-sm font-semibold text-slate-100 mt-2 mb-1">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-sm font-medium text-slate-200 mt-2 mb-1">{children}</h4>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-2">
        <table className="w-full text-xs border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead>{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children }) => (
      <th className="text-left text-slate-300 font-medium border-b border-slate-600 px-2 py-1">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="text-slate-200 border-b border-slate-700/50 px-2 py-1">
        {children}
      </td>
    ),
    code: ({ children, className }) => {
      const isBlock = className?.startsWith('language-');
      if (isBlock) {
        return (
          <code className="text-xs font-mono text-telos-blue-300">{children}</code>
        );
      }
      return (
        <code className="bg-surface-900 text-telos-blue-300 px-1 py-0.5 rounded text-xs font-mono">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="bg-surface-900 rounded-lg p-3 overflow-x-auto my-2 text-xs">
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-slate-500 pl-3 my-2 text-sm text-slate-300 italic">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-slate-700 my-3" />,
    // Links: only #step-- and #tool-- fragment URLs render as clickable; all others → plain text
    a: ({ href, children }) => {
      if (href?.startsWith(STEP_LINK_PREFIX)) {
        const stepId = href.slice(STEP_LINK_PREFIX.length);
        return (
          <button onClick={() => goToStep(stepId)} className={LINK_CLASS}>
            {children}
          </button>
        );
      }
      if (href?.startsWith(TOOL_LINK_PREFIX)) {
        const toolId = href.slice(TOOL_LINK_PREFIX.length);
        return (
          <button onClick={() => setActiveTool(toolId)} className={LINK_CLASS}>
            {children}
          </button>
        );
      }
      // Security: non-navigation links render as plain text
      return <span>{children}</span>;
    },
    img: () => null,
  };
}

interface Props {
  content: string;
}

export default function MarkdownMessage({ content }: Props) {
  const goToStep = useTaxReturnStore((s) => s.goToStep);
  const setActiveTool = useTaxReturnStore((s) => s.setActiveTool);
  const components = buildComponents(goToStep, setActiveTool);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}

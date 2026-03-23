/**
 * Provider Icon — Anthropic brand icon.
 *
 * Used in the model picker and anywhere the AI provider needs a visual identifier.
 * Simplified geometric asterisk/starburst in brand-approximate color, optimized for 14px.
 */

interface Props {
  size?: number;
}

export default function ProviderIcon({ size = 14 }: Props) {
  // Asterisk / starburst — evokes the Claude brand mark
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="text-[#D97757] flex-shrink-0"
    >
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="4.27" y1="7.5" x2="19.73" y2="16.5" />
      <line x1="4.27" y1="16.5" x2="19.73" y2="7.5" />
    </svg>
  );
}

import { ReactNode, ReactElement, useId, isValidElement, cloneElement, Children } from 'react';
import InfoTooltip, { TooltipContent } from './InfoTooltip';

interface FormFieldProps {
  label: string;
  optional?: boolean;
  notCommon?: boolean;
  helpText?: string;
  tooltip?: string | TooltipContent;
  error?: string;
  warning?: string;
  errorId?: string;       // Used by "Fix This" navigation to scroll to error
  irsRef?: string;        // e.g., "Form 1040, Line 1" — displayed in tooltip
  fieldId?: string;       // Explicit id for the input element; auto-generated if omitted
  children: ReactNode;
}

interface InjectedProps {
  id?: string;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
}

/**
 * Inject `id`, `aria-describedby`, and `aria-required` into the first React element child
 * so the label's `htmlFor` connects to the form control and assistive technologies
 * can announce validation messages and required status.
 */
function injectProps(children: ReactNode, props: InjectedProps): ReactNode {
  const childArray = Children.toArray(children);
  let injected = false;
  return childArray.map((child) => {
    if (!injected && isValidElement(child)) {
      injected = true;
      return cloneElement(child as ReactElement<InjectedProps>, props);
    }
    return child;
  });
}

export default function FormField({
  label,
  optional,
  notCommon,
  helpText,
  tooltip,
  error,
  warning,
  errorId,
  irsRef,
  fieldId,
  children,
}: FormFieldProps) {
  const autoId = useId();
  const inputId = fieldId || autoId;
  // Build structured tooltip content
  let tooltipContent: string | TooltipContent | null = null;

  if (typeof tooltip === 'object') {
    // Already structured — merge irsRef if provided separately and not already set
    tooltipContent = irsRef && !tooltip.irsRef ? { ...tooltip, irsRef } : tooltip;
  } else if (tooltip && irsRef) {
    // Plain string tooltip + irsRef → upgrade to structured
    tooltipContent = { body: tooltip, irsRef };
  } else if (tooltip) {
    // Plain string tooltip, no irsRef — pass through as string
    tooltipContent = tooltip;
  } else if (irsRef) {
    // Only irsRef, no tooltip text — still show it
    tooltipContent = { body: '', irsRef };
  }

  const messageId = `${inputId}-msg`;
  const hasMessage = !!error || (!!warning && !error);
  const isRequired = !optional;

  const injectedProps: InjectedProps = {
    id: inputId,
    ...(hasMessage && { 'aria-describedby': messageId }),
    ...(isRequired && { 'aria-required': true }),
  };

  return (
    <div className="mb-4" id={errorId} data-error-field={error ? 'true' : undefined}>
      <label htmlFor={inputId} className="label flex items-center gap-1.5">
        {label}
        {!optional && <span className="text-red-400 font-normal" aria-label="required">*</span>}
        {notCommon && <span className="text-slate-600 font-normal text-xs">(not common)</span>}
        {tooltipContent && <InfoTooltip text={tooltipContent} />}
      </label>
      {injectProps(children, injectedProps)}
      {helpText && !error && !warning && (
        <p className="mt-1 text-xs text-slate-400">{helpText}</p>
      )}
      {error && (
        <p id={messageId} className="mt-1 text-xs text-red-400" role="alert">{error}</p>
      )}
      {warning && !error && (
        <p id={messageId} className="mt-1 text-xs text-amber-400">{warning}</p>
      )}
    </div>
  );
}

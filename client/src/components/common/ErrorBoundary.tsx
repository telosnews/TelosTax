import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
          <p className="text-white font-semibold mb-1">Something went wrong</p>
          <p className="text-sm text-slate-400 mb-4">An unexpected error occurred while rendering this section.</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-secondary text-sm"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

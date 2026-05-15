import {Component, ErrorInfo, ReactNode} from 'react';
import {AlertTriangle, RefreshCw, RotateCcw} from 'lucide-react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
  retryCount: number;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
    retryCount: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      message: error.message,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error boundary caught an error', error, info);
  }

  handleRetry = () => {
    this.setState((s) => ({hasError: false, message: '', retryCount: s.retryCount + 1}));
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="min-h-screen bg-surface text-on-surface flex items-center justify-center px-6">
        <section className="w-full max-w-lg rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-tertiary-container flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-tertiary" />
          </div>
          <h1 className="text-2xl font-headline font-extrabold mt-5">畫面暫時卡住了</h1>
          <p className="text-sm text-on-surface-variant mt-2">展示資料還在。先按「回到展示」，如果還沒有恢復，再按「重新整理」。</p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-extrabold text-on-primary hover:bg-primary-dim transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              回到展示
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-high px-4 py-3 text-sm font-extrabold text-on-surface hover:bg-surface-container-highest transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              重新整理
            </button>
          </div>
        </section>
      </main>
    );
  }
}

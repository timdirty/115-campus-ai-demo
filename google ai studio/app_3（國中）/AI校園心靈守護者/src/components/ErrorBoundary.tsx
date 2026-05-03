import {Component, ErrorInfo, ReactNode} from 'react';
import {AlertTriangle, RefreshCw} from 'lucide-react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error boundary caught an error', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center px-6">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-warning" />
          </div>
          <h1 className="text-2xl font-bold mt-5">介面發生錯誤</h1>
          <p className="text-sm text-slate-500 mt-2">應用程式沒有白屏，錯誤已被攔截。重新整理後會回到目前本機資料。</p>
          {this.state.message && (
            <pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-slate-100 p-3 text-xs text-slate-600 whitespace-pre-wrap">
              {this.state.message}
            </pre>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            重新整理
          </button>
        </section>
      </main>
    );
  }
}

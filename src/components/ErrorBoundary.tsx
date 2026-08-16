import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Last line of defence. A throw inside any view — a malformed payload reaching a
 * chart, a missing module key — would otherwise unmount the tree and leave a
 * blank page with no way back. This keeps the shell, names the failure, and
 * offers a reset that re-mounts the subtree without a full reload.
 */
interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[Dashboard render failure]', error, info.componentStack);
  }

  private reset = (): void => this.setState({ error: null });

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-canvas text-ink flex items-center justify-center px-5 py-16">
        <div className="bg-surface border border-line rounded-card p-6 sm:p-8 max-w-lg w-full">
          <div className="flex items-start gap-3">
            <span className="shrink-0 w-9 h-9 rounded-lg bg-critical-tint text-critical flex items-center justify-center">
              <AlertTriangle className="w-4.5 h-4.5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[16px] font-semibold text-ink">This view failed to render</h1>
              <p className="text-[13px] text-muted mt-1.5 leading-relaxed">
                The data loaded, but something in the page threw while drawing it. The details below are what
                the console recorded.
              </p>
            </div>
          </div>

          <pre className="num text-[11.5px] text-ink-2 bg-sunken border border-line rounded-lg mt-4 p-3 overflow-x-auto whitespace-pre-wrap break-words">
            {error.message || String(error)}
          </pre>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={this.reset}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] font-semibold bg-accent text-on-accent hover:bg-accent-hover transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] font-semibold border border-line bg-surface text-ink-2 hover:bg-sunken hover:text-ink transition-colors"
            >
              Reload the console
            </button>
          </div>
        </div>
      </div>
    );
  }
}

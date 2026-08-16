import React from 'react';
import { AlertOctagon, RefreshCw, KeyRound, ServerOff, WifiOff } from 'lucide-react';
import { ApiError } from '../services/api';

interface ErrorStateProps {
  error: ApiError | string;
  onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorType = typeof error === 'object' ? error.type : 'unknown';

  let icon = <AlertOctagon className="w-6 h-6 text-critical" />;
  let title = "Couldn't load the analytics data";
  let guidance = 'Check your connection and try again.';

  if (errorType === 'auth') {
    icon = <KeyRound className="w-6 h-6 text-caution" />;
    title = 'Access refused by the backend (403)';
    guidance = 'The X-Internal-Secret header is missing or wrong. Set VITE_ADMIN_SECRET and reload.';
  } else if (errorType === 'network') {
    icon = <WifiOff className="w-6 h-6 text-critical" />;
    title = "Can't reach the analytics backend";
    guidance =
      'No response from stripe-backend-cowwwkwqaq-el.a.run.app. Check network access, then retry.';
  } else if (errorType === 'server') {
    icon = <ServerOff className="w-6 h-6 text-critical" />;
    title = 'The backend failed while building the report (500)';
    guidance = 'The usage-summary query raised an internal error. Retry, then escalate if it persists.';
  }

  return (
    <div className="min-h-[360px] flex items-start justify-center pt-10">
      <div className="max-w-lg w-full bg-surface border border-line rounded-card p-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">{icon}</div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            <p className="text-[13px] text-muted mt-1 leading-relaxed">{guidance}</p>
            <p className="num text-[11.5px] text-ink-2 bg-sunken px-3 py-2 rounded-lg border border-line mt-3 break-words">
              {errorMessage}
            </p>
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 mt-4 px-3.5 py-2 rounded-lg font-semibold text-[12.5px] text-on-accent bg-accent hover:bg-accent-hover transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

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

  let icon = <AlertOctagon className="w-12 h-12 text-red-400 mb-4" />;
  let title = 'Failed to Load Business Analytics';
  let guidance = 'Please check your connection and try again.';

  if (errorType === 'auth') {
    icon = <KeyRound className="w-12 h-12 text-amber-400 mb-4" />;
    title = 'Authentication Error (403 Forbidden)';
    guidance = 'The provided X-Internal-Secret header is invalid or unconfigured. Verify VITE_ADMIN_SECRET in environment configuration.';
  } else if (errorType === 'network') {
    icon = <WifiOff className="w-12 h-12 text-red-400 mb-4" />;
    title = 'Backend Network Timeout / Offline';
    guidance = 'Unable to reach backend endpoint (https://stripe-backend-cowwwkwqaq-el.a.run.app). Verify network access or backend connectivity.';
  } else if (errorType === 'server') {
    icon = <ServerOff className="w-12 h-12 text-rose-400 mb-4" />;
    title = 'Backend Server Exception (500)';
    guidance = 'The server encountered an unexpected internal error while processing the usage summary.';
  }

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-md">
        <div className="flex justify-center">{icon}</div>
        <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
        <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono mb-4 text-left break-words">
          {errorMessage}
        </p>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">{guidance}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/30 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Connection
        </button>
      </div>
    </div>
  );
};

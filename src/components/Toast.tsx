import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'error' | 'success';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'error',
  onClose,
  duration = 5000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex items-center space-x-3 bg-surface border border-line text-ink px-4 py-3 rounded-xl shadow-lg transition-all duration-200 animate-slide-up max-w-md"
    >
      {type === 'error' ? (
        <AlertCircle className="w-5 h-5 text-critical shrink-0" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-positive shrink-0" />
      )}
      <span className="text-xs sm:text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="p-1 text-muted hover:text-ink rounded-lg transition-colors ml-auto shrink-0"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

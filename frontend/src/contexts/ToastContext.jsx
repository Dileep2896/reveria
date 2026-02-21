import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../components/Toast.css';

const ToastContext = createContext();

const ICONS = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  warning: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const MAX_TOASTS = 5;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idCounter = useRef(0);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    // Mark as exiting for slide-out animation
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    // Remove after animation completes
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idCounter.current;

    setToasts((prev) => {
      const next = [...prev, { id, message, type, duration, exiting: false, paused: false }];
      // Enforce max — remove oldest (trigger exit animation)
      if (next.length > MAX_TOASTS) {
        const oldest = next[0];
        clearTimeout(timersRef.current[oldest.id]);
        delete timersRef.current[oldest.id];
        return next.slice(1);
      }
      return next;
    });

    // Auto-dismiss timer
    timersRef.current[id] = setTimeout(() => removeToast(id), duration);

    return id;
  }, [removeToast]);

  const pauseToast = useCallback((id) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, paused: true } : t)));
  }, []);

  const resumeToast = useCallback((id) => {
    setToasts((prev) => {
      const toast = prev.find((t) => t.id === id);
      if (toast && !toast.exiting) {
        // Restart with remaining-ish duration (simplified: use half the original)
        timersRef.current[id] = setTimeout(() => removeToast(id), toast.duration / 2);
      }
      return prev.map((t) => (t.id === id ? { ...t, paused: false } : t));
    });
  }, [removeToast]);

  const toastContainer = toasts.length > 0
    ? createPortal(
        <div className="toast-container" aria-live="polite">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast toast-${toast.type}${toast.exiting ? ' toast-exit' : ''}`}
              onMouseEnter={() => pauseToast(toast.id)}
              onMouseLeave={() => resumeToast(toast.id)}
            >
              <div className="toast-icon">{ICONS[toast.type]}</div>
              <p className="toast-message">{toast.message}</p>
              <button
                className="toast-close"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div
                className={`toast-progress${toast.paused ? ' toast-progress-paused' : ''}`}
                style={{ animationDuration: `${toast.duration}ms` }}
              />
            </div>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {toastContainer}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

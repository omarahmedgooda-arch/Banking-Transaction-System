import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(() => {});

/** toast(message, tone, action) — action is an optional { label, onClick } such as Undo. */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = useCallback((message, tone = 'ok', action) => {
    const id = Math.random().toString(36).slice(2);
    setItems((xs) => [...xs, { id, message, tone, action }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), action ? 5000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            <span>{t.message}</span>
            {t.action && (
              <button type="button" onClick={() => { t.action.onClick(); setItems((xs) => xs.filter((x) => x.id !== t.id)); }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

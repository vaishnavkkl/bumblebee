import { createContext, useContext, useState, useCallback } from 'react';

const AlertContext = createContext();

export function AlertProvider({ children }) {
  const [queue, setQueue] = useState([]);

  const push = useCallback((config) => {
    return new Promise((resolve) => {
      setQueue(prev => [...prev, { ...config, id: Date.now(), resolve }]);
    });
  }, []);

  const resolve = useCallback((id, value) => {
    setQueue(prev => prev.filter(a => a.id !== id));
    const alert = queue.find(a => a.id === id);
    if (alert) alert.resolve(value);
  }, [queue]);

  const alert = useCallback((message, options = {}) =>
    push({ type: 'alert', message, title: options.title || 'Notice', icon: options.icon || 'ℹ️', variant: options.variant || 'info' }), [push]);

  const confirm = useCallback((message, options = {}) =>
    push({ type: 'confirm', message, title: options.title || 'Confirm', icon: options.icon || '⚠️', variant: options.variant || 'warning', confirmText: options.confirmText || 'Confirm', cancelText: options.cancelText || 'Cancel' }), [push]);

  const success = useCallback((message, options = {}) =>
    push({ type: 'alert', message, title: options.title || 'Success', icon: '✓', variant: 'success' }), [push]);

  const danger = useCallback((message, options = {}) =>
    push({ type: 'confirm', message, title: options.title || 'Delete', icon: '🗑️', variant: 'danger', confirmText: options.confirmText || 'Delete', cancelText: 'Cancel' }), [push]);

  return (
    <AlertContext.Provider value={{ alert, confirm, success, danger }}>
      {children}
      {queue.map(a => (
        <AlertModal key={a.id} config={a} onClose={(val) => resolve(a.id, val)} />
      ))}
    </AlertContext.Provider>
  );
}

export const useAlert = () => useContext(AlertContext);

const variantStyles = {
  info:    { icon: '#3b82f6', border: '#3b82f6', btnBg: '#3b82f6' },
  warning: { icon: '#f59e0b', border: '#f59e0b', btnBg: '#f59e0b' },
  success: { icon: '#10b981', border: '#10b981', btnBg: '#10b981' },
  danger:  { icon: '#ef4444', border: '#ef4444', btnBg: '#ef4444' },
};

function AlertModal({ config, onClose }) {
  const { type, message, title, icon, variant, confirmText, cancelText } = config;
  const st = variantStyles[variant] || variantStyles.info;

  return (
    <div className="alert-overlay" onClick={() => type === 'alert' && onClose(true)}>
      <div className="alert-box" onClick={e => e.stopPropagation()} style={{ '--alert-color': st.border }}>
        <div className="alert-icon-wrap" style={{ background: `${st.icon}18`, color: st.icon }}>
          <span className="alert-icon">{icon}</span>
        </div>
        <h3 className="alert-title">{title}</h3>
        <p className="alert-message">{message}</p>
        <div className="alert-actions">
          {type === 'confirm' && (
            <button className="alert-btn alert-btn-cancel" onClick={() => onClose(false)}>
              {cancelText}
            </button>
          )}
          <button
            className="alert-btn alert-btn-confirm"
            style={{ background: st.btnBg }}
            onClick={() => onClose(true)}
          >
            {type === 'confirm' ? confirmText : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

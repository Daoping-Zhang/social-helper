import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'error' : ''}`}>{t.msg}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function Spinner({ size = 22 }) {
  return <div className="spinner" style={{ width: size, height: size }} />;
}

export function Badge({ status, label }) {
  const colorMap = {
    completed: 'green', success: 'green', ready: 'blue', washing: 'orange', faceswapping: 'orange', enhancing: 'orange',
    awaiting_selection: 'purple', ready_for_faceswap: 'purple', awaiting_enhance: 'purple', running: 'orange', waiting: 'gray', failed: 'red',
  };
  const color = colorMap[status] || 'gray';
  return <span className={`badge ${color}`}>{label || status}</span>;
}

const FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="100%" height="100%" fill="#1b1f28"/><text x="50%" y="50%" fill="#5a6272" font-family="sans-serif" font-size="20" text-anchor="middle">暂无图片</text></svg>`
);

export function Img({ src, alt = '', style, className, ...rest }) {
  const [err, setErr] = useState(false);
  return (
    <img
      src={err || !src ? FALLBACK : src}
      alt={alt}
      style={style}
      className={className}
      onError={() => setErr(true)}
      {...rest}
    />
  );
}

export function Modal({ title, onClose, children, maxWidth = 520 }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Loading({ text = '加载中…' }) {
  return (
    <div className="center">
      <Spinner />
      <div className="muted">{text}</div>
    </div>
  );
}

import { useState, useEffect } from 'react';

export default function Toast({ message, type = 'info', duration = 3000, onDone }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hideTimer = setTimeout(() => setVisible(false), duration - 300);
    const removeTimer = setTimeout(() => onDone(), duration);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, [duration, onDone]);

  return (
    <div
      className={`toast ${type}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        transition: 'all 0.3s ease',
      }}
    >
      {message}
    </div>
  );
}

let toastId = 0;
const listeners = new Set();

export function addToast(message, type = 'info') {
  const id = ++toastId;
  listeners.forEach(fn => fn({ id, message, type }));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (toast) => {
      setToasts(prev => [...prev, toast]);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const remove = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <Toast
          key={t.id}
          message={t.message}
          type={t.type}
          onDone={() => remove(t.id)}
        />
      ))}
    </div>
  );
}

import { useGame } from '../store';

export function Toasts() {
  const toasts = useGame((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          {toast.message}
        </div>
      ))}
    </div>
  );
}

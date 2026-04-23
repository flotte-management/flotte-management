interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: number;
}

export function Modal({ open, onClose, title, children, maxWidth = 500 }: ModalProps) {
  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        width: '100%',
        maxWidth,
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
          >✕</button>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </div>
  );
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function Card({ children, className = '', style, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '16px 20px',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
      onMouseEnter={onClick ? (e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 1px var(--accent)22';
      } : undefined}
      onMouseLeave={onClick ? (e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      } : undefined}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  color?: string;
  icon?: React.ReactNode;
}

export function StatCard({ label, value, color = 'var(--accent)', icon }: StatCardProps) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{label}</span>
        {icon && <span style={{ color }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </Card>
  );
}

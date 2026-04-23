interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

const VARIANTS = {
  primary: { bg: 'var(--accent)', color: '#000', border: 'var(--accent)' },
  secondary: { bg: 'var(--bg-elevated)', color: 'var(--text-primary)', border: 'var(--border)' },
  danger: { bg: 'var(--danger)', color: '#fff', border: 'var(--danger)' },
  ghost: { bg: 'transparent', color: 'var(--text-secondary)', border: 'transparent' },
};

const SIZES = {
  sm: { padding: '4px 10px', fontSize: 12 },
  md: { padding: '7px 14px', fontSize: 13 },
  lg: { padding: '10px 20px', fontSize: 15 },
};

export function Button({ variant = 'secondary', size = 'md', isLoading, children, disabled, style, ...props }: ButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  return (
    <button
      disabled={disabled || isLoading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: 500,
        borderRadius: 6,
        border: `1px solid ${v.border}`,
        background: v.bg,
        color: v.color,
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled || isLoading ? 0.6 : 1,
        transition: 'opacity 0.15s, filter 0.15s',
        whiteSpace: 'nowrap',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.15)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.filter = 'none';
      }}
      {...props}
    >
      {isLoading ? (
        <>
          <span style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
          Chargement…
        </>
      ) : children}
    </button>
  );
}

interface TableProps<T> {
  columns: { key: string; label: string; render?: (row: T) => React.ReactNode; width?: string | number }[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
}

export function Table<T>({ columns, data, keyExtractor, onRowClick, emptyMessage = 'Aucun résultat', isLoading }: TableProps<T>) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  fontSize: 12,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  width: col.width,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                Chargement…
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : data.map((row) => (
            <tr
              key={keyExtractor(row)}
              style={{
                borderBottom: '1px solid var(--border)',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background 0.1s',
              }}
              onClick={() => onRowClick?.(row)}
              onMouseEnter={(e) => { if (onRowClick) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(e) => { if (onRowClick) (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
            >
              {columns.map((col) => (
                <td key={col.key} style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

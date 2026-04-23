import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Sidebar />
      <div style={{ marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title={title} />
        <main style={{ marginTop: 56, padding: 24, flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}

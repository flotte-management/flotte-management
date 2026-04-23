import { createRoot } from 'react-dom/client'
import { ApolloProvider } from '@apollo/client/react'
import { Toaster } from 'react-hot-toast'
import { apolloClient } from './apollo/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <ApolloProvider client={apolloClient}>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          fontSize: '13px',
        },
        success: { iconTheme: { primary: '#3FB950', secondary: '#fff' } },
        error:   { iconTheme: { primary: '#F85149', secondary: '#fff' } },
      }}
    />
  </ApolloProvider>,
)

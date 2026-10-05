import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HeroUIProvider } from '@heroui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './theme/tokens.css'
import './i18n/i18n'
import { AuthProvider } from './auth/AuthProvider'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <HeroUIProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </HeroUIProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
)
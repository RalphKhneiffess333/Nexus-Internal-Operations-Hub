import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthenticationProvider } from './features/authentication/AuthenticationProvider.jsx'
import { OperationsSocketProvider } from './features/realtime/OperationsSocketProvider.jsx'
import { NotificationProvider } from './features/notifications/NotificationProvider.jsx'
import { FilterOptionsProvider } from './features/filters/FilterOptionsProvider.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthenticationProvider>
        <OperationsSocketProvider>
          <FilterOptionsProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </FilterOptionsProvider>
        </OperationsSocketProvider>
      </AuthenticationProvider>
    </BrowserRouter>
  </StrictMode>,
)

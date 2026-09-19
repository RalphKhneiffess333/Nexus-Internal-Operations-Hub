import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthenticationProvider } from './features/authentication/AuthenticationProvider.jsx'
import { OperationsSocketProvider } from './features/realtime/OperationsSocketProvider.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthenticationProvider>
        <OperationsSocketProvider>
          <App />
        </OperationsSocketProvider>
      </AuthenticationProvider>
    </BrowserRouter>
  </StrictMode>,
)

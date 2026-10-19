import React from 'react'
import ReactDOM from 'react-dom/client'
// Global styles first so component styles can override them
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)

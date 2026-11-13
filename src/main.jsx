import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import FeedbackProvider from './components/FeedbackProvider'
import { applyStoredTheme } from './hooks/useTheme'
import './index.css'

applyStoredTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FeedbackProvider>
      <App />
    </FeedbackProvider>
  </React.StrictMode>
)

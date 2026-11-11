import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import IllinoisPage from './IllinoisPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <IllinoisPage />
  </StrictMode>,
)

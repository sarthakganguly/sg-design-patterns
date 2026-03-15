import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css' // You might need an empty index.css file too

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
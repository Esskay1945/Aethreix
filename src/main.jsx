import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AthreixProvider } from './context/AthreixContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AthreixProvider>
      <App />
    </AthreixProvider>
  </React.StrictMode>
);

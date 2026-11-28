import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import { ToastProvider } from './components/Toast';
import { PrefsProvider } from './prefs';
import { QuickAddProvider } from './coach';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <PrefsProvider>
        <ToastProvider>
          <AuthProvider>
            <QuickAddProvider>
              <App />
            </QuickAddProvider>
          </AuthProvider>
        </ToastProvider>
      </PrefsProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

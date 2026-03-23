import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { registerLicense } from '@syncfusion/ej2-base';
import '@fontsource-variable/inter';
import App from './App';
import './styles/globals.css';

// Syncfusion Essential JS 2 — Community License (free for <$1M revenue / <5 devs)
// Get your own key at https://www.syncfusion.com/account/claim-license-key
if (import.meta.env.VITE_SYNCFUSION_LICENSE_KEY) {
  registerLicense(import.meta.env.VITE_SYNCFUSION_LICENSE_KEY);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: '#1E293B',
            border: '1px solid #334155',
            color: '#E2E8F0',
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
);

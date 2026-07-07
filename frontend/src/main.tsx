import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AnalysisProvider} from './context/AnalysisContext';
import {AuthProvider} from './context/AuthContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AnalysisProvider>
        <App />
      </AnalysisProvider>
    </AuthProvider>
  </StrictMode>,
);

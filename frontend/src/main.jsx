import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // Tus estilos globales existentes
import 'bootstrap/dist/css/bootstrap.min.css'; // <--- AÑADE ESTA LÍNEA

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
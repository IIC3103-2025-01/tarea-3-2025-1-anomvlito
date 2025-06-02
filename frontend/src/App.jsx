import "./App.css"; // Los estilos que ya tenías para App
import ChatInterface from "./components/ChatInterface"; // Importa el nuevo componente

function App() {
  return (
    <>
      {/* Puedes dejar el div#root en index.html como contenedor principal, 
          o añadir aquí un div con la clase 'App' si lo necesitas para tus estilos de App.css */}
      <ChatInterface />
    </>
  );
}

export default App;

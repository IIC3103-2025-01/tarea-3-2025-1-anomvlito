import { useState, useEffect } from "react";
import "./App.css";
import ChatInterface from "./components/ChatInterface";

function App() {
  // 1. El estado del tema vive aquí, en el componente principal.
  const [theme, setTheme] = useState("light"); // 'light' o 'dark'

  // 2. La función para cambiar el tema también vive aquí.
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
  };

  // 3. Este "efecto" se ejecuta cada vez que el estado 'theme' cambia.
  //    Aplica el tema a toda la página, para que Bootstrap lo detecte.
  useEffect(() => {
    document.body.setAttribute("data-bs-theme", theme);
  }, [theme]);

  return (
    <>
      {/* 4. Pasamos el tema actual y la función para cambiarlo como "props"
           al componente ChatInterface.
      */}
      <ChatInterface theme={theme} toggleTheme={toggleTheme} />
    </>
  );
}

export default App;

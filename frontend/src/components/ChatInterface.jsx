import React, { useState } from "react";
import {
  Container,
  Form,
  Button,
  Card,
  ListGroup,
  Spinner,
  Alert,
} from "react-bootstrap";

function ChatInterface() {
  const [wikiURL, setWikiURL] = useState("");
  const [userQuestion, setUserQuestion] = useState("");
  const [conversation, setConversation] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!wikiURL.trim() || !userQuestion.trim()) {
      setError("Por favor, ingresa la URL del artículo y tu pregunta.");
      return;
    }
    setError(null);
    setIsLoading(true);

    const currentQuestion = userQuestion; // Guardar la pregunta actual antes de limpiar el input
    setConversation((prev) => [
      ...prev,
      { sender: "user", text: currentQuestion },
    ]);
    setUserQuestion(""); // Limpiar input de pregunta

    console.log("Enviando al backend:", {
      url: wikiURL,
      question: currentQuestion,
    });

    try {
      // --- LLAMADA REAL AL BACKEND ---
      const response = await fetch("http://localhost:8000/explain", {
        // URL de tu backend FastAPI
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json", // Es buena práctica incluirlo
        },
        body: JSON.stringify({ url: wikiURL, question: currentQuestion }),
      });

      setIsLoading(false); // Mover isLoading aquí para que se desactive después de la respuesta

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          detail: `Error ${response.status} del servidor. No se pudo leer el cuerpo del error.`,
        }));
        throw new Error(
          errorData.detail || `Error ${response.status} del servidor`
        );
      }

      const data = await response.json();

      setConversation((prev) => [
        ...prev,
        {
          sender: "bot",
          text: data.llm_answer,
          chunk: data.best_chunk, // Opcional: mostrar el chunk para depuración
          similarity: data.similarity_score, // Opcional: mostrar similitud
        },
      ]);
    } catch (err) {
      console.error("Error en la llamada a la API:", err);
      const errorMessage =
        err.message || "Ocurrió un error al procesar la solicitud.";
      setError(errorMessage);
      setConversation((prev) => [
        // Mostrar el error en el chat también
        ...prev,
        { sender: "bot", text: `Error: ${errorMessage}` },
      ]);
      if (isLoading) setIsLoading(false); // Asegurarse de que isLoading se desactive en caso de error
    }
  };

  return (
    <Container className="my-4">
      <Card>
        <Card.Header as="h2">Wikipedia Explainer Chat</Card.Header>
        <Card.Body>
          <Form.Group className="mb-3">
            <Form.Label>URL del Artículo de Wikipedia (en inglés):</Form.Label>
            <Form.Control
              type="url"
              placeholder="https://en.wikipedia.org/wiki/..."
              value={wikiURL}
              onChange={(e) => setWikiURL(e.target.value)}
              disabled={isLoading}
            />
          </Form.Group>

          <ListGroup
            variant="flush"
            className="mb-3"
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              border: "1px solid #dee2e6",
              padding: "10px",
            }}
          >
            {conversation.map((msg, index) => (
              <ListGroup.Item
                key={index}
                className={`d-flex ${
                  msg.sender === "user"
                    ? "justify-content-end"
                    : "justify-content-start"
                }`}
                style={{ border: "none", padding: "0.5rem 0" }}
              >
                <Card
                  bg={msg.sender === "user" ? "primary" : "light"}
                  text={msg.sender === "user" ? "white" : "dark"}
                  style={{
                    maxWidth: "70%",
                    padding: "0.5rem 1rem",
                    borderRadius: "15px",
                  }}
                >
                  <div>{msg.text}</div>
                  {msg.sender === "bot" && msg.chunk && (
                    <small
                      className="mt-2 d-block text-muted"
                      style={{
                        fontSize: "0.8em",
                        borderTop: "1px solid #ccc",
                        paddingTop: "5px",
                      }}
                    >
                      Contexto: {msg.chunk.substring(0, 100)}...
                    </small>
                  )}
                  {msg.sender === "bot" && msg.similarity && (
                    <small
                      className="mt-2 d-block text-muted"
                      style={{
                        fontSize: "0.8em",
                      }}
                    >
                      Similitud: {msg.similarity}
                    </small>
                  )}
                </Card>
              </ListGroup.Item>
            ))}
            {isLoading && (
              <ListGroup.Item
                className="text-center"
                style={{ border: "none" }}
              >
                <Spinner animation="border" size="sm" /> Procesando...
              </ListGroup.Item>
            )}
          </ListGroup>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Tu Pregunta:</Form.Label>
              <Form.Control
                type="text"
                placeholder="Escribe tu pregunta sobre el artículo..."
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                disabled={isLoading}
              />
            </Form.Group>
            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? "Enviando..." : "Enviar Pregunta"}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default ChatInterface;

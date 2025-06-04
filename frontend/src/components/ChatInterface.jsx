import React, { useState, useEffect, useRef } from "react";
import {
  Container,
  Form,
  Button,
  Card,
  ListGroup,
  Spinner,
  Alert,
  Row,
  Col,
  InputGroup,
} from "react-bootstrap"; // Añadí InputGroup

function ChatInterface() {
  const [wikiURL, setWikiURL] = useState("");
  const [userQuestion, setUserQuestion] = useState("");
  const [conversation, setConversation] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  const handleNewChat = () => {
    setWikiURL("");
    setUserQuestion("");
    setConversation([]);
    setIsLoading(false);
    setError(null);
    console.log("Chat reiniciado");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!wikiURL.trim()) {
      setError("Por favor, ingresa la URL del artículo de Wikipedia.");
      return;
    }
    if (!userQuestion.trim()) {
      setError("Por favor, ingresa tu pregunta.");
      return;
    }
    setError(null);
    setIsLoading(true);

    const currentQuestion = userQuestion;
    // Actualizar conversación con el mensaje del usuario inmediatamente
    setConversation((prev) => [
      ...prev,
      { sender: "user", text: currentQuestion },
    ]);
    setUserQuestion("");

    console.log("Enviando al backend:", {
      url: wikiURL,
      question: currentQuestion,
    });

    try {
      const response = await fetch("http://localhost:8000/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ url: wikiURL, question: currentQuestion }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          detail: `Error ${response.status} del servidor: ${response.statusText}. No se pudo leer el cuerpo del error.`,
        }));
        throw new Error(
          errorData.detail || `Error ${response.status} del servidor`
        );
      }

      const data = await response.json();

      // Actualizar conversación con la respuesta del bot
      setConversation((prev) => [
        ...prev,
        {
          sender: "bot",
          text: data.llm_answer,
          chunk: data.best_chunk,
          similarity: data.similarity_score,
          fromCache: data.from_cache,
        },
      ]);
    } catch (err) {
      console.error("Error en la llamada a la API:", err);
      const errorMessage =
        err.message || "Ocurrió un error al procesar la solicitud.";
      setError(errorMessage);
      // Opcional: añadir el error al chat
      // setConversation(prev => [
      //   ...prev,
      //   { sender: 'bot', text: `Error: ${errorMessage}` }
      // ]);
    } finally {
      setIsLoading(false); // Asegurar que isLoading se desactiva al final, ya sea éxito o error
    }
  };

  return (
    <Container className="my-4" style={{ maxWidth: "768px" }}>
      <Card>
        <Card.Header as="h2">Wikipedia Explainer Chat</Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            {" "}
            {/* Movimos el Form para que envuelva el input de pregunta y los botones */}
            <Form.Group className="mb-3">
              <Form.Label>
                URL del Artículo de Wikipedia (en inglés):
              </Form.Label>
              <Form.Control
                type="url"
                placeholder="https://en.wikipedia.org/wiki/..."
                value={wikiURL}
                onChange={(e) => setWikiURL(e.target.value)}
                disabled={isLoading}
                required
              />
            </Form.Group>
            {/* Área de la Conversación */}
            <div
              className="mb-3"
              style={{
                height: "400px",
                overflowY: "auto",
                border: "1px solid #dee2e6",
                padding: "10px",
                borderRadius: "0.25rem",
              }}
            >
              {conversation.map((msg, index) => (
                <div
                  key={index}
                  className={`d-flex mb-2 ${
                    msg.sender === "user"
                      ? "justify-content-end"
                      : "justify-content-start"
                  }`}
                >
                  <Card
                    bg={msg.sender === "user" ? "primary" : "light"}
                    text={msg.sender === "user" ? "white" : "dark"}
                    style={{
                      maxWidth: "75%",
                      padding: "0.5rem 1rem",
                      borderRadius:
                        msg.sender === "user"
                          ? "15px 15px 0 15px"
                          : "15px 15px 15px 0",
                      wordWrap: "break-word",
                    }}
                  >
                    <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
                    {msg.sender === "bot" && msg.chunk && (
                      <small
                        className="mt-2 d-block"
                        style={{
                          fontSize: "0.8em",
                          borderTop: "1px solid #ccc",
                          paddingTop: "5px",
                          color:
                            msg.sender === "user"
                              ? "rgba(255,255,255,0.8)"
                              : "#6c757d",
                        }}
                      >
                        Contexto (Sim: {msg.similarity?.toFixed(2)}
                        {msg.fromCache ? ", Caché" : ""}):{" "}
                        {msg.chunk.substring(0, 100)}...
                      </small>
                    )}
                  </Card>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {isLoading && (
              <div className="text-center my-2">
                <Spinner animation="border" size="sm" /> Procesando tu
                pregunta...
              </div>
            )}
            {error && (
              <Alert
                variant="danger"
                onClose={() => setError(null)}
                dismissible
              >
                {error}
              </Alert>
            )}
            <Form.Group className="mb-3">
              <Form.Label visuallyHidden>Tu Pregunta:</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Escribe tu pregunta sobre el artículo..."
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                disabled={isLoading}
                required
              />
            </Form.Group>
            {/* --- MODIFICACIÓN AQUÍ para los botones --- */}
            <Row>
              <Col>
                {" "}
                {/* Columna para el botón Nuevo Chat */}
                <Button
                  variant="outline-secondary"
                  onClick={handleNewChat}
                  className="w-100" // Para que ocupe el ancho de su columna
                  disabled={isLoading} // Deshabilitar si está cargando
                >
                  Nuevo Chat
                </Button>
              </Col>
              <Col>
                {" "}
                {/* Columna para el botón Enviar Pregunta */}
                <Button
                  variant="primary"
                  type="submit"
                  className="w-100" // Para que ocupe el ancho de su columna
                  disabled={isLoading || !wikiURL.trim()}
                >
                  {isLoading ? "Enviando..." : "Enviar Pregunta"}
                </Button>
              </Col>
            </Row>
            {/* Fin de la modificación de botones */}
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default ChatInterface;
 
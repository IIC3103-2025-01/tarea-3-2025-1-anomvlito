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
} from "react-bootstrap";

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
    if (e) e.preventDefault();

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

    const questionToSubmit = userQuestion;

    setConversation((prevConversation) => [
      ...prevConversation,
      { sender: "user", text: questionToSubmit },
    ]);
    setUserQuestion("");

    console.log("Enviando al backend:", {
      url: wikiURL,
      question: questionToSubmit,
    });

    try {
      const response = await fetch("http://localhost:8000/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ url: wikiURL, question: questionToSubmit }),
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

      setConversation((prevConversation) => [
        ...prevConversation,
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container className="my-4" style={{ maxWidth: "768px" }}>
      <Card>
        <Card.Header as="h2">Wikipedia Explainer Chat</Card.Header>
        <Card.Body>
          {/* El Formulario Principal ahora envuelve la URL, el área de pregunta y los botones de acción */}
          <Form onSubmit={handleSubmit}>
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
              {isLoading &&
                conversation.length > 0 &&
                conversation[conversation.length - 1].sender === "user" && (
                  <div className="d-flex justify-content-start mb-2">
                    <Card
                      bg="light"
                      text="dark"
                      style={{
                        maxWidth: "75%",
                        padding: "0.5rem 1rem",
                        borderRadius: "15px 15px 15px 0",
                      }}
                    >
                      <Spinner
                        animation="border"
                        size="sm"
                        as="span"
                        role="status"
                        aria-hidden="true"
                      />
                      <span className="ms-2">Pensando...</span>
                    </Card>
                  </div>
                )}
              <div ref={chatEndRef} />
            </div>

            {error && !isLoading && (
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!isLoading && wikiURL.trim() && userQuestion.trim()) {
                      handleSubmit(e);
                    }
                  }
                }}
              />
            </Form.Group>

            {/* Fila para los botones */}
            <Row className="mt-3">
              {" "}
              {/* Añadido un pequeño margen superior a la fila de botones */}
              <Col xs={12} md={6} className="mb-2 mb-md-0 d-grid">
                {" "}
                {/* d-grid para que el botón ocupe el ancho */}
                <Button
                  variant="outline-secondary"
                  onClick={handleNewChat}
                  disabled={isLoading}
                >
                  Nuevo Chat
                </Button>
              </Col>
              <Col xs={12} md={6} className="d-grid">
                {" "}
                {/* d-grid para que el botón ocupe el ancho */}
                <Button
                  variant="primary"
                  type="submit"
                  disabled={
                    isLoading || !wikiURL.trim() || !userQuestion.trim()
                  }
                >
                  {isLoading ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                      />
                      <span className="ms-2">Enviando...</span>
                    </>
                  ) : (
                    "Enviar Pregunta"
                  )}
                </Button>
              </Col>
            </Row>
          </Form>{" "}
          {/* Fin del Form principal */}
        </Card.Body>
      </Card>
    </Container>
  );
}

export default ChatInterface;

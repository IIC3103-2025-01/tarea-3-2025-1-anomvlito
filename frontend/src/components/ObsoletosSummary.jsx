// src/components/ObsoletosSummary.jsx
import React from "react";
import { ListGroup, Badge, Spinner, Alert, Card } from "react-bootstrap";
import { POLLING } from "../config/polling";
import { useApi } from "../hooks/useApi";

export default function ObsoletosSummary() {
  const { data, loading, error } = useApi("/api/obsoletos", {
    pollingInterval: POLLING.OBSOLETOS,
  });

  if (loading) {
    return (
      <div className="text-center py-2">
        <Spinner animation="border" size="sm" />
      </div>
    );
  }

  // Too Many Requests
  if (error?.startsWith?.("Error 429")) {
    return (
      <Alert variant="warning">
        🍵 Demasiadas peticiones. Por favor espera unos segundos antes de
        reintentar.
      </Alert>
    );
  }

  // Internal Server Error
  if (error?.startsWith?.("Error 500")) {
    return <Alert variant="warning">🤨 Espera un momentito👌</Alert>;
  }

  // cualquier otro error
  if (error) {
    return <Alert variant="danger">Error cargando espacios: {error}</Alert>;
  }

  const entries = Object.entries(data || {});

  if (entries.length === 0) {
    return (
      <Card.Text className="text-muted">
        No hay productos próximos a vencer.
      </Card.Text>
    );
  }

  return (
    <ListGroup variant="flush">
      {entries.map(([sku, items]) => (
        <ListGroup.Item
          key={sku}
          className="d-flex justify-content-between px-0 py-1"
        >
          <span>{sku}</span>
          <Badge bg="secondary">
            {items.length} {items.length === 1 ? "unidad" : "unidades"}
          </Badge>
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
}

// src/components/SpacesSummary.jsx
import React from "react";
import { ListGroup, Badge, Spinner, Alert } from "react-bootstrap";
import { POLLING } from "../config/polling";
import { useApi } from "../hooks/useApi";

export default function SpacesSummary() {
  const { data, loading, error } = useApi("/api/spaces", {
    pollingInterval: POLLING.SPACES,
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

  const spaces = data?.spaces || [];

  return (
    <ListGroup variant="flush">
      {spaces.map((s) => (
        <ListGroup.Item
          key={s.space_id}
          className="d-flex justify-content-between px-0 py-1"
        >
          <span className="text-capitalize">{s.type.replace("-", " ")}</span>
          <Badge bg="secondary">
            {s.used_space} / {s.total_space}
          </Badge>
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
}

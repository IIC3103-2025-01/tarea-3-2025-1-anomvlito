// src/components/OrdersPerHourCard.jsx
import React from "react";
import { Card, ListGroup, Badge, Spinner, Alert } from "react-bootstrap";
import { useApi } from "../hooks/useApi";

export default React.memo(function OrdersPerHourCard() {
  const { data, loading, error } = useApi("/api/orders_per_hour", {
    pollingInterval: 0,
  });

  if (loading)
    return (
      <div className="text-center py-4">
        <Spinner animation="border" role="status" />
      </div>
    );
  if (error) return <Alert variant="danger">Error: {error}</Alert>;

  // data es un array [{ hour: "...", order_count: N }, ...]
  const entries = Array.isArray(data) ? data : [];

  return (
    <Card className="h-100 shadow-sm border-primary">
      <Card.Body>
        <Card.Title as="h2" className="h5 mb-3">
          Pedidos por hora
        </Card.Title>

        {entries.length === 0 ? (
          <Card.Text className="text-muted">
            No hay pedidos en este rango de tiempo.
          </Card.Text>
        ) : (
          <ListGroup variant="flush">
            {entries.map(({ hour, order_count }) => {
              // parseamos la hora y solo mostramos HH:MM
              const date = new Date(hour);
              const label = date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <ListGroup.Item
                  key={hour}
                  className="d-flex justify-content-between px-0 py-1"
                >
                  <span>{label}</span>
                  <Badge bg="secondary">
                    {order_count} {order_count === 1 ? "pedido" : "pedidos"}
                  </Badge>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        )}
      </Card.Body>
    </Card>
  );
});

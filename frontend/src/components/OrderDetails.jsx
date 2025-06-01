// src/components/PedidosDetails.jsx
import React from "react";
import { useParams, Link } from "react-router-dom";
import { Container, Card, Spinner, Alert, Button } from "react-bootstrap";
import { useApi } from "../hooks/useApi";

export default function PedidosDetails() {
  const { id } = useParams();
  const {
    data: pedido,
    loading,
    error,
  } = useApi(`/api/pedidos/${id}`, {
    pollingInterval: 0,
  });

  if (loading)
    return (
      <div className="text-center py-4">
        <Spinner animation="border" role="status" />
      </div>
    );
  if (error) return <Alert variant="danger">Error: {error}</Alert>;
  if (!pedido) return <Alert variant="warning">Pedido no encontrado</Alert>;

  return (
    <Container className="py-4">
      <Card>
        <Card.Body>
          <Card.Title as="h2" className="h4 mb-3">
            Pedido #{pedido.id}
          </Card.Title>

          <Card.Text>
            <strong>Request ID:</strong> {pedido.request_id}
          </Card.Text>
          <Card.Text>
            <strong>SKU:</strong> {pedido.sku}
          </Card.Text>
          <Card.Text>
            <strong>Cantidad:</strong> {pedido.quantity}
          </Card.Text>
          <Card.Text>
            <strong>Estado:</strong> {pedido.status}
          </Card.Text>

          <Card.Text>
            <strong>Detalles completos:</strong>
          </Card.Text>
          <pre className="bg-light p-3 rounded">
            {JSON.stringify(pedido, null, 2)}
          </pre>

          <Button variant="link" as={Link} to="/">
            ← Volver atrás
          </Button>
        </Card.Body>
      </Card>
    </Container>
  );
}

// src/components/PedidosDetails.jsx
import React from "react";
import { useParams } from "react-router-dom";
import { Card, Table, Spinner, Alert, ListGroup } from "react-bootstrap";
import { useApi } from "../hooks/useApi";

export default function OrderDetails() {
  const { request_id } = useParams(); // recoge /pedido/:id
  const { data, loading, error } = useApi(`/api/order/${order_id}`, {
    pollingInterval: 0,
  });

  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" role="status" />
      </div>
    );
  }
  if (error) {
    return <Alert variant="danger">Error cargando detalles: {error}</Alert>;
  }
  if (!data) {
    return (
      <Alert variant="warning">
        Orden con ID <strong>{request_id}</strong> no encontrado.
      </Alert>
    );
  }

  // Data: id, request_id, sku, quantity, group, checked_out, available_at,
  //       created_at, received_at, status, product_ids:[…]
  const p = data;

  return (
    <Card className="shadow-sm border-secondary mt-4">
      <Card.Body>
        <Card.Title as="h2" className="h5 mb-3">
          Detalles de la Orden #{p.order_id}
        </Card.Title>

        <Table bordered size="sm" className="mb-3">
          <tbody>
            <tr>
              <th>ID interno</th>
              <td>{p.id}</td>
            </tr>
            <tr>
              <th>Request ID</th>
              <td>{p.order_id}</td>
            </tr>
            <tr>
              <th>SKU</th>
              <td>{p.sku}</td>
            </tr>
            <tr>
              <th>Cantidad</th>
              <td>{p.quantity}</td>
            </tr>
            <tr>
              <th>Estado</th>
              <td>{p.status}</td>
            </tr>
            <tr>
              <th>Creado</th>
              <td>{new Date(p.created_at).toLocaleString()}</td>
            </tr>
            <tr>
              <th>Recibido</th>
              <td>{new Date(p.received_at).toLocaleString()}</td>
            </tr>
            <tr>
              <th>Disponible en</th>
              <td>{new Date(p.available_at).toLocaleString()}</td>
            </tr>
          </tbody>
        </Table>

        <Card.Subtitle className="mb-2">Productos incluidos</Card.Subtitle>
        {p.product_ids.length === 0 ? (
          <p className="text-muted">No hay productos asociados.</p>
        ) : (
          <ListGroup>
            {p.product_ids.map((pid) => (
              <ListGroup.Item key={pid} className="px-2 py-1">
                {pid}
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card.Body>
    </Card>
  );
}

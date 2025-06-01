// src/components/PedidosTable.jsx
import React from "react";
import { Card, Table, Spinner, Alert } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";

export default function PedidosTable() {
  const { data, loading, error } = useApi("/api/pedidos", {
    pollingInterval: 0, // o el intervalo que prefieras
  });

  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" role="status" />
      </div>
    );
  }
  if (error) {
    return <Alert variant="danger">Error cargando pedidos: {error}</Alert>;
  }

  // la API devuelve { total, limit, offset, data: [ ... ] }
  const pedidos = data?.data || [];

  return (
    <Card className="shadow-sm border-primary">
      <Card.Body>
        <Card.Title as="h2" className="h5 mb-3">
          Últimos Pedidos (API Pedidos)
        </Card.Title>
        <div className="table-responsive">
          <Table striped hover className="mb-0">
            <thead className="table-light">
              <tr>
                {[
                  "ID",
                  "Request ID",
                  "SKU",
                  "Cantidad",
                  "Estado",
                  "Creado",
                  "Recibido",
                  "Detalle",
                ].map((h) => (
                  <th key={h} className="px-2 py-2 text-start text-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pedidos.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted py-3">
                    No hay pedidos.
                  </td>
                </tr>
              ) : (
                pedidos.map((p) => (
                  <tr key={p.id} className="align-middle">
                    <td className="px-2 py-2 text-nowrap">{p.id}</td>
                    <td className="px-2 py-2">{p.request_id}</td>
                    <td className="px-2 py-2">{p.sku}</td>
                    <td className="px-2 py-2">{p.quantity}</td>
                    <td className="px-2 py-2">{p.status}</td>
                    <td className="px-2 py-2 text-nowrap">
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-nowrap">
                      {new Date(p.received_at).toLocaleString()}
                    </td>
                    <td className="px-2 py-2">
                      <Link
                        to={`/pedido/${p.request_id}`}
                        className="text-decoration-none"
                      >
                        Ver más
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  );
}

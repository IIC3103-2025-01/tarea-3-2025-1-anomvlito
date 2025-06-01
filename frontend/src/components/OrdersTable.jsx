import React from "react";
import { Card, Table, Spinner, Alert } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";

export default function OrdersTable() {
  const { data, loading, error } = useApi("/api/orders?skip=0&limit=10");

  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" role="status" />
      </div>
    );
  }
  if (error) {
    return <Alert variant="danger">Error: {error}</Alert>;
  }

  const orders = data?.orders || [];

  return (
    <Card className="shadow-sm border-primary">
      <Card.Body>
        <Card.Title as="h2" className="h5 mb-3">
          Últimas Ordenes
        </Card.Title>
        <div className="table-responsive">
          <Table striped hover className="mb-0">
            <thead className="table-light">
              <tr>
                {[
                  "ID",
                  "Cliente",
                  "Proveedor",
                  "Canal",
                  "Estado",
                  "Creado",
                  "Actualizado",
                  "Detalle",
                ].map((h) => (
                  <th key={h} className="px-2 py-2 text-start text-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted py-3">
                    No hay pedidos.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.order_id} className="align-middle">
                    <td className="px-2 py-2 text-nowrap">{o.order_id}</td>
                    <td className="px-2 py-2">{o.client}</td>
                    <td className="px-2 py-2">{o.supplier}</td>
                    <td className="px-2 py-2">{o.channel}</td>
                    <td className="px-2 py-2">{o.status}</td>
                    <td className="px-2 py-2 text-nowrap">
                      {new Date(o.payload.createdAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-nowrap">
                      {new Date(o.payload.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-2">
                      <Link
                        to={`/pedido/${o.order_id}`}
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

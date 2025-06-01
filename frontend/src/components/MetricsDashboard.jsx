// src/components/MetricsDashboard.jsx
import React from "react";
import { Row, Col, Spinner } from "react-bootstrap"; // <-- Spinner agregado
import { POLLING } from "../config/polling";
import SpacesCard from "./SpacesCard";
import StockCard from "./StockCard";
import ObsoletosCard from "./ObsoletosCard";
import { useApi } from "../hooks/useApi";

export default function MetricsDashboard() {
  const { data: spacesData, loading: l1 } = useApi("/api/spaces", {
    pollingInterval: 0,
  });
  const spaces = spacesData?.spaces || [];

  // sólo mostramos spinner mientras cargan los espacios
  if (l1) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" role="status" />
      </div>
    );
  }

  return (
    <Row className="gy-4 align-items-stretch">
      <Col md={4}>
        <SpacesCard />
      </Col>
      <Col md={4}>
        <StockCard spaces={spaces} />
      </Col>
      <Col md={4}>
        <ObsoletosCard />
      </Col>
    </Row>
  );
}

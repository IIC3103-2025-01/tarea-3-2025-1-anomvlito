// src/components/ObsoletosCard.jsx
import React from "react";
import { Card } from "react-bootstrap";
import ObsoletosSummary from "./ObsoletosSummary";

export default React.memo(function ObsoletosCard() {
  return (
    <Card className="h-100 shadow-sm border-primary">
      <Card.Body>
        <Card.Title as="h2" className="h5 mb-3">
          Productos por vencer (±3h)
        </Card.Title>
        <ObsoletosSummary />
      </Card.Body>
    </Card>
  );
});

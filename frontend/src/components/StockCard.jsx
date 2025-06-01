// src/components/StockCard.jsx
import React from "react";
import { Card } from "react-bootstrap";
import StockSummary from "./StockSummary";

export default function StockCard({ spaces }) {
  return (
    <Card className="h-100 shadow-sm border-primary">
      <Card.Body>
        <Card.Title as="h2" className="h5 mb-3">
          Stock por SKU
        </Card.Title>
        <StockSummary spaces={spaces} />
      </Card.Body>
    </Card>
  );
}

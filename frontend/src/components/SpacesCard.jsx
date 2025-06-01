// src/components/SpacesCard.jsx
import React from "react";
import { Card } from "react-bootstrap";
import SpacesSummary from "./SpacesSummary";

export default function SpacesCard() {
  return (
    <Card className="h-100 shadow-sm border-primary">
      <Card.Body>
        <Card.Title as="h2" className="h5 mb-3">
          Espacios por Sector
        </Card.Title>
        <SpacesSummary />
      </Card.Body>
    </Card>
  );
}

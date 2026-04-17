package model

import (
    "encoding/json"
    "time"
)

// Envelope correspond à l'enveloppe standard
type Envelope struct {
    EventID       string          `json:"eventId"`
    EventType     string          `json:"eventType"`
    Version       string          `json:"version"`
    Timestamp     time.Time       `json:"timestamp"`
    Source        string          `json:"source"`
    CorrelationID *string         `json:"correlationId"` // nullable (cf. position.updated)
    Payload       json.RawMessage `json:"payload"`
}

// ---  geofence.alert ---
type GeofenceAlertPayload struct {
    VehiculeID string  `json:"vehiculeId"`
    ZoneID     string  `json:"zoneId"`
    NomZone    string  `json:"nomZone"`
    TypeAlerte string  `json:"typeAlerte"` // "ENTREE" | "SORTIE"
    Latitude   float64 `json:"latitude"`
    Longitude  float64 `json:"longitude"`
}

// --- Payload : maintenance.planned ---
type MaintenancePlannedPayload struct {
    MaintenanceID string    `json:"maintenanceId"`
    VehiculeID    string    `json:"vehiculeId"`
    Type          string    `json:"type"` // PREVENTIVE | CORRECTIVE | URGENTE
    DatePlanifiee time.Time `json:"datePlanifiee"`
    TechnicienID  string    `json:"technicienId"`
}

// --- Payload : vehicule.statut_changed ---
type VehiculeStatutChangedPayload struct {
    VehiculeID  string `json:"vehiculeId"`
    StatutAvant string `json:"statutAvant"`
    StatutApres string `json:"statutApres"`
    Motif       string `json:"motif"`       // "Panne" déclenche l'alerte manager
    ModifiePar  string `json:"modifiePar"`
}
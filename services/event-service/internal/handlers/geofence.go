package handlers

import (
    "context"
    "encoding/json"
    "fmt"

    "event-service/internal/model"
    "event-service/internal/notifier"
)

type GeofenceHandler struct {
    notifier notifier.Notifier
}

func NewGeofenceHandler(n notifier.Notifier) *GeofenceHandler {
    return &GeofenceHandler{notifier: n}
}

func (h *GeofenceHandler) Handle(ctx context.Context, env model.Envelope) error {
    var p model.GeofenceAlertPayload
    if err := json.Unmarshal(env.Payload, &p); err != nil {
        return fmt.Errorf("geofence handler: unmarshal: %w", err)
    }

    // Formulation selon ENTREE ou SORTIE 
    action := "est entré dans"
    if p.TypeAlerte == "SORTIE" {
        action = "est sorti de"
    }

    return h.notifier.Notify(ctx, notifier.Notification{
        Level:   notifier.LevelCritical,
        Service: env.Source, // "service-localisation"
        Title:   fmt.Sprintf("🚨 Alerte Géofence — %s — %s", p.TypeAlerte, p.NomZone),
        Body: fmt.Sprintf(
            "Véhicule %s %s la zone interdite « %s » (zoneId: %s). Position: %.6f, %.6f",
            p.VehiculeID, action, p.NomZone, p.ZoneID, p.Latitude, p.Longitude,
        ),
        Metadata: map[string]string{
            "vehiculeId":  p.VehiculeID,
            "zoneId":      p.ZoneID,
            "typeAlerte":  p.TypeAlerte,
            "correlationId": safeCorrelationID(env.CorrelationID),
        },
        CreatedAt: env.Timestamp,
    })
}
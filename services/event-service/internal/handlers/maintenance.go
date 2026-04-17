package handlers

import (
    "context"
    "encoding/json"
    "fmt"

    "event-service/internal/model"
    "event-service/internal/notifier"
)

type MaintenanceHandler struct {
    notifier notifier.Notifier
}

func NewMaintenanceHandler(n notifier.Notifier) *MaintenanceHandler {
    return &MaintenanceHandler{notifier: n}
}

func (h *MaintenanceHandler) Handle(ctx context.Context, env model.Envelope) error {
    var p model.MaintenancePlannedPayload
    if err := json.Unmarshal(env.Payload, &p); err != nil {
        return fmt.Errorf("maintenance handler: unmarshal: %w", err)
    }

    return h.notifier.Notify(ctx, notifier.Notification{
        Level:   notifier.LevelInfo,
        Service: env.Source,
        Title:   fmt.Sprintf("📅 Maintenance planifiée — %s", p.Type),
        Body: fmt.Sprintf(
            "Maintenance %s prévue pour le véhicule %s le %s. Technicien: %s (id: %s)",
            p.Type,
            p.VehiculeID,
            p.DatePlanifiee.Format("02/01/2006 à 15h04"),
            p.TechnicienID,
            p.MaintenanceID,
        ),
        Metadata: map[string]string{
            "maintenanceId": p.MaintenanceID,
            "vehiculeId":    p.VehiculeID,
            "type":          p.Type,
            "correlationId": safeCorrelationID(env.CorrelationID),
        },
        CreatedAt: env.Timestamp,
    })
}
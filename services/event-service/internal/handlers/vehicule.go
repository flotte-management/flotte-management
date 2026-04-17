package handlers

import (
    "context"
    "encoding/json"
    "fmt"
    "strings"

    "event-service/internal/model"
    "event-service/internal/notifier"
)

type VehiculeHandler struct {
    notifier notifier.Notifier
}

func NewVehiculeHandler(n notifier.Notifier) *VehiculeHandler {
    return &VehiculeHandler{notifier: n}
}

// Handle gère vehicule.statut_changed.
// Alerte manager UNIQUEMENT si motif == "Panne".
func (h *VehiculeHandler) Handle(ctx context.Context, env model.Envelope) error {
    var p model.VehiculeStatutChangedPayload
    if err := json.Unmarshal(env.Payload, &p); err != nil {
        return fmt.Errorf("vehicule handler: unmarshal: %w", err)
    }

    // Seul le motif "Panne" génère une alerte — les autres changements sont ignorés
    if !strings.EqualFold(p.Motif, "Panne") {
        return nil
    }

    return h.notifier.Notify(ctx, notifier.Notification{
        Level:   notifier.LevelCritical,
        Service: env.Source,
        Title:   fmt.Sprintf("🔴 PANNE — Véhicule %s", p.VehiculeID),
        Body: fmt.Sprintf(
            "Véhicule %s en panne. Statut: %s → %s. Motif: %s. Signalé par: %s",
            p.VehiculeID, p.StatutAvant, p.StatutApres, p.Motif, p.ModifiePar,
        ),
        Metadata: map[string]string{
            "vehiculeId":    p.VehiculeID,
            "statutAvant":   p.StatutAvant,
            "statutApres":   p.StatutApres,
            "motif":         p.Motif,
            "modifiePar":    p.ModifiePar,
            "correlationId": safeCorrelationID(env.CorrelationID),
        },
        CreatedAt: env.Timestamp,
    })
}

// helper partagé par tous les handlers
func safeCorrelationID(s *string) string {
    if s == nil {
        return ""
    }
    return *s
}
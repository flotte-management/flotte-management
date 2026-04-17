package dispatcher

import (
    "context"
    "encoding/json"
    "fmt"
    "log/slog"

    "event-service/internal/handlers"
    "event-service/internal/model"
)

type Dispatcher struct {
    geofenceHandler   *handlers.GeofenceHandler
    maintenanceHandler *handlers.MaintenanceHandler
    vehiculeHandler   *handlers.VehiculeHandler
    logger            *slog.Logger
}

func New(
    g *handlers.GeofenceHandler,
    m *handlers.MaintenanceHandler,
    v *handlers.VehiculeHandler,
    logger *slog.Logger,
) *Dispatcher {
    return &Dispatcher{
        geofenceHandler:   g,
        maintenanceHandler: m,
        vehiculeHandler:   v,
        logger:            logger,
    }
}

func (d *Dispatcher) Dispatch(ctx context.Context, raw []byte) error {
    var env model.Envelope
    if err := json.Unmarshal(raw, &env); err != nil {
        return fmt.Errorf("dispatch: unmarshal envelope: %w", err)
    }

    d.logger.InfoContext(ctx, "event dispatching",
        "eventId", env.EventID,
        "eventType", env.EventType,
        "source", env.Source,
        "version", env.Version,
    )

    switch env.EventType {

    //  — flotte.localisation
    case "geofence.alert":
        return d.geofenceHandler.Handle(ctx, env)

    // — flotte.maintenances
    case "maintenance.planned":
        return d.maintenanceHandler.Handle(ctx, env)

    // — flotte.vehicules (filtre motif "Panne" dans le handler)
    case "vehicule.statut_changed":
        return d.vehiculeHandler.Handle(ctx, env)

    // Tous les autres eventTypes sont ignorés silencieusement
    default:
        d.logger.DebugContext(ctx, "event type not handled, skipping",
            "eventType", env.EventType,
        )
        return nil
    }
}
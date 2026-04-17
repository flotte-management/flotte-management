package notifier

import (
    "context"
    "log/slog"
    "time"
)

// Niveau de priorité d'une notification
type Level string

const (
    LevelInfo     Level = "INFO"
    LevelWarning  Level = "WARNING"
    LevelCritical Level = "CRITICAL"
)

// Notification représente un message à dispatcher
type Notification struct {
    Level     Level
    Service   string // Service métier concerné
    Title     string
    Body      string
    Metadata  map[string]string
    CreatedAt time.Time
}

// Notifier est l'interface principale — implémentable par tout canal (log, webhook, SMS…)
type Notifier interface {
    Notify(ctx context.Context, n Notification) error
}

// --- Implémentation Log (dev / prod sans canal externe) ---

type LogNotifier struct {
    logger *slog.Logger
}

func NewLogNotifier(logger *slog.Logger) *LogNotifier {
    return &LogNotifier{logger: logger}
}

func (n *LogNotifier) Notify(ctx context.Context, notif Notification) error {
    attrs := []any{
        "level", string(notif.Level),
        "service", notif.Service,
        "title", notif.Title,
        "body", notif.Body,
        "createdAt", notif.CreatedAt.Format(time.RFC3339),
    }
    for k, v := range notif.Metadata {
        attrs = append(attrs, k, v)
    }

    switch notif.Level {
    case LevelCritical:
        n.logger.ErrorContext(ctx, "NOTIFICATION_CRITICAL", attrs...)
    case LevelWarning:
        n.logger.WarnContext(ctx, "NOTIFICATION_WARNING", attrs...)
    default:
        n.logger.InfoContext(ctx, "NOTIFICATION_INFO", attrs...)
    }
    return nil
}

// --- Implémentation Multi (fan-out vers plusieurs canaux) ---

type MultiNotifier struct {
    notifiers []Notifier
}

func NewMultiNotifier(nn ...Notifier) *MultiNotifier {
    return &MultiNotifier{notifiers: nn}
}

func (m *MultiNotifier) Notify(ctx context.Context, n Notification) error {
    var lastErr error
    for _, notifier := range m.notifiers {
        if err := notifier.Notify(ctx, n); err != nil {
            lastErr = err
        }
    }
    return lastErr
}
package main

import (
    "context"
    "log/slog"
    "os"
    "os/signal"
    "syscall"

    "event-service/internal/consumer"
    "event-service/internal/dispatcher"
    "event-service/internal/handlers"
    "event-service/internal/notifier"
)

func main() {
    logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelDebug,
    }))

    slog.SetDefault(logger)

    // Notifier : log structuré JSON (extensible MultiNotifier)
    n := notifier.NewLogNotifier(logger)

    // Handlers métier
    geofenceH    := handlers.NewGeofenceHandler(n)
    maintenanceH := handlers.NewMaintenanceHandler(n)
    vehiculeH    := handlers.NewVehiculeHandler(n)

    // Dispatcher
    d := dispatcher.New(geofenceH, maintenanceH, vehiculeH, logger)

    // Kafka Consumer
    // workerPool=4 par partition
    // → flotte.localisation (12 partitions) = 12 goroutines I/O + 48 workers max
    kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
    kc, err := consumer.NewKafkaConsumer(
        []string{kafkaBrokers},
        "event-service-group",
        d,
        logger,
        4,
    )
    if err != nil {
        logger.Error("failed to create kafka consumer", "error", err)
        logger.Error("failed to create kafka consumer", "error", err)
        os.Exit(1)
    }

    // Graceful shutdown sur SIGINT / SIGTERM
    ctx, cancel := signal.NotifyContext(context.Background(),
        syscall.SIGINT, syscall.SIGTERM,
    )
    defer cancel()

    logger.Info("event-service started",
        "brokers", kafkaBrokers,
        "topics", consumer.Topics,
    )

    if err := kc.Start(ctx); err != nil {
        logger.Error("consumer stopped with error", "error", err)
        kc.Close()
        os.Exit(1)
    }

    kc.Close()
    logger.Info("event-service stopped gracefully")
}

func getEnv(key, fallback string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return fallback
}
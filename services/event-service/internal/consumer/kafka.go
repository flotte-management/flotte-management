package consumer

import (
    "context"
    "fmt"
    "log/slog"
    "sync"

    "github.com/IBM/sarama"
    "event-service/internal/dispatcher"
)

// Topics 
var Topics = []string{
    "flotte.vehicules",    // 6 partitions
    "flotte.conducteurs",  // 3 partitions
    "flotte.maintenances", // 3 partitions
    "flotte.localisation", // 12 partitions ← fort débit GPS
    "flotte.missions",     // 6 partitions
}

type KafkaConsumer struct {
    client     sarama.ConsumerGroup
    dispatcher *dispatcher.Dispatcher
    logger     *slog.Logger
    workerPool int
}

func NewKafkaConsumer(
    brokers []string,
    groupID string,
    d *dispatcher.Dispatcher,
    logger *slog.Logger,
    workerPool int,
) (*KafkaConsumer, error) {
    cfg := sarama.NewConfig()
    cfg.Version = sarama.V3_3_0_0
    cfg.Consumer.Group.Rebalance.GroupStrategies = []sarama.BalanceStrategy{
        sarama.NewBalanceStrategyRoundRobin(),
    }
    cfg.Consumer.Offsets.Initial = sarama.OffsetNewest
    cfg.Consumer.Offsets.AutoCommit.Enable = false 
    cfg.Consumer.Return.Errors = true

    client, err := sarama.NewConsumerGroup(brokers, groupID, cfg)
    if err != nil {
        return nil, fmt.Errorf("kafka: new consumer group: %w", err)
    }

    return &KafkaConsumer{
        client:     client,
        dispatcher: d,
        logger:     logger,
        workerPool: workerPool,
    }, nil
}

func (kc *KafkaConsumer) Start(ctx context.Context) error {
    handler := &groupHandler{
        dispatcher: kc.dispatcher,
        logger:     kc.logger,
        workerPool: kc.workerPool,
    }

    // Boucle de reconnexion automatique après rebalancing
    for {
        if err := kc.client.Consume(ctx, Topics, handler); err != nil {
            return fmt.Errorf("kafka consume loop: %w", err)
        }
        if ctx.Err() != nil {
            kc.logger.Info("kafka consumer stopped by context")
            return nil
        }
    }
}

func (kc *KafkaConsumer) Close() error {
    return kc.client.Close()
}

// ---- Handler Sarama ----

type groupHandler struct {
    dispatcher *dispatcher.Dispatcher
    logger     *slog.Logger
    workerPool int
}

func (h *groupHandler) Setup(s sarama.ConsumerGroupSession) error {
    h.logger.Info("consumer group session setup", "memberID", s.MemberID())
    return nil
}

func (h *groupHandler) Cleanup(s sarama.ConsumerGroupSession) error {
    h.logger.Info("consumer group session cleanup", "memberID", s.MemberID())
    return nil
}

// ConsumeClaim est appelé UNE FOIS PAR PARTITION assignée au consumer.
// Pour flotte.localisation (12 partitions) → 12 goroutines parallèles.
// Chaque goroutine alimente un pool de `workerPool` goroutines worker.
func (h *groupHandler) ConsumeClaim(
    session sarama.ConsumerGroupSession,
    claim sarama.ConsumerGroupClaim,
) error {
    // Buffer = 2x le pool pour absorber les micro-bursts sans bloquer la lecture Kafka
    jobs := make(chan *sarama.ConsumerMessage, h.workerPool*2)

    var wg sync.WaitGroup
    for i := range h.workerPool {
        wg.Add(1)
        go func(workerID int) {
            defer wg.Done()
            for msg := range jobs {
                if err := h.dispatcher.Dispatch(session.Context(), msg.Value); err != nil {
                    h.logger.ErrorContext(session.Context(), "dispatch failed",
                        "error", err,
                        "topic", msg.Topic,
                        "partition", msg.Partition,
                        "offset", msg.Offset,
                        "worker", workerID,
                    )
                    // Pas de MarkMessage → offset non commité → replay possible
                    continue
                }
                // Commit offset uniquement après dispatch réussi (at-least-once)
                session.MarkMessage(msg, "")
            }
        }(i)
    }

    for msg := range claim.Messages() {
        select {
        case jobs <- msg:
        case <-session.Context().Done():
            close(jobs)
            wg.Wait()
            return nil
        }
    }

    close(jobs)
    wg.Wait()
    return nil
}
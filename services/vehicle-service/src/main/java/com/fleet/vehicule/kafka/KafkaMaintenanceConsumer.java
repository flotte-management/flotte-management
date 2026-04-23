package com.fleet.vehicule.kafka;

import java.util.Map;
import java.util.UUID;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

import com.fleet.vehicule.domain.StatutVehicule;
import com.fleet.vehicule.dto.VehiculeDTO;
import com.fleet.vehicule.service.VehiculeService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Consumes events from flotte.maintenances to update vehicle status
 * as part of the maintenance Saga choreography.
 *
 * maintenance.started  → EN_MAINTENANCE
 * maintenance.completed → DISPONIBLE
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class KafkaMaintenanceConsumer {

    private final VehiculeService vehiculeService;
    private final KafkaVehiculeProducer kafkaProducer;

    @SuppressWarnings("unchecked")
    @KafkaListener(
            topics = "flotte.maintenances",
            groupId = "vehicle-service-group",
            containerFactory = "kafkaListenerContainerFactory"
    )
    public void onMaintenanceEvent(ConsumerRecord<String, Map> record, Acknowledgment ack) {
        try {
            Map<String, Object> envelope = record.value();
            if (envelope == null) {
                ack.acknowledge();
                return;
            }

            String eventType = (String) envelope.get("eventType");
            Map<String, Object> payload = (Map<String, Object>) envelope.get("payload");
            String correlationId = (String) envelope.get("correlationId");

            if (payload == null) {
                log.warn("Maintenance event without payload, eventType={}", eventType);
                ack.acknowledge();
                return;
            }

            log.info("Maintenance event received: type={} correlationId={}", eventType, correlationId);

            switch (String.valueOf(eventType)) {
                case "maintenance.started" -> handleMaintenanceStarted(payload, correlationId);
                case "maintenance.completed" -> handleMaintenanceCompleted(payload, correlationId);
                default -> log.debug("Ignored maintenance event: {}", eventType);
            }

            ack.acknowledge();

        } catch (Exception ex) {
            log.error("Error processing maintenance event from partition={} offset={}: {}",
                    record.partition(), record.offset(), ex.getMessage(), ex);
            // Do NOT acknowledge → message will be replayed (at-least-once semantics)
            // In production, add retry/DLQ configuration here
        }
    }

    private void handleMaintenanceStarted(Map<String, Object> payload, String correlationId) {
        String vehiculeIdStr = (String) payload.get("vehiculeId");
        if (vehiculeIdStr == null) return;

        UUID vehiculeId = UUID.fromString(vehiculeIdStr);
        try {
            VehiculeDTO.StatutRequest req = new VehiculeDTO.StatutRequest();
            req.setStatut(StatutVehicule.EN_MAINTENANCE);
            req.setMotif("Maintenance démarrée (saga)");

            vehiculeService.changerStatut(vehiculeId, req, KafkaVehiculeProducer.SYSTEM_UUID);
            log.info("Vehicle {} set to EN_MAINTENANCE (maintenance.started)", vehiculeId);

        } catch (Exception ex) {
            log.error("Failed to set vehicle {} to EN_MAINTENANCE: {}", vehiculeId, ex.getMessage());
            throw ex; // rethrow so offset is not committed
        }
    }

    private void handleMaintenanceCompleted(Map<String, Object> payload, String correlationId) {
        String vehiculeIdStr = (String) payload.get("vehiculeId");
        if (vehiculeIdStr == null) return;

        UUID vehiculeId = UUID.fromString(vehiculeIdStr);
        try {
            VehiculeDTO.StatutRequest req = new VehiculeDTO.StatutRequest();
            req.setStatut(StatutVehicule.DISPONIBLE);
            req.setMotif("Maintenance terminée (saga)");

            vehiculeService.changerStatut(vehiculeId, req, KafkaVehiculeProducer.SYSTEM_UUID);
            log.info("Vehicle {} set to DISPONIBLE (maintenance.completed)", vehiculeId);

        } catch (Exception ex) {
            log.error("Failed to set vehicle {} to DISPONIBLE: {}", vehiculeId, ex.getMessage());
            throw ex;
        }
    }
}

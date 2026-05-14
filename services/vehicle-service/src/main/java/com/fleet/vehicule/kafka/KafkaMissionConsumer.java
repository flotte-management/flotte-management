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
 * Consumes events from flotte.missions to update vehicle status
 * as part of the mission Saga choreography.
 *
 * mission.created/mission.started  → EN_SERVICE
 * mission.completed/mission.cancelled → DISPONIBLE
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class KafkaMissionConsumer {

    private final VehiculeService vehiculeService;
    private final KafkaVehiculeProducer kafkaProducer;

    @SuppressWarnings("unchecked")
    @KafkaListener(
            topics = "flotte.missions",
            groupId = "vehicle-service-group",
            containerFactory = "kafkaListenerContainerFactory"
    )
    public void onMissionEvent(ConsumerRecord<String, Map> record, Acknowledgment ack) {
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
                log.warn("Mission event without payload, eventType={}", eventType);
                ack.acknowledge();
                return;
            }

            log.info("Mission event received: type={} correlationId={}", eventType, correlationId);

            switch (String.valueOf(eventType)) {
                case "mission.created", "mission.started" -> handleMissionInProgress(payload, eventType);
                case "mission.completed", "mission.cancelled" -> handleMissionEnded(payload, eventType);
                default -> log.debug("Ignored mission event: {}", eventType);
            }

            ack.acknowledge();

        } catch (Exception ex) {
            log.error("Error processing mission event from partition={} offset={}: {}",
                    record.partition(), record.offset(), ex.getMessage(), ex);
            // Do NOT acknowledge → message will be replayed (at-least-once semantics)
        }
    }

    private void handleMissionInProgress(Map<String, Object> payload, String eventType) {
        String vehiculeIdStr = (String) payload.get("vehiculeId");
        if (vehiculeIdStr == null) return;

        UUID vehiculeId = UUID.fromString(vehiculeIdStr);
        try {
            VehiculeDTO.StatutRequest req = new VehiculeDTO.StatutRequest();
            req.setStatut(StatutVehicule.EN_SERVICE);
            req.setMotif("Mission en cours (saga)" + " — " + eventType);

            vehiculeService.changerStatut(vehiculeId, req, KafkaVehiculeProducer.SYSTEM_UUID);
            log.info("Vehicle {} set to EN_SERVICE ({})", vehiculeId, eventType);

        } catch (Exception ex) {
            log.error("Failed to set vehicle {} to EN_SERVICE: {}", vehiculeId, ex.getMessage());
            throw ex;
        }
    }

    private void handleMissionEnded(Map<String, Object> payload, String eventType) {
        String vehiculeIdStr = (String) payload.get("vehiculeId");
        if (vehiculeIdStr == null) return;

        UUID vehiculeId = UUID.fromString(vehiculeIdStr);
        try {
            VehiculeDTO.StatutRequest req = new VehiculeDTO.StatutRequest();
            req.setStatut(StatutVehicule.DISPONIBLE);
            req.setMotif("Mission terminée/annulée (saga)" + " — " + eventType);

            vehiculeService.changerStatut(vehiculeId, req, KafkaVehiculeProducer.SYSTEM_UUID);
            log.info("Vehicle {} set to DISPONIBLE ({})", vehiculeId, eventType);

        } catch (Exception ex) {
            log.error("Failed to set vehicle {} to DISPONIBLE: {}", vehiculeId, ex.getMessage());
            throw ex;
        }
    }
}


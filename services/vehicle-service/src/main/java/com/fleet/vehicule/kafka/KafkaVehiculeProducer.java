package com.fleet.vehicule.kafka;

import com.fleet.vehicule.domain.StatutVehicule;
import com.fleet.vehicule.domain.Vehicule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class KafkaVehiculeProducer {

    private static final String TOPIC = "flotte.vehicules";

    private final KafkaTemplate<String, Map<String, Object>> kafkaTemplate;

    public void publishCreated(Vehicule v) {
        Map<String, Object> payload = Map.of(
                "id", v.getId().toString(),
                "immatriculation", v.getImmatriculation(),
                "marque", v.getMarque(),
                "modele", v.getModele(),
                "annee", v.getAnnee(),
                "typeCarburant", v.getTypeCarburant().name(),
                "statut", v.getStatut().name(),
                "kilometrage", v.getKilometrage()
        );
        send("vehicule.created", v.getId().toString(), payload, null);
    }

    public void publishStatutChanged(Vehicule v, StatutVehicule avant, StatutVehicule apres,
                                     String motif, UUID modifiePar) {
        Map<String, Object> payload = Map.of(
                "vehiculeId", v.getId().toString(),
                "statutAvant", avant.name(),
                "statutApres", apres.name(),
                "motif", motif != null ? motif : "",
                "modifiePar", modifiePar.toString()
        );
        send("vehicule.statut_changed", v.getId().toString(), payload, null);
    }

    public void publishDeleted(Vehicule v, UUID modifiePar) {
        Map<String, Object> payload = Map.of(
                "vehiculeId", v.getId().toString(),
                "deletedAt", Instant.now().toString(),
                "deletedBy", modifiePar.toString()
        );
        send("vehicule.deleted", v.getId().toString(), payload, null);
    }

    // ─── Enveloppe standard ───────────────────────────────────────────────────

    private void send(String eventType, String key, Map<String, Object> payload, String correlationId) {
        Map<String, Object> envelope = new java.util.LinkedHashMap<>();
        envelope.put("eventId", UUID.randomUUID().toString());
        envelope.put("eventType", eventType);
        envelope.put("version", "1.0");
        envelope.put("timestamp", Instant.now().toString());
        envelope.put("source", "service-vehicules");
        envelope.put("correlationId", correlationId);
        envelope.put("payload", payload);

        kafkaTemplate.send(TOPIC, key, envelope)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Erreur publication Kafka [{}] key={}: {}", eventType, key, ex.getMessage());
                    } else {
                        log.debug("Kafka publié [{}] key={} offset={}", eventType, key,
                                result.getRecordMetadata().offset());
                    }
                });
    }
}

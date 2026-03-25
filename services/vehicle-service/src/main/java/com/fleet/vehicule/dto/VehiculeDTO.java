package com.fleet.vehicule.dto;

import com.fleet.vehicule.domain.StatutVehicule;
import com.fleet.vehicule.domain.TypeCarburant;
import jakarta.validation.constraints.*;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

// ─── Requêtes ───────────────────────────────────────────────────────────────

public class VehiculeDTO {

    @Data
    public static class CreateRequest {
        @NotBlank @Size(max = 10)
        private String immatriculation;

        @NotBlank @Size(max = 50)
        private String marque;

        @NotBlank @Size(max = 50)
        private String modele;

        @NotNull @Min(1990) @Max(2100)
        private Short annee;

        @NotNull
        private TypeCarburant typeCarburant;
    }

    @Data
    public static class UpdateRequest {
        @Size(max = 50)
        private String marque;

        @Size(max = 50)
        private String modele;

        @Min(1990) @Max(2100)
        private Short annee;

        private TypeCarburant typeCarburant;

        @Min(0)
        private Integer kilometrage;
    }

    @Data
    public static class StatutRequest {
        @NotNull
        private StatutVehicule statut;

        @Size(max = 255)
        private String motif;
    }

    // ─── Réponses ───────────────────────────────────────────────────────────

    @Data @Builder
    public static class Response {
        private UUID id;
        private String immatriculation;
        private String marque;
        private String modele;
        private Short annee;
        private TypeCarburant typeCarburant;
        private StatutVehicule statut;
        private Integer kilometrage;
        private Instant createdAt;
        private Instant updatedAt;
    }

    @Data @Builder
    public static class HistoriqueResponse {
        private UUID id;
        private UUID vehiculeId;
        private StatutVehicule statutAvant;
        private StatutVehicule statutApres;
        private String motif;
        private UUID modifiePar;
        private Instant modifieLe;
    }

    @Data @Builder
    public static class PageResponse<T> {
        private java.util.List<T> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean last;
    }
}

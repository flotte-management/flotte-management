package com.fleet.vehicule.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "historique_statut")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HistoriqueStatut {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vehicule_id", nullable = false)
    private Vehicule vehicule;

    @Enumerated(EnumType.STRING)
    @Column(name = "statut_avant", nullable = false)
    private StatutVehicule statutAvant;

    @Enumerated(EnumType.STRING)
    @Column(name = "statut_apres", nullable = false)
    private StatutVehicule statutApres;

    @Column(length = 255)
    private String motif;

    @Column(name = "modifie_par", nullable = false)
    private UUID modifiePar;

    @Column(name = "modifie_le", nullable = false, updatable = false)
    @Builder.Default
    private Instant modifieLe = Instant.now();
}

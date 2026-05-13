package com.fleet.vehicule.repository;

import com.fleet.vehicule.domain.Vehicule;
import com.fleet.vehicule.domain.StatutVehicule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface VehiculeRepository extends JpaRepository<Vehicule, UUID> {

    // @SQLRestriction filtre automatiquement deleted_at IS NULL
    Page<Vehicule> findAll(Pageable pageable);

    Page<Vehicule> findByStatut(StatutVehicule statut, Pageable pageable);

    Page<Vehicule> findByMarqueContainingIgnoreCase(String marque, Pageable pageable);

    Page<Vehicule> findByStatutAndMarqueContainingIgnoreCase(
            StatutVehicule statut, String marque, Pageable pageable);

    boolean existsByImmatriculation(String immatriculation);

    long countByStatut(StatutVehicule statut);
}

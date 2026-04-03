package com.fleet.vehicule.repository;

import com.fleet.vehicule.domain.HistoriqueStatut;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface HistoriqueStatutRepository extends JpaRepository<HistoriqueStatut, UUID> {

    Page<HistoriqueStatut> findByVehiculeIdOrderByModifieLeDesc(UUID vehiculeId, Pageable pageable);
}

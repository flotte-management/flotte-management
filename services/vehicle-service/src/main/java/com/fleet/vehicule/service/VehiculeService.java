package com.fleet.vehicule.service;

import com.fleet.vehicule.domain.StatutVehicule;
import com.fleet.vehicule.dto.VehiculeDTO;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface VehiculeService {

    VehiculeDTO.Response creer(VehiculeDTO.CreateRequest request);

    VehiculeDTO.PageResponse<VehiculeDTO.Response> lister(
            StatutVehicule statut, String marque, Pageable pageable);

    VehiculeDTO.Response trouverParId(UUID id);

    VehiculeDTO.Response modifier(UUID id, VehiculeDTO.UpdateRequest request);

    void supprimer(UUID id, UUID modifiePar);

    VehiculeDTO.Response changerStatut(UUID id, VehiculeDTO.StatutRequest request, UUID modifiePar);

    VehiculeDTO.PageResponse<VehiculeDTO.HistoriqueResponse> historique(UUID id, Pageable pageable);
}

package com.fleet.vehicule.controller;

import com.fleet.vehicule.domain.StatutVehicule;
import com.fleet.vehicule.dto.VehiculeDTO;
import com.fleet.vehicule.service.VehiculeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vehicules")
@RequiredArgsConstructor
public class VehiculeController {

    private static final UUID SYSTEM_ACTOR_ID = UUID.fromString("00000000-0000-0000-0000-000000000000");

    private final VehiculeService vehiculeService;

    /**
     * GET /api/v1/vehicules
     * Tous les rôles — paginé, filtrable par statut et/ou marque
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'TECHNICIEN', 'UTILISATEUR')")
    public ResponseEntity<VehiculeDTO.PageResponse<VehiculeDTO.Response>> lister(
            @RequestParam(required = false) StatutVehicule statut,
            @RequestParam(required = false) String marque,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(vehiculeService.lister(statut, marque, pageable));
    }

    /**
     * POST /api/v1/vehicules
     * Réservé ADMIN et MANAGER
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<VehiculeDTO.Response> creer(
            @Valid @RequestBody VehiculeDTO.CreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(vehiculeService.creer(request));
    }

    /**
     * GET /api/v1/vehicules/{id}
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'TECHNICIEN', 'UTILISATEUR')")
    public ResponseEntity<VehiculeDTO.Response> detail(@PathVariable UUID id) {
        return ResponseEntity.ok(vehiculeService.trouverParId(id));
    }

    /**
     * PUT /api/v1/vehicules/{id}
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<VehiculeDTO.Response> modifier(
            @PathVariable UUID id,
            @Valid @RequestBody VehiculeDTO.UpdateRequest request) {
        return ResponseEntity.ok(vehiculeService.modifier(id, request));
    }

    /**
     * DELETE /api/v1/vehicules/{id} — soft-delete
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> supprimer(
            @PathVariable UUID id,
            Authentication authentication) {
        vehiculeService.supprimer(id, extractActorId(authentication));
        return ResponseEntity.noContent().build();
    }

    /**
     * PATCH /api/v1/vehicules/{id}/statut
     */
    @PatchMapping("/{id}/statut")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'TECHNICIEN')")
    public ResponseEntity<VehiculeDTO.Response> changerStatut(
            @PathVariable UUID id,
            @Valid @RequestBody VehiculeDTO.StatutRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(
                vehiculeService.changerStatut(id, request, extractActorId(authentication)));
    }

    /**
     * GET /api/v1/vehicules/{id}/historique
     */
    @GetMapping("/{id}/historique")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'TECHNICIEN', 'UTILISATEUR')")
    public ResponseEntity<VehiculeDTO.PageResponse<VehiculeDTO.HistoriqueResponse>> historique(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(vehiculeService.historique(id, pageable));
    }

    private UUID extractActorId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return SYSTEM_ACTOR_ID;
        }
        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException ex) {
            return SYSTEM_ACTOR_ID;
        }
    }
}

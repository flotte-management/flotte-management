package com.fleet.vehicule.service;

import com.fleet.vehicule.domain.*;
import com.fleet.vehicule.dto.VehiculeDTO;
import com.fleet.vehicule.exception.ImmatriculationAlreadyExistsException;
import com.fleet.vehicule.exception.InvalidVehiculeRequestException;
import com.fleet.vehicule.exception.VehiculeNotFoundException;
// import com.fleet.vehicule.kafka.KafkaVehiculeProducer;
import com.fleet.vehicule.repository.HistoriqueStatutRepository;
import com.fleet.vehicule.repository.VehiculeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class VehiculeServiceImpl implements VehiculeService {

    private final VehiculeRepository vehiculeRepository;
    private final HistoriqueStatutRepository historiqueRepository;
    // private final KafkaVehiculeProducer kafkaProducer;

    // ─── CRUD ────────────────────────────────────────────────────────────────

    @Override
    public VehiculeDTO.Response creer(VehiculeDTO.CreateRequest req) {
        String immatriculation = normalizeImmatriculation(req.getImmatriculation());
        if (vehiculeRepository.existsByImmatriculationIgnoreCase(immatriculation)) {
            throw new ImmatriculationAlreadyExistsException(immatriculation);
        }

        Vehicule vehicule = Vehicule.builder()
                .immatriculation(immatriculation)
                .marque(normalizeText(req.getMarque()))
                .modele(normalizeText(req.getModele()))
                .annee(req.getAnnee())
                .typeCarburant(req.getTypeCarburant())
                .build();

        vehicule = vehiculeRepository.save(vehicule);
        log.info("Véhicule créé : {} ({})", vehicule.getId(), vehicule.getImmatriculation());

        // kafkaProducer.publishCreated(vehicule);
        return toResponse(vehicule);
    }

    @Override
    @Transactional(readOnly = true)
    public VehiculeDTO.PageResponse<VehiculeDTO.Response> lister(
            StatutVehicule statut, String marque, Pageable pageable) {
        String normalizedMarque = normalizeFilter(marque);

        Page<Vehicule> page;
        if (statut != null && normalizedMarque != null) {
            page = vehiculeRepository.findByStatutAndMarqueContainingIgnoreCase(statut, normalizedMarque, pageable);
        } else if (statut != null) {
            page = vehiculeRepository.findByStatut(statut, pageable);
        } else if (normalizedMarque != null) {
            page = vehiculeRepository.findByMarqueContainingIgnoreCase(normalizedMarque, pageable);
        } else {
            page = vehiculeRepository.findAll(pageable);
        }

        return toPageResponse(page.map(this::toResponse));
    }

    @Override
    @Transactional(readOnly = true)
    public VehiculeDTO.Response trouverParId(UUID id) {
        return toResponse(getOrThrow(id));
    }

    @Override
    public VehiculeDTO.Response modifier(UUID id, VehiculeDTO.UpdateRequest req) {
        Vehicule vehicule = getOrThrow(id);

        if (req.getMarque() != null) vehicule.setMarque(normalizeUpdatableText("marque", req.getMarque()));
        if (req.getModele() != null) vehicule.setModele(normalizeUpdatableText("modele", req.getModele()));
        if (req.getAnnee() != null) vehicule.setAnnee(req.getAnnee());
        if (req.getTypeCarburant() != null) vehicule.setTypeCarburant(req.getTypeCarburant());
        if (req.getKilometrage() != null) vehicule.setKilometrage(req.getKilometrage());

        return toResponse(vehiculeRepository.save(vehicule));
    }

    @Override
    public void supprimer(UUID id, UUID modifiePar) {
        Vehicule vehicule = getOrThrow(id);
        vehicule.setDeletedAt(Instant.now());
        vehiculeRepository.save(vehicule);

        // kafkaProducer.publishDeleted(vehicule, modifiePar);
        log.info("Véhicule {} supprimé (soft-delete) par {}", id, modifiePar);
    }

    // ─── Statut ──────────────────────────────────────────────────────────────

    @Override
    public VehiculeDTO.Response changerStatut(UUID id, VehiculeDTO.StatutRequest req, UUID modifiePar) {
        Vehicule vehicule = getOrThrow(id);
        StatutVehicule ancien = vehicule.getStatut();
        if (ancien == req.getStatut()) {
            throw new InvalidVehiculeRequestException("Le statut demande est identique au statut actuel");
        }

        vehicule.setStatut(req.getStatut());
        vehicule = vehiculeRepository.save(vehicule);

        HistoriqueStatut historique = HistoriqueStatut.builder()
                .vehicule(vehicule)
                .statutAvant(ancien)
                .statutApres(req.getStatut())
                .motif(normalizeFilter(req.getMotif()))
                .modifiePar(modifiePar)
                .build();
        historiqueRepository.save(historique);

        // kafkaProducer.publishStatutChanged(vehicule, ancien, req.getStatut(), req.getMotif(), modifiePar);
        log.info("Véhicule {} : {} → {}", id, ancien, req.getStatut());

        return toResponse(vehicule);
    }

    @Override
    @Transactional(readOnly = true)
    public VehiculeDTO.PageResponse<VehiculeDTO.HistoriqueResponse> historique(UUID id, Pageable pageable) {
        getOrThrow(id); // Vérifie l'existence
        Page<HistoriqueStatut> page = historiqueRepository
                .findByVehiculeIdOrderByModifieLeDesc(id, pageable);
        return toPageResponse(page.map(this::toHistoriqueResponse));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Vehicule getOrThrow(UUID id) {
        return vehiculeRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new VehiculeNotFoundException(id));
    }

    private String normalizeImmatriculation(String immatriculation) {
        return normalizeText(immatriculation).toUpperCase();
    }

    private String normalizeText(String value) {
        return value.trim();
    }

    private String normalizeUpdatableText(String fieldName, String value) {
        String normalized = normalizeFilter(value);
        if (normalized == null) {
            throw new InvalidVehiculeRequestException("Le champ " + fieldName + " ne peut pas être vide");
        }
        return normalized;
    }

    private String normalizeFilter(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private VehiculeDTO.Response toResponse(Vehicule v) {
        return VehiculeDTO.Response.builder()
                .id(v.getId())
                .immatriculation(v.getImmatriculation())
                .marque(v.getMarque())
                .modele(v.getModele())
                .annee(v.getAnnee())
                .typeCarburant(v.getTypeCarburant())
                .statut(v.getStatut())
                .kilometrage(v.getKilometrage())
                .createdAt(v.getCreatedAt())
                .updatedAt(v.getUpdatedAt())
                .build();
    }

    private VehiculeDTO.HistoriqueResponse toHistoriqueResponse(HistoriqueStatut h) {
        return VehiculeDTO.HistoriqueResponse.builder()
                .id(h.getId())
                .vehiculeId(h.getVehicule().getId())
                .statutAvant(h.getStatutAvant())
                .statutApres(h.getStatutApres())
                .motif(h.getMotif())
                .modifiePar(h.getModifiePar())
                .modifieLe(h.getModifieLe())
                .build();
    }

    private <T> VehiculeDTO.PageResponse<T> toPageResponse(Page<T> page) {
        return VehiculeDTO.PageResponse.<T>builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }
}

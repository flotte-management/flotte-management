package com.fleet.vehicule.service;

import com.fleet.vehicule.domain.HistoriqueStatut;
import com.fleet.vehicule.domain.StatutVehicule;
import com.fleet.vehicule.domain.TypeCarburant;
import com.fleet.vehicule.domain.Vehicule;
import com.fleet.vehicule.dto.VehiculeDTO;
import com.fleet.vehicule.exception.ImmatriculationAlreadyExistsException;
import com.fleet.vehicule.exception.InvalidVehiculeRequestException;
import com.fleet.vehicule.exception.VehiculeNotFoundException;
import com.fleet.vehicule.repository.HistoriqueStatutRepository;
import com.fleet.vehicule.repository.VehiculeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VehiculeServiceImplTest {

    @Mock
    private VehiculeRepository vehiculeRepository;

    @Mock
    private HistoriqueStatutRepository historiqueRepository;

    @InjectMocks
    private VehiculeServiceImpl vehiculeService;

    private Vehicule vehicule;

    @BeforeEach
    void setUp() {
        vehicule = Vehicule.builder()
                .id(UUID.randomUUID())
                .immatriculation("AA-123-AA")
                .marque("Renault")
                .modele("Clio")
                .annee((short) 2024)
                .typeCarburant(TypeCarburant.ESSENCE)
                .statut(StatutVehicule.DISPONIBLE)
                .kilometrage(1200)
                .createdAt(Instant.parse("2026-01-01T00:00:00Z"))
                .updatedAt(Instant.parse("2026-01-02T00:00:00Z"))
                .build();
    }

    @Test
    void creer_shouldNormalizeAndPersistVehicule() {
        VehiculeDTO.CreateRequest request = new VehiculeDTO.CreateRequest();
        request.setImmatriculation(" aa-123-aa ");
        request.setMarque(" Renault ");
        request.setModele(" Clio ");
        request.setAnnee((short) 2024);
        request.setTypeCarburant(TypeCarburant.ESSENCE);

        when(vehiculeRepository.existsByImmatriculationIgnoreCase("AA-123-AA")).thenReturn(false);
        when(vehiculeRepository.save(any(Vehicule.class))).thenAnswer(invocation -> {
            Vehicule saved = invocation.getArgument(0, Vehicule.class);
            saved.setId(vehicule.getId());
            saved.setCreatedAt(vehicule.getCreatedAt());
            saved.setUpdatedAt(vehicule.getUpdatedAt());
            return saved;
        });

        VehiculeDTO.Response response = vehiculeService.creer(request);

        ArgumentCaptor<Vehicule> captor = ArgumentCaptor.forClass(Vehicule.class);
        verify(vehiculeRepository).save(captor.capture());
        assertThat(captor.getValue().getImmatriculation()).isEqualTo("AA-123-AA");
        assertThat(captor.getValue().getMarque()).isEqualTo("Renault");
        assertThat(captor.getValue().getModele()).isEqualTo("Clio");
        assertThat(response.getId()).isEqualTo(vehicule.getId());
    }

    @Test
    void creer_shouldRejectDuplicateImmatriculationIgnoringCase() {
        VehiculeDTO.CreateRequest request = new VehiculeDTO.CreateRequest();
        request.setImmatriculation("aa-123-aa");
        request.setMarque("Renault");
        request.setModele("Clio");
        request.setAnnee((short) 2024);
        request.setTypeCarburant(TypeCarburant.ESSENCE);

        when(vehiculeRepository.existsByImmatriculationIgnoreCase("AA-123-AA")).thenReturn(true);

        assertThatThrownBy(() -> vehiculeService.creer(request))
                .isInstanceOf(ImmatriculationAlreadyExistsException.class)
                .hasMessageContaining("AA-123-AA");

        verify(vehiculeRepository, never()).save(any(Vehicule.class));
    }

    @Test
    void lister_shouldUseTrimmedMarqueFilter() {
        when(vehiculeRepository.findByMarqueContainingIgnoreCase(eq("Renault"), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(vehicule), PageRequest.of(0, 20), 1));

        VehiculeDTO.PageResponse<VehiculeDTO.Response> response = vehiculeService.lister(
                null, "  Renault  ", PageRequest.of(0, 20));

        assertThat(response.getContent()).hasSize(1);
        verify(vehiculeRepository).findByMarqueContainingIgnoreCase("Renault", PageRequest.of(0, 20));
    }

    @Test
    void modifier_shouldUpdateOnlyProvidedFields() {
        VehiculeDTO.UpdateRequest request = new VehiculeDTO.UpdateRequest();
        request.setMarque(" Peugeot ");
        request.setKilometrage(35000);

        when(vehiculeRepository.findByIdAndDeletedAtIsNull(vehicule.getId())).thenReturn(Optional.of(vehicule));
        when(vehiculeRepository.save(any(Vehicule.class))).thenAnswer(invocation -> invocation.getArgument(0));

        VehiculeDTO.Response response = vehiculeService.modifier(vehicule.getId(), request);

        assertThat(response.getMarque()).isEqualTo("Peugeot");
        assertThat(response.getModele()).isEqualTo("Clio");
        assertThat(response.getKilometrage()).isEqualTo(35000);
    }

    @Test
    void modifier_shouldRejectBlankTextFields() {
        VehiculeDTO.UpdateRequest request = new VehiculeDTO.UpdateRequest();
        request.setMarque("   ");

        when(vehiculeRepository.findByIdAndDeletedAtIsNull(vehicule.getId())).thenReturn(Optional.of(vehicule));

        assertThatThrownBy(() -> vehiculeService.modifier(vehicule.getId(), request))
                .isInstanceOf(InvalidVehiculeRequestException.class)
                .hasMessageContaining("marque");

        verify(vehiculeRepository, never()).save(any(Vehicule.class));
    }

    @Test
    void trouverParId_shouldRejectDeletedVehicule() {
        UUID vehiculeId = UUID.randomUUID();
        when(vehiculeRepository.findByIdAndDeletedAtIsNull(vehiculeId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> vehiculeService.trouverParId(vehiculeId))
                .isInstanceOf(VehiculeNotFoundException.class);
    }

    @Test
    void supprimer_shouldSoftDeleteVehicule() {
        UUID actorId = UUID.randomUUID();
        when(vehiculeRepository.findByIdAndDeletedAtIsNull(vehicule.getId())).thenReturn(Optional.of(vehicule));
        when(vehiculeRepository.save(any(Vehicule.class))).thenAnswer(invocation -> invocation.getArgument(0));

        vehiculeService.supprimer(vehicule.getId(), actorId);

        ArgumentCaptor<Vehicule> captor = ArgumentCaptor.forClass(Vehicule.class);
        verify(vehiculeRepository).save(captor.capture());
        assertThat(captor.getValue().getDeletedAt()).isNotNull();
    }

    @Test
    void changerStatut_shouldPersistVehiculeAndHistory() {
        UUID actorId = UUID.randomUUID();
        VehiculeDTO.StatutRequest request = new VehiculeDTO.StatutRequest();
        request.setStatut(StatutVehicule.EN_SERVICE);
        request.setMotif("  Mission client  ");

        when(vehiculeRepository.findByIdAndDeletedAtIsNull(vehicule.getId())).thenReturn(Optional.of(vehicule));
        when(vehiculeRepository.save(any(Vehicule.class))).thenAnswer(invocation -> invocation.getArgument(0));

        VehiculeDTO.Response response = vehiculeService.changerStatut(vehicule.getId(), request, actorId);

        assertThat(response.getStatut()).isEqualTo(StatutVehicule.EN_SERVICE);

        ArgumentCaptor<HistoriqueStatut> captor = ArgumentCaptor.forClass(HistoriqueStatut.class);
        verify(historiqueRepository).save(captor.capture());
        assertThat(captor.getValue().getStatutAvant()).isEqualTo(StatutVehicule.DISPONIBLE);
        assertThat(captor.getValue().getStatutApres()).isEqualTo(StatutVehicule.EN_SERVICE);
        assertThat(captor.getValue().getMotif()).isEqualTo("Mission client");
        assertThat(captor.getValue().getModifiePar()).isEqualTo(actorId);
    }

    @Test
    void changerStatut_shouldRejectNoOpTransition() {
        VehiculeDTO.StatutRequest request = new VehiculeDTO.StatutRequest();
        request.setStatut(StatutVehicule.DISPONIBLE);

        when(vehiculeRepository.findByIdAndDeletedAtIsNull(vehicule.getId())).thenReturn(Optional.of(vehicule));

        assertThatThrownBy(() -> vehiculeService.changerStatut(vehicule.getId(), request, UUID.randomUUID()))
                .isInstanceOf(InvalidVehiculeRequestException.class)
                .hasMessageContaining("identique");

        verify(historiqueRepository, never()).save(any(HistoriqueStatut.class));
    }

    @Test
    void historique_shouldMapHistoryPage() {
        HistoriqueStatut historique = HistoriqueStatut.builder()
                .id(UUID.randomUUID())
                .vehicule(vehicule)
                .statutAvant(StatutVehicule.DISPONIBLE)
                .statutApres(StatutVehicule.EN_MAINTENANCE)
                .motif("Révision")
                .modifiePar(UUID.randomUUID())
                .modifieLe(Instant.parse("2026-02-01T10:15:30Z"))
                .build();

        when(vehiculeRepository.findByIdAndDeletedAtIsNull(vehicule.getId())).thenReturn(Optional.of(vehicule));
        when(historiqueRepository.findByVehiculeIdOrderByModifieLeDesc(vehicule.getId(), PageRequest.of(0, 5)))
                .thenReturn(new PageImpl<>(List.of(historique), PageRequest.of(0, 5), 1));

        VehiculeDTO.PageResponse<VehiculeDTO.HistoriqueResponse> response =
                vehiculeService.historique(vehicule.getId(), PageRequest.of(0, 5));

        assertThat(response.getContent()).hasSize(1);
        assertThat(response.getContent().getFirst().getVehiculeId()).isEqualTo(vehicule.getId());
        assertThat(response.getContent().getFirst().getMotif()).isEqualTo("Révision");
    }
}

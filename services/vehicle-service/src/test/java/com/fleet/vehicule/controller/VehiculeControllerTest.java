package com.fleet.vehicule.controller;

import com.fleet.vehicule.domain.StatutVehicule;
import com.fleet.vehicule.domain.TypeCarburant;
import com.fleet.vehicule.dto.VehiculeDTO;
import com.fleet.vehicule.exception.GlobalExceptionHandler;
import com.fleet.vehicule.exception.VehiculeNotFoundException;
import com.fleet.vehicule.service.VehiculeService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(VehiculeController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class VehiculeControllerTest {

    private static final UUID SYSTEM_ACTOR_ID = UUID.fromString("00000000-0000-0000-0000-000000000000");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    @MockitoBean
    private VehiculeService vehiculeService;

    @Test
    void lister_shouldReturnPagedResult_whenRequestIsValid() throws Exception {
        UUID vehiculeId = UUID.randomUUID();
        VehiculeDTO.Response response = VehiculeDTO.Response.builder()
                .id(vehiculeId)
                .immatriculation("AA-123-AA")
                .marque("Renault")
                .modele("Clio")
                .annee((short) 2024)
                .typeCarburant(TypeCarburant.ESSENCE)
                .statut(StatutVehicule.DISPONIBLE)
                .kilometrage(1500)
                .createdAt(Instant.parse("2026-01-01T00:00:00Z"))
                .updatedAt(Instant.parse("2026-01-02T00:00:00Z"))
                .build();

        when(vehiculeService.lister(eq(StatutVehicule.DISPONIBLE), eq("Renault"), any(Pageable.class)))
                .thenReturn(VehiculeDTO.PageResponse.<VehiculeDTO.Response>builder()
                        .content(List.of(response))
                        .page(0)
                        .size(10)
                        .totalElements(1)
                        .totalPages(1)
                        .last(true)
                        .build());

        mockMvc.perform(get("/api/v1/vehicules")
                        .param("statut", "DISPONIBLE")
                        .param("marque", "Renault")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(vehiculeId.toString()))
                .andExpect(jsonPath("$.content[0].marque").value("Renault"))
                .andExpect(jsonPath("$.totalElements").value(1));

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(vehiculeService).lister(eq(StatutVehicule.DISPONIBLE), eq("Renault"), pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageNumber()).isEqualTo(0);
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(10);
    }

    @Test
    void lister_shouldRejectInvalidPageSize() throws Exception {
        mockMvc.perform(get("/api/v1/vehicules").param("size", "101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Paramètres invalides"))
                .andExpect(jsonPath("$.errors.size").exists());
    }

    @Test
    void creer_shouldReturnUnprocessableEntity_whenBodyIsInvalid() throws Exception {
        String request = """
                {
                  "immatriculation": " ",
                  "marque": "",
                  "modele": ""
                }
                """;

        mockMvc.perform(post("/api/v1/vehicules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Données invalides"))
                .andExpect(jsonPath("$.errors.immatriculation").exists())
                .andExpect(jsonPath("$.errors.marque").exists())
                .andExpect(jsonPath("$.errors.modele").exists());
    }

    @Test
    void detail_shouldReturnNotFound_whenServiceRaisesException() throws Exception {
        UUID vehiculeId = UUID.randomUUID();
        when(vehiculeService.trouverParId(vehiculeId))
                .thenThrow(new VehiculeNotFoundException(vehiculeId));

        mockMvc.perform(get("/api/v1/vehicules/{id}", vehiculeId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Véhicule introuvable : " + vehiculeId));
    }

    @Test
    void supprimer_shouldFallbackToSystemActor_whenPrincipalIsNotUuid() throws Exception {
        UUID vehiculeId = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/vehicules/{id}", vehiculeId)
                        .with(authentication(new TestingAuthenticationToken("not-a-uuid", null))))
                .andExpect(status().isNoContent());

        verify(vehiculeService).supprimer(vehiculeId, SYSTEM_ACTOR_ID);
    }
}

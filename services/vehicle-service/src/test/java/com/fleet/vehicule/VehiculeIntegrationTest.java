package com.fleet.vehicule;

import com.fleet.vehicule.domain.StatutVehicule;
import com.fleet.vehicule.domain.TypeCarburant;
import com.fleet.vehicule.domain.Vehicule;
import com.fleet.vehicule.repository.HistoriqueStatutRepository;
import com.fleet.vehicule.repository.VehiculeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class VehiculeIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private VehiculeRepository vehiculeRepository;

    @Autowired
    private HistoriqueStatutRepository historiqueRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanDatabase() {
        historiqueRepository.deleteAll();
        vehiculeRepository.deleteAll();
    }

    @Test
    void fullCrudFlow_shouldHandleCreateUpdateStatusHistoryAndSoftDelete() throws Exception {
        String createRequest = """
                {
                  "immatriculation": "bb-456-bb",
                  "marque": "Peugeot",
                  "modele": "208",
                  "annee": 2023,
                  "typeCarburant": "DIESEL"
                }
                """;

        mockMvc.perform(post("/api/v1/vehicules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createRequest))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.immatriculation").value("BB-456-BB"));

        UUID vehiculeId = vehiculeRepository.findAll().getFirst().getId();

        mockMvc.perform(get("/api/v1/vehicules/{id}", vehiculeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.modele").value("208"));

        String updateRequest = """
                {
                  "marque": " Citroen ",
                  "modele": "C4",
                  "kilometrage": 42000
                }
                """;

        mockMvc.perform(put("/api/v1/vehicules/{id}", vehiculeId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateRequest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.marque").value("Citroen"))
                .andExpect(jsonPath("$.kilometrage").value(42000));

        String statutRequest = """
                {
                  "statut": "EN_MAINTENANCE",
                  "motif": "Maintenance preventive"
                }
                """;

        mockMvc.perform(patch("/api/v1/vehicules/{id}/statut", vehiculeId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statutRequest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statut").value("EN_MAINTENANCE"));

        mockMvc.perform(get("/api/v1/vehicules/{id}/historique", vehiculeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].statutAvant").value("DISPONIBLE"))
                .andExpect(jsonPath("$.content[0].statutApres").value("EN_MAINTENANCE"))
                .andExpect(jsonPath("$.content[0].motif").value("Maintenance preventive"));

        mockMvc.perform(delete("/api/v1/vehicules/{id}", vehiculeId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/vehicules/{id}", vehiculeId))
                .andExpect(status().isNotFound());

        Boolean softDeleted = jdbcTemplate.queryForObject(
                "select deleted_at is not null from vehicules where id = ?",
                Boolean.class,
                vehiculeId);
        assertThat(softDeleted).isTrue();
    }

    @Test
    void create_shouldRejectCaseInsensitiveDuplicateImmatriculation() throws Exception {
        Vehicule existing = Vehicule.builder()
                .immatriculation("CC-789-CC")
                .marque("Renault")
                .modele("Megane")
                .annee((short) 2022)
                .typeCarburant(TypeCarburant.HYBRIDE)
                .build();
        vehiculeRepository.save(existing);

        String duplicateRequest = """
                {
                  "immatriculation": "cc-789-cc",
                  "marque": "Renault",
                  "modele": "Scenic",
                  "annee": 2024,
                  "typeCarburant": "HYBRIDE"
                }
                """;

        mockMvc.perform(post("/api/v1/vehicules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(duplicateRequest))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Immatriculation déjà utilisée : CC-789-CC"));
    }

    @Test
    void patchStatus_shouldRejectNoOpTransition() throws Exception {
        Vehicule vehicule = vehiculeRepository.save(Vehicule.builder()
                .immatriculation("DD-111-DD")
                .marque("Toyota")
                .modele("Yaris")
                .annee((short) 2024)
                .typeCarburant(TypeCarburant.ESSENCE)
                .statut(StatutVehicule.DISPONIBLE)
                .build());

        String statutRequest = """
                {
                  "statut": "DISPONIBLE"
                }
                """;

        mockMvc.perform(patch("/api/v1/vehicules/{id}/statut", vehicule.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statutRequest))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Le statut demande est identique au statut actuel"));

        assertThat(historiqueRepository.findAll()).isEmpty();
    }

    @Test
    void update_shouldRejectBlankMarque() throws Exception {
        Vehicule vehicule = vehiculeRepository.save(Vehicule.builder()
                .immatriculation("EE-222-EE")
                .marque("Ford")
                .modele("Focus")
                .annee((short) 2023)
                .typeCarburant(TypeCarburant.DIESEL)
                .build());

        String request = """
                {
                  "marque": "   "
                }
                """;

        mockMvc.perform(put("/api/v1/vehicules/{id}", vehicule.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("Le champ marque ne peut pas être vide"));
    }

    @Test
    void list_shouldRejectTooLargePageSize() throws Exception {
        mockMvc.perform(get("/api/v1/vehicules").param("size", "101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Paramètres invalides"));
    }
}

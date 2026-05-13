package com.fleet.vehicule.metrics;

import com.fleet.vehicule.domain.StatutVehicule;
import com.fleet.vehicule.repository.VehiculeRepository;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

@Component
public class VehicleMetrics {

    public VehicleMetrics(MeterRegistry registry, VehiculeRepository repository) {
        Gauge.builder("fleet_vehicles_active", repository,
                repo -> repo.countByStatut(StatutVehicule.EN_SERVICE))
            .description("Nombre de vehicules en service")
            .register(registry);
    }
}


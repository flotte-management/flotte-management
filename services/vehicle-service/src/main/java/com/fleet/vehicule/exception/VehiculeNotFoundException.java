package com.fleet.vehicule.exception;

import java.util.UUID;


public class VehiculeNotFoundException extends RuntimeException {
    public VehiculeNotFoundException(UUID id) {
        super("Véhicule introuvable : " + id);
    }
}

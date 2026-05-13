package com.fleet.vehicule.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum StatutVehicule {
    DISPONIBLE,
    EN_SERVICE,
    EN_MAINTENANCE,
    HORS_SERVICE,
    RETIRE;

    @JsonCreator
    public static StatutVehicule fromValue(String value) {
        if (value == null) return null;
        if ("EN_MISSION".equalsIgnoreCase(value)) return EN_SERVICE;
        return StatutVehicule.valueOf(value.toUpperCase());
    }

    @JsonValue
    public String toValue() {
        return name();
    }
}

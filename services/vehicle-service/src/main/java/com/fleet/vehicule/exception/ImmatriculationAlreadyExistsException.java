package com.fleet.vehicule.exception;


public class ImmatriculationAlreadyExistsException extends RuntimeException {
    public ImmatriculationAlreadyExistsException(String immat) {
        super("Immatriculation déjà utilisée : " + immat);
    }
}
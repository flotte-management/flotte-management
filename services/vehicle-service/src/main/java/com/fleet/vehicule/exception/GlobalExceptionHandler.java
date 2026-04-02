package com.fleet.vehicule.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.Map;
import java.util.stream.Collectors;

// ─── Handler global ──────────────────────────────────────────────────────────

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(VehiculeNotFoundException.class)
    public ProblemDetail handleNotFound(VehiculeNotFoundException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setType(URI.create("https://fleet.local/errors/vehicule-not-found"));
        return pd;
    }

    @ExceptionHandler(ImmatriculationAlreadyExistsException.class)
    public ProblemDetail handleConflict(ImmatriculationAlreadyExistsException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        pd.setType(URI.create("https://fleet.local/errors/immatriculation-conflict"));
        return pd;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "invalide",
                        (a, b) -> a));

        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.UNPROCESSABLE_ENTITY, "Données invalides");
        pd.setType(URI.create("https://fleet.local/errors/validation"));
        pd.setProperty("errors", errors);
        return pd;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGeneric(Exception ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR, "Erreur interne");
        pd.setType(URI.create("https://fleet.local/errors/internal"));
        return pd;
    }
}

package com.fleet.vehicule.exception;

import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.validation.FieldError;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.net.URI;
import java.util.LinkedHashMap;
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

    @ExceptionHandler(InvalidVehiculeRequestException.class)
    public ProblemDetail handleInvalidRequest(InvalidVehiculeRequestException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
        pd.setType(URI.create("https://fleet.local/errors/invalid-request"));
        return pd;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "invalide",
                        (a, b) -> a));

        return validationProblem(HttpStatus.UNPROCESSABLE_ENTITY, "Données invalides", errors);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ProblemDetail handleHandlerMethodValidation(HandlerMethodValidationException ex) {
        Map<String, String> errors = new LinkedHashMap<>();
        ex.getParameterValidationResults().forEach(result ->
                result.getResolvableErrors().forEach(error -> errors.put(
                        result.getMethodParameter().getParameterName(),
                        error.getDefaultMessage() != null ? error.getDefaultMessage() : "invalide")));

        return validationProblem(HttpStatus.BAD_REQUEST, "Paramètres invalides", errors);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ProblemDetail handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        Map<String, String> errors = Map.of(
                ex.getName(),
                "Valeur invalide" + (ex.getRequiredType() != null ? " pour " + ex.getRequiredType().getSimpleName() : "")
        );

        return validationProblem(HttpStatus.BAD_REQUEST, "Paramètres invalides", errors);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ProblemDetail handleConstraintViolation(ConstraintViolationException ex) {
        Map<String, String> errors = ex.getConstraintViolations().stream()
                .collect(Collectors.toMap(
                        violation -> {
                            String path = violation.getPropertyPath().toString();
                            int separator = path.lastIndexOf('.');
                            return separator >= 0 ? path.substring(separator + 1) : path;
                        },
                        violation -> violation.getMessage() != null ? violation.getMessage() : "invalide",
                        (first, second) -> first,
                        LinkedHashMap::new));

        return validationProblem(HttpStatus.BAD_REQUEST, "Paramètres invalides", errors);
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGeneric(Exception ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR, "Erreur interne");
        pd.setType(URI.create("https://fleet.local/errors/internal"));
        return pd;
    }

    private ProblemDetail validationProblem(HttpStatus status, String detail, Map<String, String> errors) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
        pd.setType(URI.create("https://fleet.local/errors/validation"));
        pd.setProperties(new LinkedHashMap<>(Map.of("errors", errors)));
        return pd;
    }
}

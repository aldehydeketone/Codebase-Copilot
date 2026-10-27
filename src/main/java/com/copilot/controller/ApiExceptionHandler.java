package com.copilot.controller;

import com.copilot.service.ingestion.InvalidRepositoryPathException;
import com.copilot.service.ingestion.RepositoryIndexingException;
import com.copilot.service.ingestion.RepositoryPathNotFoundException;
import com.copilot.service.ingestion.RepositoryResponseMapper;
import com.copilot.service.search.OllamaRequestException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
@Slf4j
@RequiredArgsConstructor
public class ApiExceptionHandler {
    private final RepositoryResponseMapper repositoryResponseMapper;

    @ExceptionHandler(InvalidRepositoryPathException.class)
    public ResponseEntity<Map<String, String>> invalidPath(InvalidRepositoryPathException exception) {
        return ResponseEntity.badRequest().body(Map.of("error", exception.getMessage()));
    }

    @ExceptionHandler(RepositoryPathNotFoundException.class)
    public ResponseEntity<Map<String, String>> pathNotFound(RepositoryPathNotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", exception.getMessage()));
    }

    @ExceptionHandler(RepositoryIndexingException.class)
    public ResponseEntity<?> indexingFailed(RepositoryIndexingException exception) {
        return ResponseEntity.unprocessableEntity().body(Map.of(
                "repository", repositoryResponseMapper.toResponse(exception.getRepository()),
                "error", exception.getRepository().getErrorDetails()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalidRequest(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of("error", exception.getMessage()));
    }

    @ExceptionHandler(OllamaRequestException.class)
    public ResponseEntity<Map<String, String>> ollamaRequestFailed(OllamaRequestException exception) {
        HttpStatus status = exception.isTimeout() ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.SERVICE_UNAVAILABLE;
        log.warn("Local AI request failed: stage={}, timeout={}, status={}",
                exception.getStage(), exception.isTimeout(), status.value());
        String message = exception.isTimeout()
                ? "The local AI service timed out during " + exception.getStage() + ". You can retry the request."
                : "The local AI service is unavailable during " + exception.getStage() + ". Check Ollama and retry.";
        return ResponseEntity.status(status).body(Map.of("error", message));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGenericException(Exception exception) {
        log.error("Unhandled internal server error: ", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "An internal error occurred. Please check server logs."));
    }
}

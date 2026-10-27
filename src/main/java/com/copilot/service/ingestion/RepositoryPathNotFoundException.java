package com.copilot.service.ingestion;

public class RepositoryPathNotFoundException extends RuntimeException {
    public RepositoryPathNotFoundException(String message) {
        super(message);
    }
}

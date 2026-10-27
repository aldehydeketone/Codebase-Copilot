package com.copilot.service.ingestion;

public class InvalidRepositoryPathException extends RuntimeException {
    public InvalidRepositoryPathException(String message) {
        super(message);
    }

    public InvalidRepositoryPathException(String message, Throwable cause) {
        super(message, cause);
    }
}

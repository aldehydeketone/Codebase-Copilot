package com.copilot.service.ingestion;

import com.copilot.model.Repository;

public class RepositoryIndexingException extends RuntimeException {
    private final Repository repository;

    public RepositoryIndexingException(Repository repository, Throwable cause) {
        super(repository.getErrorDetails(), cause);
        this.repository = repository;
    }

    public Repository getRepository() {
        return repository;
    }
}

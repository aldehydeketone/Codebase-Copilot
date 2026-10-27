package com.copilot.repository;

import com.copilot.model.Repository;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface RepositoryRepository extends JpaRepository<Repository, UUID> {
    Optional<Repository> findBySourcePathIgnoreCase(String sourcePath);
}

package com.copilot.repository;

import com.copilot.model.File;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
import java.util.Optional;
import java.util.List;

public interface FileRepository extends JpaRepository<File, UUID> {
    Optional<File> findByRepositoryIdAndRelativePath(UUID repositoryId, String relativePath);
    List<File> findAllByRepositoryId(UUID repositoryId);
}

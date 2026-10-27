package com.copilot.service.ingestion;

import com.copilot.model.Repository;
import com.copilot.repository.RepositoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class RepositoryIngestionService {

    private final RepositoryRepository repositoryRepository;
    private final RepositoryIndexer repositoryIndexer;

    @Value("${copilot.ingestion.allowed-roots:}")
    private String allowedRootsConfig;

    private static final Set<String> DISALLOWED_DIR_NAMES = Set.of(
            "windows", "winnt", "system32", "syswow64", "program files", "program files (x86)",
            "etc", "var", "bin", "sbin", "usr", "root", "dev", "proc", "sys"
    );

    public Repository importLocalRepository(String inputPath, String requestedName) {
        Path root = validateRoot(inputPath);
        String sourcePath = root.toString();
        String repositoryName = requestedName == null || requestedName.isBlank()
                ? root.getFileName().toString()
                : requestedName.trim();

        Repository repository = repositoryRepository.findBySourcePathIgnoreCase(sourcePath)
                .orElseGet(() -> repositoryRepository.saveAndFlush(Repository.builder()
                        .name(repositoryName)
                        .sourceType("LOCAL")
                        .sourcePath(sourcePath)
                        .indexingStatus("PENDING")
                        .build()));

        repository.setName(repositoryName);
        repository.setIndexingStatus("INDEXING");
        repository.setErrorDetails(null);
        repository.setUpdatedAt(OffsetDateTime.now());
        repository = repositoryRepository.saveAndFlush(repository);

        long indexingStarted = System.nanoTime();
        try {
            IndexingSummary summary = repositoryIndexer.index(repository.getId(), root);
            repository.setIndexingStatus(summary.indexedFileCount() > 0 && summary.indexedChunkCount() > 0
                    ? "COMPLETED" : "COMPLETED_EMPTY");
            repository.setErrorDetails(null);
            log.info("Repository indexing completed: repositoryId={}, indexedFiles={}, indexedChunks={}, status={}, durationMs={}",
                    repository.getId(), summary.indexedFileCount(), summary.indexedChunkCount(),
                    repository.getIndexingStatus(), (System.nanoTime() - indexingStarted) / 1_000_000);
        } catch (Exception exception) {
            log.warn("Repository indexing failed: repositoryId={}, durationMs={}, reason={}",
                    repository.getId(), (System.nanoTime() - indexingStarted) / 1_000_000,
                    exception.getClass().getSimpleName());
            repository.setIndexingStatus("FAILED");
            repository.setErrorDetails(errorDetails(exception));
            Repository saved = repositoryRepository.saveAndFlush(repository);
            throw new RepositoryIndexingException(saved, exception);
        }

        repository.setUpdatedAt(OffsetDateTime.now());
        return repositoryRepository.saveAndFlush(repository);
    }

    public Path validateRoot(String inputPath) {
        if (inputPath == null || inputPath.isBlank()) {
            throw new InvalidRepositoryPathException("Repository path must not be blank");
        }

        final Path root;
        try {
            root = Paths.get(inputPath).toAbsolutePath().normalize();
        } catch (InvalidPathException exception) {
            throw new InvalidRepositoryPathException("Repository path is malformed", exception);
        }

        if (!Files.exists(root)) {
            throw new RepositoryPathNotFoundException("Repository directory does not exist");
        }
        if (!Files.isDirectory(root)) {
            throw new InvalidRepositoryPathException("Repository path must be a directory");
        }

        final Path realPath;
        try {
            realPath = root.toRealPath();
        } catch (IOException exception) {
            throw new InvalidRepositoryPathException("Repository directory cannot be resolved", exception);
        }

        // 1. Block root file systems (e.g. C:\ or /)
        if (realPath.getParent() == null || realPath.equals(realPath.getRoot())) {
            throw new InvalidRepositoryPathException("Cannot index the root filesystem: " + realPath);
        }

        // 2. Block sensitive system directories
        for (Path part : realPath) {
            String partLower = part.toString().toLowerCase(Locale.ROOT);
            if (DISALLOWED_DIR_NAMES.contains(partLower)) {
                throw new InvalidRepositoryPathException("Access to system directory is restricted: " + part);
            }
        }

        // 3. If allowed roots are configured, enforce prefix boundary
        if (allowedRootsConfig != null && !allowedRootsConfig.isBlank()) {
            List<Path> allowedPaths = Arrays.stream(allowedRootsConfig.split(File.pathSeparator))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .map(Paths::get)
                    .map(p -> {
                        try {
                            return p.toAbsolutePath().normalize().toRealPath();
                        } catch (Exception ignored) {
                            return p.toAbsolutePath().normalize();
                        }
                    })
                    .toList();

            boolean isWithinAllowed = allowedPaths.stream().anyMatch(realPath::startsWith);
            if (!isWithinAllowed) {
                throw new InvalidRepositoryPathException("Repository path is outside the allowed workspaces: " + realPath);
            }
        }

        return realPath;
    }

    private String errorDetails(Exception exception) {
        Throwable rootCause = exception;
        while (rootCause.getCause() != null) {
            rootCause = rootCause.getCause();
        }
        String message = rootCause.getMessage();
        if (message == null || message.isBlank()) {
            message = rootCause.getClass().getSimpleName();
        }
        return "Indexing failed: " + message;
    }
}

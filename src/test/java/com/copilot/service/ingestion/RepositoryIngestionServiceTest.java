package com.copilot.service.ingestion;

import com.copilot.model.Repository;
import com.copilot.repository.RepositoryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RepositoryIngestionServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void rejectsBlankOrMalformedPaths() {
        RepositoryIngestionService service = new RepositoryIngestionService(null, null);

        assertThrows(InvalidRepositoryPathException.class, () -> service.validateRoot(null));
        assertThrows(InvalidRepositoryPathException.class, () -> service.validateRoot("   "));
        assertThrows(InvalidRepositoryPathException.class, () -> service.validateRoot("bad\u0000path"));
    }

    @Test
    void rejectsNonExistentOrFilePath() throws IOException {
        RepositoryIngestionService service = new RepositoryIngestionService(null, null);

        assertThrows(RepositoryPathNotFoundException.class, () ->
                service.validateRoot(tempDir.resolve("does-not-exist").toString()));

        Path testFile = Files.createFile(tempDir.resolve("SomeFile.java"));
        assertThrows(InvalidRepositoryPathException.class, () ->
                service.validateRoot(testFile.toString()));
    }

    @Test
    void rejectsRootFilesystem() {
        RepositoryIngestionService service = new RepositoryIngestionService(null, null);

        File[] roots = File.listRoots();
        if (roots != null && roots.length > 0) {
            String rootPath = roots[0].getAbsolutePath();
            assertThrows(InvalidRepositoryPathException.class, () -> service.validateRoot(rootPath));
        }
    }

    @Test
    void acceptsValidExistingDirectory() throws IOException {
        RepositoryIngestionService service = new RepositoryIngestionService(null, null);
        Path validDir = Files.createDirectories(tempDir.resolve("valid-repo"));

        Path validated = service.validateRoot(validDir.toString());
        assertEquals(validDir.toRealPath(), validated);
    }

    @Test
    void marksSuccessfulScanWithNoSupportedJavaFilesAsCompletedEmpty() throws IOException {
        Path root = Files.createDirectories(tempDir.resolve("unsupported-repo"));
        Files.writeString(root.resolve("README.md"), "No Java source here.");
        UUID id = UUID.randomUUID();
        Repository repository = Repository.builder().id(id).name("unsupported-repo")
                .sourceType("LOCAL").sourcePath(root.toRealPath().toString()).indexingStatus("PENDING").build();
        RepositoryRepository repositoryRepository = mock(RepositoryRepository.class);
        RepositoryIndexer repositoryIndexer = mock(RepositoryIndexer.class);
        when(repositoryRepository.findBySourcePathIgnoreCase(repository.getSourcePath())).thenReturn(Optional.of(repository));
        when(repositoryRepository.saveAndFlush(any(Repository.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(repositoryIndexer.index(id, root.toRealPath())).thenReturn(new IndexingSummary(0, 0));
        RepositoryIngestionService service = new RepositoryIngestionService(repositoryRepository, repositoryIndexer);

        Repository result = service.importLocalRepository(root.toString(), null);

        assertEquals("COMPLETED_EMPTY", result.getIndexingStatus());
        verify(repositoryIndexer).index(id, root.toRealPath());
    }

    @Test
    void recordsFailedIndexingStatusAndDoesNotReturnSuccessfulRepository() throws IOException {
        Path root = Files.createDirectories(tempDir.resolve("malformed-repo"));
        UUID id = UUID.randomUUID();
        Repository repository = Repository.builder().id(id).name("malformed-repo")
                .sourceType("LOCAL").sourcePath(root.toRealPath().toString()).indexingStatus("PENDING").build();
        RepositoryRepository repositoryRepository = mock(RepositoryRepository.class);
        RepositoryIndexer repositoryIndexer = mock(RepositoryIndexer.class);
        when(repositoryRepository.findBySourcePathIgnoreCase(repository.getSourcePath())).thenReturn(Optional.of(repository));
        when(repositoryRepository.saveAndFlush(any(Repository.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(repositoryIndexer.index(id, root.toRealPath())).thenThrow(new IllegalStateException("Java syntax error"));
        RepositoryIngestionService service = new RepositoryIngestionService(repositoryRepository, repositoryIndexer);

        RepositoryIndexingException failure = assertThrows(RepositoryIndexingException.class,
                () -> service.importLocalRepository(root.toString(), null));

        assertEquals("FAILED", failure.getRepository().getIndexingStatus());
        assertTrue(failure.getRepository().getErrorDetails().contains("Java syntax error"));
        verify(repositoryRepository, atLeastOnce()).saveAndFlush(repository);
    }
}

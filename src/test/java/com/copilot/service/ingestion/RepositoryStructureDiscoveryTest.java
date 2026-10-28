package com.copilot.service.ingestion;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class RepositoryStructureDiscoveryTest {

    private final RepositoryStructureDiscovery discovery = new RepositoryStructureDiscovery();

    @TempDir
    Path tempDir;

    @Test
    void discoversTopLevelDirectories() throws IOException {
        Files.createDirectories(tempDir.resolve("src/main/java"));
        Files.createDirectories(tempDir.resolve("frontend/src"));
        Files.createDirectories(tempDir.resolve("docs"));
        Files.createFile(tempDir.resolve("src/main/java/Main.java"));
        Files.createFile(tempDir.resolve("frontend/src/App.tsx"));

        RepositoryStructureDiscovery.StructureSummary summary = discovery.discoverStructure(tempDir);

        assertTrue(summary.topLevelDirectories().contains("src"));
        assertTrue(summary.topLevelDirectories().contains("frontend"));
        assertTrue(summary.topLevelDirectories().contains("docs"));
        assertTrue(summary.totalDirectories() >= 3);
        assertTrue(summary.totalFiles() >= 2);
    }

    @Test
    void discoversKeyRootFiles() throws IOException {
        Files.createFile(tempDir.resolve("pom.xml"));
        Files.createFile(tempDir.resolve("README.md"));
        Files.createFile(tempDir.resolve("Dockerfile"));
        Files.createFile(tempDir.resolve("docker-compose.yml"));
        Files.createFile(tempDir.resolve("application.properties"));
        Files.createFile(tempDir.resolve("random-file.txt"));

        RepositoryStructureDiscovery.StructureSummary summary = discovery.discoverStructure(tempDir);

        assertTrue(summary.keyRootFiles().contains("pom.xml"));
        assertTrue(summary.keyRootFiles().contains("README.md"));
        assertTrue(summary.keyRootFiles().contains("Dockerfile"));
        assertTrue(summary.keyRootFiles().contains("docker-compose.yml"));
        assertTrue(summary.keyRootFiles().contains("application.properties"));
        // random-file.txt is NOT a key root file
        assertFalse(summary.keyRootFiles().contains("random-file.txt"));
    }

    @Test
    void excludesGitAndBuildDirectories() throws IOException {
        Files.createDirectories(tempDir.resolve(".git/objects"));
        Files.createDirectories(tempDir.resolve("target/classes"));
        Files.createDirectories(tempDir.resolve("node_modules/lodash"));
        Files.createDirectories(tempDir.resolve("build/libs"));
        Files.createDirectories(tempDir.resolve("src/main"));
        Files.createFile(tempDir.resolve(".git/objects/abc"));
        Files.createFile(tempDir.resolve("target/classes/App.class"));
        Files.createFile(tempDir.resolve("node_modules/lodash/index.js"));
        Files.createFile(tempDir.resolve("src/main/App.java"));

        RepositoryStructureDiscovery.StructureSummary summary = discovery.discoverStructure(tempDir);

        // Excluded directories should NOT appear in top-level dirs
        assertFalse(summary.topLevelDirectories().contains(".git"));
        assertFalse(summary.topLevelDirectories().contains("target"));
        assertFalse(summary.topLevelDirectories().contains("node_modules"));
        assertFalse(summary.topLevelDirectories().contains("build"));
        assertTrue(summary.topLevelDirectories().contains("src"));

        // Excluded directory files should not be in the tree sample
        for (String path : summary.directoryTreeSample()) {
            assertFalse(path.startsWith(".git/"), "Should not contain .git paths: " + path);
            assertFalse(path.startsWith("target/"), "Should not contain target paths: " + path);
            assertFalse(path.startsWith("node_modules/"), "Should not contain node_modules paths: " + path);
        }
    }

    @Test
    void countsFileExtensions() throws IOException {
        Files.createFile(tempDir.resolve("Main.java"));
        Files.createFile(tempDir.resolve("Util.java"));
        Files.createFile(tempDir.resolve("style.css"));
        Files.createFile(tempDir.resolve("config.yml"));

        RepositoryStructureDiscovery.StructureSummary summary = discovery.discoverStructure(tempDir);

        Map<String, Integer> counts = summary.fileCountsByExtension();
        assertEquals(2, counts.get(".java"));
        assertEquals(1, counts.get(".css"));
        assertEquals(1, counts.get(".yml"));
    }

    @Test
    void handlesEmptyRepository() throws IOException {
        RepositoryStructureDiscovery.StructureSummary summary = discovery.discoverStructure(tempDir);

        assertTrue(summary.topLevelDirectories().isEmpty());
        assertTrue(summary.keyRootFiles().isEmpty());
        assertTrue(summary.fileCountsByExtension().isEmpty());
        assertTrue(summary.directoryTreeSample().isEmpty());
        assertEquals(0, summary.totalDirectories());
        assertEquals(0, summary.totalFiles());
        assertNotNull(summary.manifestText());
        assertTrue(summary.manifestText().contains("Repository is empty"));
    }

    @Test
    void handlesNonExistentPath() throws IOException {
        Path nonExistent = tempDir.resolve("does-not-exist");
        RepositoryStructureDiscovery.StructureSummary summary = discovery.discoverStructure(nonExistent);

        assertTrue(summary.topLevelDirectories().isEmpty());
        assertTrue(summary.manifestText().contains("does not exist"));
    }

    @Test
    void manifestTextContainsAllSections() throws IOException {
        Files.createDirectories(tempDir.resolve("src/main/java"));
        Files.createFile(tempDir.resolve("pom.xml"));
        Files.createFile(tempDir.resolve("src/main/java/App.java"));

        RepositoryStructureDiscovery.StructureSummary summary = discovery.discoverStructure(tempDir);

        String manifest = summary.manifestText();
        assertTrue(manifest.contains("=== REPOSITORY STRUCTURE MANIFEST ==="));
        assertTrue(manifest.contains("Top-Level Directories:"));
        assertTrue(manifest.contains("Important Root Files:"));
        assertTrue(manifest.contains("Total Directories:"));
        assertTrue(manifest.contains("Total Files:"));
        assertTrue(manifest.contains("File Counts By Extension:"));
        assertTrue(manifest.contains("Repository File Paths Sample:"));
        assertTrue(manifest.contains("src"));
        assertTrue(manifest.contains("pom.xml"));
    }

    @Test
    void discoversNestedDirectoryStructure() throws IOException {
        Files.createDirectories(tempDir.resolve("src/main/java/com/example"));
        Files.createDirectories(tempDir.resolve("src/test/java/com/example"));
        Files.createFile(tempDir.resolve("src/main/java/com/example/App.java"));
        Files.createFile(tempDir.resolve("src/test/java/com/example/AppTest.java"));

        RepositoryStructureDiscovery.StructureSummary summary = discovery.discoverStructure(tempDir);

        assertTrue(summary.totalDirectories() >= 4, "Expected at least 4 dirs, got " + summary.totalDirectories());
        assertEquals(2, summary.totalFiles());
        List<String> tree = summary.directoryTreeSample();
        assertTrue(tree.stream().anyMatch(p -> p.contains("App.java")), "Tree sample should contain App.java, got: " + tree);
        assertTrue(tree.stream().anyMatch(p -> p.contains("AppTest.java")), "Tree sample should contain AppTest.java, got: " + tree);
    }
}

package com.copilot.service.ingestion;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JavaFileDiscoveryTest {
    @TempDir
    Path temporaryDirectory;

    @Test
    void excludesBuildFoldersRelativeToRepositoryRootAndNormalizesRelativePaths() throws Exception {
        Path root = Files.createDirectories(temporaryDirectory.resolve("target"));
        Files.createDirectories(root.resolve("src/main/java/example"));
        Files.createDirectories(root.resolve("target/generated"));
        Files.createDirectories(root.resolve(".git/objects"));
        Files.writeString(root.resolve("src/main/java/example/Keep.java"), "package example; class Keep {}");
        Files.writeString(root.resolve("target/generated/Skip.java"), "class Skip {}");
        Files.writeString(root.resolve(".git/objects/Skip.java"), "class Skip {}");

        JavaFileDiscovery discovery = new JavaFileDiscovery();
        List<Path> files = discovery.discover(root);

        assertEquals(List.of("src/main/java/example/Keep.java"),
                files.stream().map(path -> discovery.relativePath(root, path)).toList());
    }
}

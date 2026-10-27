package com.copilot.service.ingestion;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Component
public class JavaFileDiscovery {
    private static final Set<String> EXCLUDED_DIRECTORIES = Set.of(
            ".git", "target", "build", "node_modules", ".idea", ".vscode", ".gradle", "dist", "out");

    public List<Path> discover(Path repositoryRoot) throws IOException {
        Path root = repositoryRoot.toAbsolutePath().normalize();
        List<Path> javaFiles = new ArrayList<>();

        Files.walkFileTree(root, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path directory, BasicFileAttributes attributes) {
                if (!directory.equals(root) && hasExcludedRelativeDirectory(root, directory)) {
                    return FileVisitResult.SKIP_SUBTREE;
                }
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attributes) {
                if (attributes.isRegularFile()
                        && file.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".java")) {
                    javaFiles.add(file);
                }
                return FileVisitResult.CONTINUE;
            }
        });

        javaFiles.sort(Comparator.comparing(path -> relativePath(root, path)));
        return javaFiles;
    }

    public String relativePath(Path repositoryRoot, Path file) {
        return repositoryRoot.toAbsolutePath().normalize()
                .relativize(file.toAbsolutePath().normalize()).toString().replace('\\', '/');
    }

    private boolean hasExcludedRelativeDirectory(Path root, Path directory) {
        Path relative = root.relativize(directory);
        for (Path part : relative) {
            if (EXCLUDED_DIRECTORIES.contains(part.toString().toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }
}

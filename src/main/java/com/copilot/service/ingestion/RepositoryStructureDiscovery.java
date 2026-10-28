package com.copilot.service.ingestion;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class RepositoryStructureDiscovery {

    public static final Set<String> EXCLUDED_DIRECTORIES = Set.of(
            ".git", "target", "build", "node_modules", ".idea", ".vscode", ".gradle", "dist", "out"
    );

    private static final Set<String> KEY_ROOT_FILES = Set.of(
            "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts",
            "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
            "readme.md", "readme.txt", "readme",
            "dockerfile", "docker-compose.yml", "docker-compose.yaml",
            "application.properties", "application.yml", "application.yaml",
            "makefile", "mvnw", "gradlew"
    );

    public record StructureSummary(
            List<String> topLevelDirectories,
            List<String> keyRootFiles,
            Map<String, Integer> fileCountsByExtension,
            List<String> directoryTreeSample,
            int totalDirectories,
            int totalFiles,
            String manifestText
    ) {}

    public StructureSummary discoverStructure(Path repositoryRoot) throws IOException {
        Path root = repositoryRoot.toAbsolutePath().normalize();

        if (!Files.exists(root) || !Files.isDirectory(root)) {
            return new StructureSummary(
                    Collections.emptyList(),
                    Collections.emptyList(),
                    Collections.emptyMap(),
                    Collections.emptyList(),
                    0,
                    0,
                    "Repository path does not exist or is not a directory."
            );
        }

        List<String> topLevelDirs = new ArrayList<>();
        List<String> keyRootFilesFound = new ArrayList<>();
        Map<String, Integer> extCounts = new TreeMap<>();
        List<String> allRelativeDirs = new ArrayList<>();
        List<String> allRelativeFiles = new ArrayList<>();

        // Discover root level elements first
        try (var stream = Files.list(root)) {
            List<Path> rootItems = stream.sorted(Comparator.comparing(p -> p.getFileName().toString().toLowerCase(Locale.ROOT))).toList();
            for (Path item : rootItems) {
                String name = item.getFileName().toString();
                String nameLower = name.toLowerCase(Locale.ROOT);
                if (Files.isDirectory(item)) {
                    if (!EXCLUDED_DIRECTORIES.contains(nameLower)) {
                        topLevelDirs.add(name);
                    }
                } else if (Files.isRegularFile(item)) {
                    if (KEY_ROOT_FILES.contains(nameLower)) {
                        keyRootFilesFound.add(name);
                    }
                }
            }
        }

        // Walk the tree (pruning excluded directories)
        Files.walkFileTree(root, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                if (!dir.equals(root)) {
                    if (hasExcludedRelativeDirectory(root, dir)) {
                        return FileVisitResult.SKIP_SUBTREE;
                    }
                    allRelativeDirs.add(toRelativePath(root, dir));
                }
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                if (attrs.isRegularFile()) {
                    String relPath = toRelativePath(root, file);
                    allRelativeFiles.add(relPath);
                    String fileName = file.getFileName().toString();
                    String ext = getFileExtension(fileName);
                    extCounts.put(ext, extCounts.getOrDefault(ext, 0) + 1);
                }
                return FileVisitResult.CONTINUE;
            }
        });

        Collections.sort(allRelativeDirs);
        Collections.sort(allRelativeFiles);

        // Build a concise visual tree sample (up to depth 6 or first 80 relative paths)
        List<String> treeSample = allRelativeFiles.stream()
                .filter(p -> {
                    int depth = p.split("/").length;
                    return depth <= 6;
                })
                .limit(80)
                .toList();

        String manifest = buildManifestText(topLevelDirs, keyRootFilesFound, extCounts, treeSample, allRelativeDirs.size(), allRelativeFiles.size());

        return new StructureSummary(
                topLevelDirs,
                keyRootFilesFound,
                extCounts,
                treeSample,
                allRelativeDirs.size(),
                allRelativeFiles.size(),
                manifest
        );
    }

    private String buildManifestText(
            List<String> topLevelDirs,
            List<String> keyRootFiles,
            Map<String, Integer> extCounts,
            List<String> treeSample,
            int totalDirs,
            int totalFiles
    ) {
        StringBuilder sb = new StringBuilder();
        sb.append("=== REPOSITORY STRUCTURE MANIFEST ===\n");
        sb.append("Top-Level Directories: ").append(topLevelDirs.isEmpty() ? "[None]" : String.join(", ", topLevelDirs)).append("\n");
        sb.append("Important Root Files: ").append(keyRootFiles.isEmpty() ? "[None]" : String.join(", ", keyRootFiles)).append("\n");
        sb.append("Total Directories: ").append(totalDirs).append(", Total Files: ").append(totalFiles).append("\n\n");

        if (!extCounts.isEmpty()) {
            sb.append("File Counts By Extension:\n");
            extCounts.entrySet().stream()
                    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                    .limit(15)
                    .forEach(e -> sb.append(String.format("  - %s: %d\n", e.getKey().isEmpty() ? "(no extension)" : e.getKey(), e.getValue())));
            sb.append("\n");
        }

        if (!treeSample.isEmpty()) {
            sb.append("Repository File Paths Sample:\n");
            for (String path : treeSample) {
                sb.append("  ").append(path).append("\n");
            }
            if (totalFiles > treeSample.size()) {
                sb.append(String.format("  ... (%d more files not shown)\n", totalFiles - treeSample.size()));
            }
        } else {
            sb.append("Repository is empty (no files found).\n");
        }

        return sb.toString();
    }

    public String toRelativePath(Path root, Path target) {
        return root.relativize(target).toString().replace('\\', '/');
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

    private String getFileExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) {
            return "";
        }
        return filename.substring(dot).toLowerCase(Locale.ROOT);
    }
}

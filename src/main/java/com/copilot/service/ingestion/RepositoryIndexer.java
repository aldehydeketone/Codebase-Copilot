package com.copilot.service.ingestion;

import com.copilot.model.File;
import com.copilot.model.Repository;
import com.copilot.repository.FileRepository;
import com.copilot.repository.RepositoryRepository;
import com.copilot.service.embedding.EmbeddingService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RepositoryIndexer {
    private final RepositoryRepository repositoryRepository;
    private final FileRepository fileRepository;
    private final JavaFileDiscovery fileDiscovery;
    private final RepositoryStructureDiscovery structureDiscovery;
    private final JavaSourceParser sourceParser;
    private final EmbeddingService embeddingService;
    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public IndexingSummary index(UUID repositoryId, Path root) throws IOException {
        Repository repository = repositoryRepository.findById(repositoryId)
                .orElseThrow(() -> new IllegalArgumentException("Repository no longer exists"));

        // Build structure manifest
        RepositoryStructureDiscovery.StructureSummary structure = structureDiscovery.discoverStructure(root);
        repository.setStructureManifest(structure.manifestText());
        final Repository persistedRepository = repositoryRepository.saveAndFlush(repository);

        List<Path> javaFiles = fileDiscovery.discover(root);
        Set<String> discoveredPaths = new HashSet<>();
        int indexedChunkCount = 0;

        for (Path sourcePath : javaFiles) {
            String relativePath = fileDiscovery.relativePath(root, sourcePath);
            discoveredPaths.add(relativePath);
            String source = Files.readString(sourcePath, StandardCharsets.UTF_8);
            String contentHash = sha256(source);
            File file = fileRepository.findByRepositoryIdAndRelativePath(repositoryId, relativePath)
                    .orElseGet(() -> File.builder()
                            .repository(persistedRepository)
                            .relativePath(relativePath)
                            .language("JAVA")
                            .build());

            int existingChunks = file.getId() == null ? 0 : countChunks(file.getId());
            if (contentHash.equals(file.getContentHash()) && existingChunks > 0) {
                indexedChunkCount += existingChunks;
                continue;
            }

            file.setRepository(repository);
            file.setRelativePath(relativePath);
            file.setLanguage("JAVA");
            file.setContentHash(contentHash);
            file = fileRepository.saveAndFlush(file);

            jdbcTemplate.update("DELETE FROM code_chunks WHERE file_id = ?", file.getId());
            List<ParsedCodeChunk> chunks = sourceParser.parse(sourcePath, source);
            indexedChunkCount += chunks.size();
            int chunkIndex = 0;
            for (ParsedCodeChunk chunk : chunks) {
                String embeddingText = relativePath + "\n" + chunk.symbolName() + "\n" + chunk.content();
                float[] vector = embeddingService.embed(embeddingText);
                jdbcTemplate.update("""
                        INSERT INTO code_chunks
                            (id, file_id, chunk_index, content, symbol_name, start_line, end_line, embedding)
                        VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS vector))
                        """, UUID.randomUUID(), file.getId(), chunkIndex++, chunk.content(),
                        chunk.symbolName(), chunk.startLine(), chunk.endLine(),
                        embeddingService.toPgVector(vector));
            }
        }

        for (File existingFile : fileRepository.findAllByRepositoryId(repositoryId)) {
            if (!discoveredPaths.contains(existingFile.getRelativePath())) {
                jdbcTemplate.update("DELETE FROM code_chunks WHERE file_id = ?", existingFile.getId());
                fileRepository.delete(existingFile);
            }
        }
        return new IndexingSummary(javaFiles.size(), indexedChunkCount);
    }

    private int countChunks(UUID fileId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM code_chunks WHERE file_id = ?", Integer.class, fileId);
        return count == null ? 0 : count;
    }

    private String sha256(String source) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(source.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}

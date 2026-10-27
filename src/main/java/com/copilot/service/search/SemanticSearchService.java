package com.copilot.service.search;

import com.copilot.model.SearchResponse;
import com.copilot.service.embedding.EmbeddingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class SemanticSearchService {
    private final EmbeddingService embeddingService;
    private final JdbcTemplate jdbcTemplate;
    private final QueryAwareSearchRanker ranker;

    @Value("${copilot.search.minimum-cosine-score:0.52}")
    private double minimumCosineScore;

    public List<SearchResponse> search(String query, UUID repositoryId, Integer requestedLimit) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Search query must not be blank");
        }
        int limit = requestedLimit == null ? 10 : requestedLimit;
        if (limit < 1 || limit > 100) {
            throw new IllegalArgumentException("Search limit must be between 1 and 100");
        }

        long embeddingStarted = System.nanoTime();
        final String vector;
        try {
            vector = embeddingService.toPgVector(embeddingService.embed(query));
        } catch (ResourceAccessException exception) {
            log.warn("Search query embedding failed: repositoryId={}, durationMs={}, reason={}",
                    repositoryId, elapsedMillis(embeddingStarted), exception.getClass().getSimpleName());
            throw new OllamaRequestException("query embedding", exception);
        }
        log.info("Search query embedding completed: repositoryId={}, dimensions={}, durationMs={}",
                repositoryId, EmbeddingService.REQUIRED_DIMENSIONS, elapsedMillis(embeddingStarted));

        int candidateLimit = Math.min(Math.max(limit * 6, 30), 100);
        String sql = """
                SELECT f.relative_path, c.symbol_name, c.start_line, c.end_line, c.content,
                       1 - (c.embedding <=> CAST(? AS vector)) AS score
                FROM code_chunks c
                JOIN files f ON f.id = c.file_id
                WHERE c.embedding IS NOT NULL
                  AND (?::uuid IS NULL OR f.repository_id = ?::uuid)
                ORDER BY c.embedding <=> CAST(? AS vector)
                LIMIT ?
                """;
        long databaseStarted = System.nanoTime();
        List<SearchResponse> candidates = jdbcTemplate.query(sql, (result, row) -> SearchResponse.builder()
                        .filePath(result.getString("relative_path"))
                        .symbolName(result.getString("symbol_name"))
                        .startLine(result.getInt("start_line"))
                        .endLine(result.getInt("end_line"))
                        .content(result.getString("content"))
                        .score(result.getDouble("score"))
                        .build(),
                vector, repositoryId, repositoryId, vector, candidateLimit);
        log.info("Search candidate query completed: repositoryId={}, candidates={}, durationMs={}",
                repositoryId, candidates.size(), elapsedMillis(databaseStarted));

        List<SearchResponse> results = ranker.rank(query, candidates, minimumCosineScore, limit);
        log.info("Search ranking completed: repositoryId={}, results={}, candidateCount={}, minimumCosineScore={}",
                repositoryId, results.size(), candidates.size(), minimumCosineScore);
        return results;
    }

    private long elapsedMillis(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }
}

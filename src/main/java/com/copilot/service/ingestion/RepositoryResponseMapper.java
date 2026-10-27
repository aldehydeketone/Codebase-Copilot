package com.copilot.service.ingestion;

import com.copilot.model.Repository;
import com.copilot.model.RepositoryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class RepositoryResponseMapper {
    private final JdbcTemplate jdbcTemplate;

    public RepositoryResponse toResponse(Repository repository) {
        return toResponses(List.of(repository)).getFirst();
    }

    public List<RepositoryResponse> toResponses(List<Repository> repositories) {
        if (repositories.isEmpty()) return List.of();
        List<UUID> ids = repositories.stream().map(Repository::getId).toList();
        String placeholders = ids.stream().map(ignored -> "?").collect(Collectors.joining(","));
        String sql = """
                SELECT r.id, count(DISTINCT f.id) AS indexed_files, count(c.id) AS indexed_chunks
                FROM repositories r
                LEFT JOIN files f ON f.repository_id = r.id
                LEFT JOIN code_chunks c ON c.file_id = f.id
                WHERE r.id IN (%s)
                GROUP BY r.id
                """.formatted(placeholders);
        Map<UUID, Counts> countsById = new HashMap<>();
        jdbcTemplate.query(sql, (org.springframework.jdbc.core.RowCallbackHandler) result -> countsById.put(
                        result.getObject("id", UUID.class),
                        new Counts(result.getInt("indexed_files"), result.getInt("indexed_chunks"))),
                ids.toArray());

        return repositories.stream().map(repository -> {
            Counts counts = countsById.getOrDefault(repository.getId(), new Counts(0, 0));
            return new RepositoryResponse(repository.getId(), repository.getName(), repository.getSourceType(),
                    repository.getSourcePath(), repository.getIndexingStatus(), repository.getErrorDetails(),
                    repository.getCreatedAt(), repository.getUpdatedAt(), counts.files(), counts.chunks());
        }).toList();
    }

    private record Counts(int files, int chunks) { }
}

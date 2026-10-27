package com.copilot.integration;

import com.copilot.model.Repository;
import com.copilot.model.RepositoryImportRequest;
import com.copilot.model.SearchRequest;
import com.copilot.model.SearchResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.core.ParameterizedTypeReference;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Runs only with -DrealIntegration=true; uses the configured PostgreSQL and real Ollama service. */
@EnabledIfSystemProperty(named = "realIntegration", matches = "true")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RealPipelineIntegrationTest {
    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @TempDir
    Path temporaryDirectory;

    @Test
    @SuppressWarnings("unchecked")
    void importsIdempotentlyPersistsRealEmbeddingsAndSearchesPostgres() throws Exception {
        Path repositoryRoot = temporaryDirectory.resolve("small-java-repository");
        Path javaDirectory = repositoryRoot.resolve("src/main/java/example");
        Files.createDirectories(javaDirectory);
        Files.createDirectories(repositoryRoot.resolve("target/generated"));
        Files.createDirectories(repositoryRoot.resolve(".git/objects"));
        Files.createDirectories(repositoryRoot.resolve("build/generated"));
        Files.createDirectories(repositoryRoot.resolve("node_modules/pkg"));
        Files.writeString(javaDirectory.resolve("Greeting.java"), """
                package example;

                public class Greeting {
                    public String message() {
                        return "hello from a greeting";
                    }

                    public int length() {
                        return message().length();
                    }
                }
                """);
        Files.writeString(repositoryRoot.resolve("target/generated/Excluded.java"), "class ExcludedTarget {}");
        Files.writeString(repositoryRoot.resolve(".git/objects/Excluded.java"), "class ExcludedGit {}");
        Files.writeString(repositoryRoot.resolve("build/generated/Excluded.java"), "class ExcludedBuild {}");
        Files.writeString(repositoryRoot.resolve("node_modules/pkg/Excluded.java"), "class ExcludedNode {}");

        UUID repositoryId = null;
        try {
            ResponseEntity<Repository> firstImport = importRepository(repositoryRoot);
            assertEquals(HttpStatus.OK, firstImport.getStatusCode());
            Repository repository = firstImport.getBody();
            assertNotNull(repository);
            repositoryId = repository.getId();
            assertEquals("COMPLETED", repository.getIndexingStatus());
            assertNotNull(repository.getCreatedAt());

            assertEquals(1, count("SELECT count(*) FROM repositories WHERE id = ?", repositoryId));
            assertEquals(1, count("SELECT count(*) FROM files WHERE repository_id = ?", repositoryId));
            assertEquals(2, count("SELECT count(*) FROM code_chunks c JOIN files f ON f.id=c.file_id WHERE f.repository_id = ?", repositoryId));
            assertEquals(2, count("SELECT count(*) FROM code_chunks c JOIN files f ON f.id=c.file_id WHERE f.repository_id = ? AND vector_dims(c.embedding)=768", repositoryId));

            List<Map<String, Object>> sourceRows = jdbcTemplate.queryForList("""
                    SELECT f.relative_path, c.symbol_name, c.start_line, c.end_line, vector_dims(c.embedding) AS dimensions
                    FROM files f JOIN code_chunks c ON c.file_id=f.id
                    WHERE f.repository_id=? ORDER BY c.chunk_index
                    """, repositoryId);
            assertEquals("src/main/java/example/Greeting.java", sourceRows.get(0).get("relative_path"));
            assertEquals("Greeting#message", sourceRows.get(0).get("symbol_name"));
            assertEquals(4, ((Number) sourceRows.get(0).get("start_line")).intValue());
            assertEquals(6, ((Number) sourceRows.get(0).get("end_line")).intValue());
            assertEquals(768, ((Number) sourceRows.get(0).get("dimensions")).intValue());

            ResponseEntity<List<SearchResponse>> search = restTemplate.exchange(url("/api/search"), HttpMethod.POST,
                    new HttpEntity<>(new SearchRequest("Which method returns a greeting message?", repositoryId, 5)),
                    new ParameterizedTypeReference<>() { });
            assertEquals(HttpStatus.OK, search.getStatusCode());
            List<SearchResponse> actualSearch = search.getBody();
            assertNotNull(actualSearch);
            assertFalse(actualSearch.isEmpty());
            assertTrue(actualSearch.get(0).getFilePath().endsWith("Greeting.java"));
            assertTrue(actualSearch.get(0).getContent().contains("hello from a greeting"));

            int filesBeforeRepeat = count("SELECT count(*) FROM files WHERE repository_id = ?", repositoryId);
            int chunksBeforeRepeat = count("SELECT count(*) FROM code_chunks c JOIN files f ON f.id=c.file_id WHERE f.repository_id = ?", repositoryId);
            ResponseEntity<Repository> secondImport = importRepository(repositoryRoot);
            assertEquals(HttpStatus.OK, secondImport.getStatusCode());
            assertEquals(repositoryId, secondImport.getBody().getId());
            assertEquals(filesBeforeRepeat, count("SELECT count(*) FROM files WHERE repository_id = ?", repositoryId));
            assertEquals(chunksBeforeRepeat, count("SELECT count(*) FROM code_chunks c JOIN files f ON f.id=c.file_id WHERE f.repository_id = ?", repositoryId));

            ResponseEntity<Map> missingPath = restTemplate.postForEntity(url("/api/repositories/import"),
                    new RepositoryImportRequest(temporaryDirectory.resolve("does-not-exist").toString(), "missing", null), Map.class);
            assertEquals(HttpStatus.NOT_FOUND, missingPath.getStatusCode());

            ResponseEntity<Map> invalidPath = restTemplate.postForEntity(url("/api/repositories/import"),
                    new RepositoryImportRequest("bad\u0000path", "invalid", null), Map.class);
            assertEquals(HttpStatus.BAD_REQUEST, invalidPath.getStatusCode());

            ResponseEntity<Map> fileInsteadOfDirectory = restTemplate.postForEntity(url("/api/repositories/import"),
                    new RepositoryImportRequest(javaDirectory.resolve("Greeting.java").toString(), "not-a-directory", null), Map.class);
            assertEquals(HttpStatus.BAD_REQUEST, fileInsteadOfDirectory.getStatusCode());

            Path brokenRepository = temporaryDirectory.resolve("broken-java-repository");
            Files.createDirectories(brokenRepository);
            Files.writeString(brokenRepository.resolve("Broken.java"), "class Broken { void fail( {\n}");
            ResponseEntity<Map> failedImport = restTemplate.postForEntity(url("/api/repositories/import"),
                    new RepositoryImportRequest(brokenRepository.toString(), "broken", null), Map.class);
            assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, failedImport.getStatusCode());
            Map<String, Object> responseBody = failedImport.getBody();
            assertNotNull(responseBody);
            Map<String, Object> failedRepository = (Map<String, Object>) responseBody.get("repository");
            UUID failedRepositoryId = UUID.fromString((String) failedRepository.get("id"));
            assertEquals("FAILED", jdbcTemplate.queryForObject(
                    "SELECT indexing_status FROM repositories WHERE id = ?", String.class, failedRepositoryId));
            String errorDetails = jdbcTemplate.queryForObject(
                    "SELECT error_details FROM repositories WHERE id = ?", String.class, failedRepositoryId);
            assertTrue(errorDetails.contains("Java syntax error"));
            jdbcTemplate.update("DELETE FROM repositories WHERE id = ?", failedRepositoryId);
        } finally {
            if (repositoryId != null) {
                jdbcTemplate.update("DELETE FROM repositories WHERE id = ?", repositoryId);
            }
        }
    }

    private ResponseEntity<Repository> importRepository(Path repositoryRoot) {
        return restTemplate.postForEntity(url("/api/repositories/import"),
                new RepositoryImportRequest(repositoryRoot.toString(), "integration-java-repository", null), Repository.class);
    }

    private int count(String sql, UUID repositoryId) {
        Integer result = jdbcTemplate.queryForObject(sql, Integer.class, repositoryId);
        return result == null ? 0 : result;
    }

    private String url(String path) {
        return "http://127.0.0.1:" + port + path;
    }
}

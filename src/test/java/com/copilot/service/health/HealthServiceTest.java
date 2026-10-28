package com.copilot.service.health;

import com.copilot.model.health.ComponentHealth;
import com.copilot.model.health.SystemHealthResponse;
import com.copilot.repository.RepositoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClient;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.SQLTimeoutException;
import java.sql.Statement;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HealthServiceTest {

    @Mock
    private DataSource dataSource;

    @Mock
    private Connection connection;

    @Mock
    private Statement statement;

    @Mock
    private RepositoryRepository repositoryRepository;

    @Mock
    private ChatModel chatModel;

    @Mock
    private RestClient mockOllamaClient;

    @Mock
    private RestClient.RequestHeadersUriSpec requestHeadersUriSpec;

    @Mock
    private RestClient.ResponseSpec responseSpec;

    private HealthService healthService;

    @BeforeEach
    void setUp() {
        healthService = new HealthService(
                dataSource,
                repositoryRepository,
                chatModel,
                "http://localhost:11434",
                "qwen3.5:4b",
                "nomic-embed-text"
        );
        ReflectionTestUtils.setField(healthService, "ollamaClient", mockOllamaClient);
    }

    private void mockHealthyDb() throws SQLException {
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(anyInt())).thenReturn(true);
        when(connection.createStatement()).thenReturn(statement);
        when(statement.execute(anyString())).thenReturn(true);
    }

    private void mockOllamaResponse(List<String> modelNames) {
        when(mockOllamaClient.get()).thenReturn(requestHeadersUriSpec);
        when(requestHeadersUriSpec.uri("/api/tags")).thenReturn(requestHeadersUriSpec);
        when(requestHeadersUriSpec.retrieve()).thenReturn(responseSpec);

        List<Map<String, Object>> modelsList = modelNames.stream()
                .map(name -> Map.<String, Object>of("name", name))
                .toList();
        when(responseSpec.body(Map.class)).thenReturn(Map.of("models", modelsList));
    }

    @Test
    @DisplayName("Returns OPERATIONAL when database, Ollama, models, and indexing are all healthy")
    void allServicesHealthy() throws SQLException {
        mockHealthyDb();
        mockOllamaResponse(List.of("qwen3.5:4b", "nomic-embed-text:latest"));
        when(repositoryRepository.count()).thenReturn(3L);
        when(repositoryRepository.countByIndexingStatusIgnoreCase("INDEXING")).thenReturn(0L);
        when(repositoryRepository.countByIndexingStatusIgnoreCase("FAILED")).thenReturn(0L);

        SystemHealthResponse response = healthService.checkHealth(false);

        assertThat(response.getStatus()).isEqualTo("OPERATIONAL");
        assertThat(response.getChecks().get("database").getStatus()).isEqualTo("UP");
        assertThat(response.getChecks().get("ollama").getStatus()).isEqualTo("UP");
        assertThat(response.getChecks().get("chatModel").getStatus()).isEqualTo("UP");
        assertThat(response.getChecks().get("embeddingModel").getStatus()).isEqualTo("UP");
        assertThat(response.getChecks().get("indexing").getStatus()).isEqualTo("IDLE");
        assertThat(response.getInferenceTest()).isNull();
    }

    @Test
    @DisplayName("Returns SERVICE_UNAVAILABLE when database connection fails")
    void databaseUnavailable() throws SQLException {
        when(dataSource.getConnection()).thenThrow(new SQLException("Connection refused"));
        mockOllamaResponse(List.of("qwen3.5:4b", "nomic-embed-text"));

        SystemHealthResponse response = healthService.checkHealth(false);

        assertThat(response.getStatus()).isEqualTo("SERVICE_UNAVAILABLE");
        assertThat(response.getChecks().get("database").getStatus()).isEqualTo("DOWN");
        assertThat(response.getChecks().get("database").getMessage()).contains("failed");
        assertThat(response.getChecks().get("indexing").getStatus()).isEqualTo("UNAVAILABLE");
    }

    @Test
    @DisplayName("Distinguishes database timeout from connection failure")
    void databaseTimeout() throws SQLException {
        when(dataSource.getConnection()).thenThrow(new SQLTimeoutException("Query timed out"));
        mockOllamaResponse(List.of("qwen3.5:4b", "nomic-embed-text"));

        SystemHealthResponse response = healthService.checkHealth(false);

        assertThat(response.getStatus()).isEqualTo("SERVICE_UNAVAILABLE");
        assertThat(response.getChecks().get("database").getStatus()).isEqualTo("TIMEOUT");
        assertThat(response.getChecks().get("database").getMessage()).contains("timed out");
    }

    @Test
    @DisplayName("Returns DEGRADED when Ollama service is down, marking models UNAVAILABLE")
    void ollamaUnavailable() throws SQLException {
        mockHealthyDb();
        when(mockOllamaClient.get()).thenReturn(requestHeadersUriSpec);
        when(requestHeadersUriSpec.uri("/api/tags")).thenReturn(requestHeadersUriSpec);
        when(requestHeadersUriSpec.retrieve()).thenThrow(new RuntimeException("Connection refused to 11434"));

        when(repositoryRepository.count()).thenReturn(1L);
        when(repositoryRepository.countByIndexingStatusIgnoreCase("INDEXING")).thenReturn(0L);
        when(repositoryRepository.countByIndexingStatusIgnoreCase("FAILED")).thenReturn(0L);

        SystemHealthResponse response = healthService.checkHealth(false);

        assertThat(response.getStatus()).isEqualTo("DEGRADED");
        assertThat(response.getChecks().get("database").getStatus()).isEqualTo("UP");
        assertThat(response.getChecks().get("ollama").getStatus()).isEqualTo("DOWN");
        assertThat(response.getChecks().get("chatModel").getStatus()).isEqualTo("UNAVAILABLE");
        assertThat(response.getChecks().get("embeddingModel").getStatus()).isEqualTo("UNAVAILABLE");
    }

    @Test
    @DisplayName("Returns DEGRADED when chat model qwen3.5:4b is missing from Ollama")
    void chatModelMissing() throws SQLException {
        mockHealthyDb();
        // Only embedding model present in Ollama
        mockOllamaResponse(List.of("nomic-embed-text:latest", "llama3:8b"));

        when(repositoryRepository.count()).thenReturn(1L);
        when(repositoryRepository.countByIndexingStatusIgnoreCase("INDEXING")).thenReturn(0L);
        when(repositoryRepository.countByIndexingStatusIgnoreCase("FAILED")).thenReturn(0L);

        SystemHealthResponse response = healthService.checkHealth(false);

        assertThat(response.getStatus()).isEqualTo("DEGRADED");
        assertThat(response.getChecks().get("ollama").getStatus()).isEqualTo("UP");
        assertThat(response.getChecks().get("chatModel").getStatus()).isEqualTo("MISSING");
        assertThat(response.getChecks().get("chatModel").getMessage()).contains("not found in Ollama");
        assertThat(response.getChecks().get("embeddingModel").getStatus()).isEqualTo("UP");
    }

    @Test
    @DisplayName("Returns DEGRADED when embedding model nomic-embed-text is missing")
    void embeddingModelMissing() throws SQLException {
        mockHealthyDb();
        // Only chat model present in Ollama
        mockOllamaResponse(List.of("qwen3.5:4b"));

        when(repositoryRepository.count()).thenReturn(1L);
        when(repositoryRepository.countByIndexingStatusIgnoreCase("INDEXING")).thenReturn(0L);
        when(repositoryRepository.countByIndexingStatusIgnoreCase("FAILED")).thenReturn(0L);

        SystemHealthResponse response = healthService.checkHealth(false);

        assertThat(response.getStatus()).isEqualTo("DEGRADED");
        assertThat(response.getChecks().get("ollama").getStatus()).isEqualTo("UP");
        assertThat(response.getChecks().get("chatModel").getStatus()).isEqualTo("UP");
        assertThat(response.getChecks().get("embeddingModel").getStatus()).isEqualTo("MISSING");
    }

    @Test
    @DisplayName("Reports RUNNING indexing status when indexing is in progress")
    void indexingInProgress() throws SQLException {
        mockHealthyDb();
        mockOllamaResponse(List.of("qwen3.5:4b", "nomic-embed-text"));

        when(repositoryRepository.count()).thenReturn(2L);
        when(repositoryRepository.countByIndexingStatusIgnoreCase("INDEXING")).thenReturn(1L);
        when(repositoryRepository.countByIndexingStatusIgnoreCase("FAILED")).thenReturn(0L);

        SystemHealthResponse response = healthService.checkHealth(false);

        assertThat(response.getStatus()).isEqualTo("OPERATIONAL");
        assertThat(response.getChecks().get("indexing").getStatus()).isEqualTo("RUNNING");
        assertThat(response.getChecks().get("indexing").getActiveCount()).isEqualTo(1L);
    }

    @Test
    @DisplayName("Returns DEGRADED when repository indexing has failed")
    void indexingFailed() throws SQLException {
        mockHealthyDb();
        mockOllamaResponse(List.of("qwen3.5:4b", "nomic-embed-text"));

        when(repositoryRepository.count()).thenReturn(2L);
        when(repositoryRepository.countByIndexingStatusIgnoreCase("INDEXING")).thenReturn(0L);
        when(repositoryRepository.countByIndexingStatusIgnoreCase("FAILED")).thenReturn(1L);

        SystemHealthResponse response = healthService.checkHealth(false);

        assertThat(response.getStatus()).isEqualTo("DEGRADED");
        assertThat(response.getChecks().get("indexing").getStatus()).isEqualTo("FAILED");
        assertThat(response.getChecks().get("indexing").getFailedCount()).isEqualTo(1L);
    }

    @Test
    @DisplayName("Runs inference test when explicitly requested")
    void testInferenceExplicit() throws SQLException {
        mockHealthyDb();
        mockOllamaResponse(List.of("qwen3.5:4b", "nomic-embed-text"));
        when(repositoryRepository.count()).thenReturn(1L);
        when(repositoryRepository.countByIndexingStatusIgnoreCase("INDEXING")).thenReturn(0L);
        when(repositoryRepository.countByIndexingStatusIgnoreCase("FAILED")).thenReturn(0L);

        ChatResponse mockChatResponse = mock(ChatResponse.class);
        when(chatModel.call(any(Prompt.class))).thenReturn(mockChatResponse);

        SystemHealthResponse response = healthService.checkHealth(true);

        assertThat(response.getInferenceTest()).isNotNull();
        assertThat(response.getInferenceTest().getStatus()).isEqualTo("UP");
        assertThat(response.getInferenceTest().getMessage()).contains("succeeded");
    }
}

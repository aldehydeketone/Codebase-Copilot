package com.copilot.service.health;

import com.copilot.model.health.ComponentHealth;
import com.copilot.model.health.SystemHealthResponse;
import com.copilot.repository.RepositoryRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import javax.sql.DataSource;
import java.net.SocketTimeoutException;
import java.sql.Connection;
import java.sql.SQLTimeoutException;
import java.sql.Statement;
import java.util.*;

@Service
@Slf4j
public class HealthService {

    private final DataSource dataSource;
    private final RepositoryRepository repositoryRepository;
    private final ChatModel chatModel;
    private final RestClient ollamaClient;

    private final String configuredChatModel;
    private final String configuredEmbedModel;

    public HealthService(
            DataSource dataSource,
            RepositoryRepository repositoryRepository,
            ChatModel chatModel,
            @Value("${spring.ai.ollama.base-url:http://localhost:11434}") String ollamaBaseUrl,
            @Value("${spring.ai.ollama.chat.options.model:qwen3.5:4b}") String configuredChatModel,
            @Value("${spring.ai.ollama.embedding.options.model:nomic-embed-text}") String configuredEmbedModel) {
        this.dataSource = dataSource;
        this.repositoryRepository = repositoryRepository;
        this.chatModel = chatModel;
        this.configuredChatModel = configuredChatModel;
        this.configuredEmbedModel = configuredEmbedModel;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(2500);
        requestFactory.setReadTimeout(3000);

        this.ollamaClient = RestClient.builder()
                .baseUrl(ollamaBaseUrl)
                .requestFactory(requestFactory)
                .build();
    }

    public SystemHealthResponse checkHealth(boolean testInference) {
        long checkStarted = System.currentTimeMillis();

        ComponentHealth backendCheck = ComponentHealth.builder()
                .status("UP")
                .latencyMs(0L)
                .message("Backend API is responding")
                .build();

        ComponentHealth dbCheck = checkDatabase();
        OllamaHealthResult ollamaResult = checkOllamaAndModels();
        ComponentHealth indexingCheck = checkIndexing("UP".equals(dbCheck.getStatus()));

        ComponentHealth inferenceCheck = null;
        if (testInference) {
            inferenceCheck = runInferenceTest(ollamaResult.chatModelCheck().getStatus());
        }

        String overallStatus = computeOverallStatus(backendCheck, dbCheck, ollamaResult, indexingCheck);

        Map<String, ComponentHealth> checks = new LinkedHashMap<>();
        checks.put("frontend", ComponentHealth.builder()
                .status("UP")
                .message("UI is loaded and usable")
                .build());
        checks.put("backend", backendCheck);
        checks.put("database", dbCheck);
        checks.put("ollama", ollamaResult.ollamaCheck());
        checks.put("chatModel", ollamaResult.chatModelCheck());
        checks.put("embeddingModel", ollamaResult.embeddingModelCheck());
        checks.put("indexing", indexingCheck);

        return SystemHealthResponse.builder()
                .status(overallStatus)
                .timestamp(System.currentTimeMillis())
                .checks(checks)
                .inferenceTest(inferenceCheck)
                .build();
    }

    private ComponentHealth checkDatabase() {
        long start = System.currentTimeMillis();
        try (Connection conn = dataSource.getConnection()) {
            if (conn.isValid(2)) {
                try (Statement stmt = conn.createStatement()) {
                    stmt.setQueryTimeout(2);
                    stmt.execute("SELECT 1");
                }
                long latency = System.currentTimeMillis() - start;
                return ComponentHealth.builder()
                        .status("UP")
                        .latencyMs(latency)
                        .message("PostgreSQL connection verified")
                        .build();
            } else {
                return ComponentHealth.builder()
                        .status("DOWN")
                        .latencyMs(System.currentTimeMillis() - start)
                        .message("PostgreSQL connection is invalid")
                        .build();
            }
        } catch (SQLTimeoutException e) {
            return ComponentHealth.builder()
                    .status("TIMEOUT")
                    .latencyMs(System.currentTimeMillis() - start)
                    .message("Database query timed out")
                    .build();
        } catch (Exception e) {
            boolean isTimeout = e.getMessage() != null && e.getMessage().toLowerCase().contains("timeout");
            return ComponentHealth.builder()
                    .status(isTimeout ? "TIMEOUT" : "DOWN")
                    .latencyMs(System.currentTimeMillis() - start)
                    .message(isTimeout ? "Database connection timed out" : "Database connection failed")
                    .build();
        }
    }

    private OllamaHealthResult checkOllamaAndModels() {
        long start = System.currentTimeMillis();
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = ollamaClient.get()
                    .uri("/api/tags")
                    .retrieve()
                    .body(Map.class);

            long latency = System.currentTimeMillis() - start;

            List<String> availableModels = new ArrayList<>();
            if (response != null && response.get("models") instanceof List<?> list) {
                for (Object item : list) {
                    if (item instanceof Map<?, ?> modelMap && modelMap.get("name") != null) {
                        availableModels.add(String.valueOf(modelMap.get("name")));
                    }
                }
            }

            ComponentHealth ollamaCheck = ComponentHealth.builder()
                    .status("UP")
                    .latencyMs(latency)
                    .message("Ollama service is reachable")
                    .build();

            boolean chatModelFound = matchesModel(configuredChatModel, availableModels);
            ComponentHealth chatModelCheck = ComponentHealth.builder()
                    .status(chatModelFound ? "UP" : "MISSING")
                    .model(configuredChatModel)
                    .message(chatModelFound
                            ? "Model '" + configuredChatModel + "' is available"
                            : "Model '" + configuredChatModel + "' not found in Ollama")
                    .build();

            boolean embedModelFound = matchesModel(configuredEmbedModel, availableModels);
            ComponentHealth embedModelCheck = ComponentHealth.builder()
                    .status(embedModelFound ? "UP" : "MISSING")
                    .model(configuredEmbedModel)
                    .message(embedModelFound
                            ? "Model '" + configuredEmbedModel + "' is available"
                            : "Model '" + configuredEmbedModel + "' not found in Ollama")
                    .build();

            return new OllamaHealthResult(ollamaCheck, chatModelCheck, embedModelCheck);

        } catch (Exception e) {
            long latency = System.currentTimeMillis() - start;
            boolean isTimeout = isTimeoutException(e);

            String status = isTimeout ? "TIMEOUT" : "DOWN";
            String message = isTimeout
                    ? "Ollama service request timed out after " + latency + "ms"
                    : "Ollama service unreachable on configured port";

            ComponentHealth ollamaCheck = ComponentHealth.builder()
                    .status(status)
                    .latencyMs(latency)
                    .message(message)
                    .build();

            ComponentHealth chatModelCheck = ComponentHealth.builder()
                    .status("UNAVAILABLE")
                    .model(configuredChatModel)
                    .message("Cannot verify model: Ollama service is " + status.toLowerCase())
                    .build();

            ComponentHealth embedModelCheck = ComponentHealth.builder()
                    .status("UNAVAILABLE")
                    .model(configuredEmbedModel)
                    .message("Cannot verify model: Ollama service is " + status.toLowerCase())
                    .build();

            return new OllamaHealthResult(ollamaCheck, chatModelCheck, embedModelCheck);
        }
    }

    private ComponentHealth checkIndexing(boolean dbUp) {
        if (!dbUp) {
            return ComponentHealth.builder()
                    .status("UNAVAILABLE")
                    .message("Cannot determine indexing status: database unavailable")
                    .build();
        }

        try {
            long total = repositoryRepository.count();
            long running = repositoryRepository.countByIndexingStatusIgnoreCase("INDEXING");
            long failed = repositoryRepository.countByIndexingStatusIgnoreCase("FAILED");

            String status;
            String message;

            if (running > 0) {
                status = "RUNNING";
                message = running + " repository indexing task(s) in progress";
            } else if (failed > 0) {
                status = "FAILED";
                message = failed + " repository indexing failed";
            } else if (total > 0) {
                status = "IDLE";
                message = "All " + total + " repositories indexed successfully";
            } else {
                status = "IDLE";
                message = "No repositories imported yet";
            }

            return ComponentHealth.builder()
                    .status(status)
                    .activeCount(running)
                    .failedCount(failed)
                    .totalRepositories(total)
                    .message(message)
                    .build();
        } catch (Exception e) {
            return ComponentHealth.builder()
                    .status("UNKNOWN")
                    .message("Error querying repository indexing status")
                    .build();
        }
    }

    private ComponentHealth runInferenceTest(String chatModelStatus) {
        long start = System.currentTimeMillis();
        if (!"UP".equals(chatModelStatus)) {
            return ComponentHealth.builder()
                    .status("UNAVAILABLE")
                    .message("Chat model is not available for inference")
                    .build();
        }

        try {
            chatModel.call(new Prompt("ping"));
            return ComponentHealth.builder()
                    .status("UP")
                    .latencyMs(System.currentTimeMillis() - start)
                    .message("Chat model inference succeeded")
                    .build();
        } catch (Exception e) {
            return ComponentHealth.builder()
                    .status("FAILED")
                    .latencyMs(System.currentTimeMillis() - start)
                    .message("Chat model inference failed: " + e.getClass().getSimpleName())
                    .build();
        }
    }

    private String computeOverallStatus(
            ComponentHealth backend,
            ComponentHealth db,
            OllamaHealthResult ollamaResult,
            ComponentHealth indexing) {
        if (!"UP".equals(backend.getStatus()) || !"UP".equals(db.getStatus())) {
            return "SERVICE_UNAVAILABLE";
        }
        if (!"UP".equals(ollamaResult.ollamaCheck().getStatus())
                || !"UP".equals(ollamaResult.chatModelCheck().getStatus())
                || !"UP".equals(ollamaResult.embeddingModelCheck().getStatus())
                || "FAILED".equals(indexing.getStatus())) {
            return "DEGRADED";
        }
        return "OPERATIONAL";
    }

    private boolean matchesModel(String configured, List<String> availableModels) {
        if (configured == null || availableModels == null) return false;
        String target = configured.trim().toLowerCase();
        String targetBase = target.replaceFirst(":latest$", "");

        for (String available : availableModels) {
            if (available == null) continue;
            String cand = available.trim().toLowerCase();
            String candBase = cand.replaceFirst(":latest$", "");

            if (cand.equals(target) || candBase.equals(targetBase) || cand.equals(target + ":latest")) {
                return true;
            }
        }
        return false;
    }

    private boolean isTimeoutException(Throwable t) {
        if (t == null) return false;
        if (t instanceof SocketTimeoutException) return true;
        if (t.getCause() != null && isTimeoutException(t.getCause())) return true;
        return t.getMessage() != null && t.getMessage().toLowerCase().contains("timeout");
    }

    public record OllamaHealthResult(
            ComponentHealth ollamaCheck,
            ComponentHealth chatModelCheck,
            ComponentHealth embeddingModelCheck
    ) {}
}

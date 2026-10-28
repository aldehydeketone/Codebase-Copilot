package com.copilot.controller;

import com.copilot.model.health.ComponentHealth;
import com.copilot.model.health.SystemHealthResponse;
import com.copilot.service.health.HealthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class HealthControllerTest {

    @Mock
    private HealthService healthService;

    @InjectMocks
    private HealthController healthController;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(healthController).build();
    }

    @Test
    @DisplayName("GET /api/health returns 200 with structured health response")
    void getHealthEndpointReturnsStructuredResponse() throws Exception {
        SystemHealthResponse mockResponse = SystemHealthResponse.builder()
                .status("OPERATIONAL")
                .timestamp(1793204000000L)
                .checks(Map.of(
                        "backend", ComponentHealth.builder().status("UP").message("Backend API is responding").build(),
                        "database", ComponentHealth.builder().status("UP").message("PostgreSQL connection verified").build(),
                        "ollama", ComponentHealth.builder().status("UP").message("Ollama service is reachable").build(),
                        "chatModel", ComponentHealth.builder().status("UP").model("qwen3.5:4b").build(),
                        "embeddingModel", ComponentHealth.builder().status("UP").model("nomic-embed-text").build()
                ))
                .build();

        when(healthService.checkHealth(false)).thenReturn(mockResponse);

        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OPERATIONAL"))
                .andExpect(jsonPath("$.timestamp").value(1793204000000L))
                .andExpect(jsonPath("$.checks.backend.status").value("UP"))
                .andExpect(jsonPath("$.checks.database.status").value("UP"))
                .andExpect(jsonPath("$.checks.ollama.status").value("UP"))
                .andExpect(jsonPath("$.checks.chatModel.model").value("qwen3.5:4b"))
                .andExpect(jsonPath("$.checks.embeddingModel.model").value("nomic-embed-text"));
    }

    @Test
    @DisplayName("GET /api/health?testInference=true passes testInference flag to service")
    void getHealthWithTestInferenceFlag() throws Exception {
        SystemHealthResponse mockResponse = SystemHealthResponse.builder()
                .status("OPERATIONAL")
                .timestamp(1793204000000L)
                .checks(Map.of("backend", ComponentHealth.builder().status("UP").build()))
                .inferenceTest(ComponentHealth.builder().status("UP").message("Chat model inference succeeded").build())
                .build();

        when(healthService.checkHealth(true)).thenReturn(mockResponse);

        mockMvc.perform(get("/api/health?testInference=true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OPERATIONAL"))
                .andExpect(jsonPath("$.inferenceTest.status").value("UP"))
                .andExpect(jsonPath("$.inferenceTest.message").value("Chat model inference succeeded"));
    }
}

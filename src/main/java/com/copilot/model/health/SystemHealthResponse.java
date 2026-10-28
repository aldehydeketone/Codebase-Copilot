package com.copilot.model.health;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SystemHealthResponse {
    private String status;
    private long timestamp;
    private Map<String, ComponentHealth> checks;
    private ComponentHealth inferenceTest;
}

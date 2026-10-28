package com.copilot.model.health;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ComponentHealth {
    private String status;
    private Long latencyMs;
    private String message;
    private String model;
    private Long activeCount;
    private Long failedCount;
    private Long totalRepositories;
}

package com.copilot.controller;

import com.copilot.model.health.SystemHealthResponse;
import com.copilot.service.health.HealthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
public class HealthController {

    private final HealthService healthService;

    @GetMapping
    public ResponseEntity<SystemHealthResponse> getHealth(
            @RequestParam(name = "testInference", defaultValue = "false") boolean testInference) {
        SystemHealthResponse health = healthService.checkHealth(testInference);
        return ResponseEntity.ok(health);
    }
}

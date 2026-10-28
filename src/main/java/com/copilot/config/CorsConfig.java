package com.copilot.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;
import java.util.ArrayList;
import java.util.List;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    /** Comma-separated list of additional allowed origins (e.g. set via CORS_ALLOWED_ORIGINS env var). */
    @Value("${cors.allowed-origins:}")
    private String extraOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // Base patterns: localhost variants + any Cloudflare Quick Tunnel subdomain.
        // allowedOriginPatterns() supports wildcard segments and is compatible with
        // allowCredentials(true), unlike allowedOrigins("*").
        List<String> patterns = new ArrayList<>(List.of(
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "https://*.trycloudflare.com"  // ephemeral Quick Tunnel URLs
        ));

        // Also accept any extra patterns supplied via CORS_ALLOWED_ORIGINS env var.
        if (extraOrigins != null && !extraOrigins.isBlank()) {
            Arrays.stream(extraOrigins.split(","))
                  .map(String::trim)
                  .filter(s -> !s.isEmpty())
                  .forEach(patterns::add);
        }

        registry.addMapping("/api/**")
                .allowedOriginPatterns(patterns.toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}


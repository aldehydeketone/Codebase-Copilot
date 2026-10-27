package com.copilot.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class IgnoreLegacyDatasourceEnvironmentPostProcessorTest {
    @Test
    void stripsLegacyDatasourceOverridesAndLeavesProjectSpecificSettingsAvailable() {
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().replace("systemEnvironment", new MapPropertySource("systemEnvironment", Map.of(
                "SPRING_DATASOURCE_URL", "jdbc:postgresql://old-neon.invalid/neondb",
                "SPRING_DATASOURCE_USERNAME", "old-user",
                "SPRING_DATASOURCE_PASSWORD", "do-not-use",
                "COPILOT_DB_HOST", "127.0.0.1")));
        environment.getPropertySources().addLast(new MapPropertySource("projectSettings", Map.of(
                "spring.datasource.url", "jdbc:postgresql://127.0.0.1:5433/copilot_db")));

        new IgnoreLegacyDatasourceEnvironmentPostProcessor().postProcessEnvironment(environment, null);

        assertNull(environment.getProperty("SPRING_DATASOURCE_URL"));
        assertNull(environment.getProperty("SPRING_DATASOURCE_USERNAME"));
        assertNull(environment.getProperty("SPRING_DATASOURCE_PASSWORD"));
        assertEquals("127.0.0.1", environment.getProperty("COPILOT_DB_HOST"));
        assertEquals("jdbc:postgresql://127.0.0.1:5433/copilot_db",
                environment.getProperty("spring.datasource.url"));
    }
}

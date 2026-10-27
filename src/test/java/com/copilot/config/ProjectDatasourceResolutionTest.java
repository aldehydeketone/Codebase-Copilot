package com.copilot.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/** Proves stale inherited datasource variables cannot redirect this project's resolved database config. */
@SpringBootTest(classes = ProjectDatasourceResolutionTest.ProbeApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class ProjectDatasourceResolutionTest {
    @Autowired
    private Environment environment;

    @Test
    void resolvesProjectLocalPostgresSettingsInsteadOfInheritedSpringDatasourceVariables() {
        String url = environment.getProperty("spring.datasource.url");
        String username = environment.getProperty("spring.datasource.username");
        
        if ("test".equals(environment.getActiveProfiles()[0])) {
            assertEquals("jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL", url);
            assertEquals("sa", username);
        } else {
            assertEquals("jdbc:postgresql://127.0.0.1:5433/copilot_db", url);
            assertEquals("copilot_user", username);
        }
        assertNotNull(environment.getProperty("spring.datasource.password"));
        assertFalse(url.contains("neon"));
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration(exclude = {
            DataSourceAutoConfiguration.class,
            HibernateJpaAutoConfiguration.class,
            FlywayAutoConfiguration.class
    })
    static class ProbeApplication {
    }
}

package com.copilot.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.EnumerablePropertySource;
import org.springframework.core.env.PropertySource;
import org.springframework.core.env.SystemEnvironmentPropertySource;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Prevents stale global Spring datasource variables from overriding this project's database settings. */
public class IgnoreLegacyDatasourceEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {
    private static final Set<String> LEGACY_KEYS = Set.of(
            "spring_datasource_url", "spring.datasource.url",
            "spring_datasource_username", "spring.datasource.username",
            "spring_datasource_password", "spring.datasource.password");

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        PropertySource<?> source = environment.getPropertySources().get("systemEnvironment");
        if (!(source instanceof EnumerablePropertySource<?> enumerable)) {
            return;
        }

        Map<String, Object> filtered = new LinkedHashMap<>();
        for (String name : enumerable.getPropertyNames()) {
            if (!LEGACY_KEYS.contains(name.toLowerCase(Locale.ROOT))) {
                filtered.put(name, enumerable.getProperty(name));
            }
        }
        environment.getPropertySources().replace(source.getName(),
                new SystemEnvironmentPropertySource(source.getName(), filtered));
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}

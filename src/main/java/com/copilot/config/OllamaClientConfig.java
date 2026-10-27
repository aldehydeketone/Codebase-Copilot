package com.copilot.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;

@Configuration
@Slf4j
public class OllamaClientConfig {

    @Value("${copilot.ollama.connect-timeout:10s}")
    private Duration connectTimeout;

    @Value("${copilot.ollama.read-timeout:180s}")
    private Duration readTimeout;

    @Bean
    public RestClientCustomizer ollamaRestClientCustomizer() {
        return restClientBuilder -> {
            SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
            requestFactory.setConnectTimeout((int) connectTimeout.toMillis());
            requestFactory.setReadTimeout((int) readTimeout.toMillis());
            restClientBuilder.requestFactory(requestFactory);
            log.info("Configured Spring REST client timeouts: connectMs={}, readMs={}",
                    connectTimeout.toMillis(), readTimeout.toMillis());
        };
    }
}

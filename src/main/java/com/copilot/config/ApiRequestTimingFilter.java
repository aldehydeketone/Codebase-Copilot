package com.copilot.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Ordered.LOWEST_PRECEDENCE)
@Slf4j
public class ApiRequestTimingFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (!request.getRequestURI().startsWith("/api/")) {
            filterChain.doFilter(request, response);
            return;
        }

        long started = System.nanoTime();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long durationMillis = (System.nanoTime() - started) / 1_000_000;
            String message = "API request completed: method={}, path={}, status={}, durationMs={}";
            if (durationMillis >= 30_000) {
                log.warn(message, request.getMethod(), request.getRequestURI(), response.getStatus(), durationMillis);
            } else {
                log.info(message, request.getMethod(), request.getRequestURI(), response.getStatus(), durationMillis);
            }
        }
    }
}

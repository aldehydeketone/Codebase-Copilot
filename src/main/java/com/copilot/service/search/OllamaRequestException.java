package com.copilot.service.search;

import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;

public class OllamaRequestException extends RuntimeException {
    private final String stage;

    public OllamaRequestException(String stage, Throwable cause) {
        super("Ollama request failed during " + stage, cause);
        this.stage = stage;
    }

    public String getStage() {
        return stage;
    }

    public boolean isTimeout() {
        Throwable current = getCause();
        while (current != null) {
            if (current instanceof SocketTimeoutException || current instanceof HttpTimeoutException) return true;
            current = current.getCause();
        }
        return false;
    }
}

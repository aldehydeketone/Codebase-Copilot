package com.copilot.service.embedding;

import lombok.RequiredArgsConstructor;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class EmbeddingService {
    public static final int REQUIRED_DIMENSIONS = 768;

    private final EmbeddingModel embeddingModel;

    public float[] embed(String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Embedding input must not be blank");
        }
        float[] vector = embeddingModel.embed(text);
        if (vector == null || vector.length != REQUIRED_DIMENSIONS) {
            int actual = vector == null ? 0 : vector.length;
            throw new IllegalStateException("Embedding model returned " + actual
                    + " dimensions; expected " + REQUIRED_DIMENSIONS);
        }
        for (float value : vector) {
            if (!Float.isFinite(value)) {
                throw new IllegalStateException("Embedding model returned a non-finite value");
            }
        }
        return vector;
    }

    public String toPgVector(float[] vector) {
        if (vector == null || vector.length != REQUIRED_DIMENSIONS) {
            throw new IllegalArgumentException("A " + REQUIRED_DIMENSIONS + "-dimension vector is required");
        }
        StringBuilder value = new StringBuilder(vector.length * 12).append('[');
        for (int index = 0; index < vector.length; index++) {
            if (index > 0) {
                value.append(',');
            }
            value.append(String.format(Locale.ROOT, "%.8f", vector[index]));
        }
        return value.append(']').toString();
    }
}

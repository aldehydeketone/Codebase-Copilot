package com.copilot.service.embedding;

import org.junit.jupiter.api.Test;
import org.springframework.ai.embedding.EmbeddingModel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EmbeddingServiceTest {
    @Test
    void acceptsOnlyRealModelVectorsWithTheRequiredDimension() {
        EmbeddingModel model = mock(EmbeddingModel.class);
        float[] vector = new float[EmbeddingService.REQUIRED_DIMENSIONS];
        when(model.embed("test input")).thenReturn(vector);

        assertEquals(EmbeddingService.REQUIRED_DIMENSIONS,
                new EmbeddingService(model).embed("test input").length);
    }

    @Test
    void rejectsVectorsWithAnUnexpectedDimension() {
        EmbeddingModel model = mock(EmbeddingModel.class);
        when(model.embed("test input")).thenReturn(new float[4]);

        assertThrows(IllegalStateException.class, () -> new EmbeddingService(model).embed("test input"));
    }
}

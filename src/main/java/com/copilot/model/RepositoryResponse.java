package com.copilot.model;

import java.time.OffsetDateTime;
import java.util.UUID;

public record RepositoryResponse(
        UUID id,
        String name,
        String sourceType,
        String sourcePath,
        String indexingStatus,
        String errorDetails,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        int indexedFileCount,
        int indexedChunkCount) { }

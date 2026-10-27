package com.copilot.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "repositories")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Repository {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "source_type", nullable = false)
    private String sourceType;

    @Column(name = "source_path", nullable = false)
    private String sourcePath;

    @Column(name = "indexing_status")
    private String indexingStatus;

    @Column(name = "error_details")
    private String errorDetails;

    @Builder.Default
    @Column(name = "created_at")
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Builder.Default
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}

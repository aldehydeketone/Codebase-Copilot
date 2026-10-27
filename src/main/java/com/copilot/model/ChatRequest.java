package com.copilot.model;

import lombok.*;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatRequest {
    private UUID repositoryId;
    private String question;
    private Integer topK;
}

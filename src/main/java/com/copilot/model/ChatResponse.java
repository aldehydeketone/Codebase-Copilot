package com.copilot.model;

import lombok.*;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatResponse {
    private String answer;
    private List<Citation> citations;
    private boolean noConfidentContext;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Citation {
        private int id;
        private String filePath;
        private int startLine;
        private int endLine;
        private String snippet;
    }
}

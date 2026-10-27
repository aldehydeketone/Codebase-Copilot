package com.copilot.controller;

import com.copilot.model.ChatRequest;
import com.copilot.model.ChatResponse;
import com.copilot.service.rag.RagChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final RagChatService ragChatService;

    @PostMapping
    public ResponseEntity<ChatResponse> chat(@RequestBody(required = false) ChatRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        if (request.getRepositoryId() == null) {
            throw new IllegalArgumentException("Repository ID is required");
        }
        if (request.getQuestion() == null || request.getQuestion().isBlank()) {
            throw new IllegalArgumentException("Question must not be blank");
        }
        if (request.getQuestion().length() > 2000) {
            throw new IllegalArgumentException("Question exceeds maximum length of 2000 characters");
        }

        return ResponseEntity.ok(ragChatService.chat(request));
    }
}

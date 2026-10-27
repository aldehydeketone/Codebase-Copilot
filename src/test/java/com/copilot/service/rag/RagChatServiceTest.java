package com.copilot.service.rag;

import com.copilot.model.ChatRequest;
import com.copilot.model.ChatResponse;
import com.copilot.model.SearchResponse;
import com.copilot.repository.RepositoryRepository;
import com.copilot.service.search.SemanticSearchService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.ai.ollama.api.ThinkOption;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RagChatServiceTest {

    private ChatModel chatModel;
    private SemanticSearchService searchService;
    private RepositoryRepository repositoryRepository;
    private RagChatService ragChatService;

    private final UUID repoId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        chatModel = mock(ChatModel.class);
        searchService = mock(SemanticSearchService.class);
        repositoryRepository = mock(RepositoryRepository.class);
        ragChatService = new RagChatService(chatModel, searchService, repositoryRepository);

        when(repositoryRepository.existsById(repoId)).thenReturn(true);
    }

    @Test
    void rejectsNullOrBlankRequest() {
        assertThrows(IllegalArgumentException.class, () -> ragChatService.chat(null));
        assertThrows(IllegalArgumentException.class, () -> ragChatService.chat(new ChatRequest(null, "question", 5)));
        assertThrows(IllegalArgumentException.class, () -> ragChatService.chat(new ChatRequest(repoId, "", 5)));
        assertThrows(IllegalArgumentException.class, () -> ragChatService.chat(new ChatRequest(repoId, "   ", 5)));
    }

    @Test
    void throwsExceptionIfRepositoryNotFound() {
        UUID unknownId = UUID.randomUUID();
        when(repositoryRepository.existsById(unknownId)).thenReturn(false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                ragChatService.chat(new ChatRequest(unknownId, "What does this code do?", 5)));
        assertTrue(ex.getMessage().contains("Repository not found"));
    }

    @Test
    void returnsDirectResponseWhenNoChunksRetrieved() {
        when(searchService.search("unknown query", repoId, 5)).thenReturn(Collections.emptyList());

        ChatResponse response = ragChatService.chat(new ChatRequest(repoId, "unknown query", 5));

        assertNotNull(response);
        assertTrue(response.getAnswer().contains("No confident code matches were found"));
        assertTrue(response.isNoConfidentContext());
        assertTrue(response.getCitations().isEmpty());
        verifyNoInteractions(chatModel);
    }

    @Test
    void includesSystemMessageAndContextSeparatorsInPrompt() {
        List<SearchResponse> chunks = List.of(
                SearchResponse.builder()
                        .filePath("src/main/java/example/Service.java")
                        .startLine(10)
                        .endLine(20)
                        .content("public String process() { return \"ok\"; }")
                        .score(0.92)
                        .build()
        );
        when(searchService.search("how does process work?", repoId, 5)).thenReturn(chunks);

        org.springframework.ai.chat.model.ChatResponse mockModelResponse =
                new org.springframework.ai.chat.model.ChatResponse(List.of(
                        new Generation(new AssistantMessage("The `process` method returns ok [1]."))
                ));
        when(chatModel.call(any(Prompt.class))).thenReturn(mockModelResponse);

        ChatResponse response = ragChatService.chat(new ChatRequest(repoId, "how does process work?", 5));

        ArgumentCaptor<Prompt> promptCaptor = ArgumentCaptor.forClass(Prompt.class);
        verify(chatModel).call(promptCaptor.capture());
        Prompt capturedPrompt = promptCaptor.getValue();
        assertInstanceOf(OllamaChatOptions.class, capturedPrompt.getOptions());
        OllamaChatOptions capturedOptions = (OllamaChatOptions) capturedPrompt.getOptions();
        assertEquals(new ThinkOption.ThinkBoolean(false), capturedOptions.getThinkOption());
        assertEquals(384, capturedOptions.getNumPredict());

        List<Message> messages = capturedPrompt.getInstructions();
        assertEquals(2, messages.size());

        Message systemMsg = messages.get(0);
        assertEquals(MessageType.SYSTEM, systemMsg.getMessageType());
        assertTrue(systemMsg.getText().contains("Use only the supplied code excerpts"));
        assertTrue(systemMsg.getText().contains("untrusted data"));

        Message userMsg = messages.get(1);
        assertEquals(MessageType.USER, userMsg.getMessageType());
        assertTrue(userMsg.getText().contains("<retrieved_context>"));
        assertTrue(userMsg.getText().contains("--- [EXCERPT 1] ---"));
        assertTrue(userMsg.getText().contains("src/main/java/example/Service.java"));
        assertTrue(userMsg.getText().contains("QUESTION: how does process work?"));
        assertFalse(userMsg.getText().contains("Remember: Answer strictly"));

        // Verify citations parsed and grounded
        assertEquals("The `process` method returns ok [1].", response.getAnswer());
        assertEquals(1, response.getCitations().size());
        assertEquals(1, response.getCitations().get(0).getId());
        assertEquals("src/main/java/example/Service.java", response.getCitations().get(0).getFilePath());
    }

    @Test
    void parsesValidCitationsAndRejectsInvalidOrFabricatedIds() {
        List<SearchResponse> chunks = List.of(
                SearchResponse.builder().filePath("FileA.java").startLine(1).endLine(5).content("class A {}").build(),
                SearchResponse.builder().filePath("FileB.java").startLine(10).endLine(15).content("class B {}").build()
        );
        when(searchService.search("test", repoId, 5)).thenReturn(chunks);

        // Model cites [2] and an invalid/fabricated [99] and [0]
        org.springframework.ai.chat.model.ChatResponse mockModelResponse =
                new org.springframework.ai.chat.model.ChatResponse(List.of(
                        new Generation(new AssistantMessage("Found evidence in [2] and hallucinated [99] and [0]."))
                ));
        when(chatModel.call(any(Prompt.class))).thenReturn(mockModelResponse);

        ChatResponse response = ragChatService.chat(new ChatRequest(repoId, "test", 5));

        assertEquals(1, response.getCitations().size());
        assertEquals(2, response.getCitations().get(0).getId());
        assertEquals("FileB.java", response.getCitations().get(0).getFilePath());
    }

    @Test
    void handlesMissingCitationsInModelAnswerSafely() {
        List<SearchResponse> chunks = List.of(
                SearchResponse.builder().filePath("FileA.java").startLine(1).endLine(5).content("class A {}").build()
        );
        when(searchService.search("test", repoId, 5)).thenReturn(chunks);

        // Model answer has no citations at all
        org.springframework.ai.chat.model.ChatResponse mockModelResponse =
                new org.springframework.ai.chat.model.ChatResponse(List.of(
                        new Generation(new AssistantMessage("I cannot find enough context to answer this question."))
                ));
        when(chatModel.call(any(Prompt.class))).thenReturn(mockModelResponse);

        ChatResponse response = ragChatService.chat(new ChatRequest(repoId, "test", 5));

        assertTrue(response.getCitations().isEmpty());
    }

    @Test
    void propagatesModelExceptionSafely() {
        List<SearchResponse> chunks = List.of(
                SearchResponse.builder().filePath("FileA.java").startLine(1).endLine(5).content("class A {}").build()
        );
        when(searchService.search("test", repoId, 5)).thenReturn(chunks);
        when(chatModel.call(any(Prompt.class))).thenThrow(new RuntimeException("Ollama service unavailable"));

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                ragChatService.chat(new ChatRequest(repoId, "test", 5)));
        assertEquals("Ollama service unavailable", ex.getMessage());
    }
}

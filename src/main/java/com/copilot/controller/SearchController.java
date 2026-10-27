package com.copilot.controller;

import com.copilot.model.SearchRequest;
import com.copilot.model.SearchResponse;
import com.copilot.service.search.SemanticSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {
    private final SemanticSearchService semanticSearchService;

    @PostMapping
    public ResponseEntity<List<SearchResponse>> search(@RequestBody SearchRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        return ResponseEntity.ok(semanticSearchService.search(
                request.getQuery(), request.getRepositoryId(), request.getLimit()));
    }
}

package com.copilot.controller;

import com.copilot.model.Repository;
import com.copilot.model.RepositoryImportRequest;
import com.copilot.model.RepositoryResponse;
import com.copilot.service.ingestion.RepositoryIngestionService;
import com.copilot.service.ingestion.RepositoryResponseMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/repositories")
@RequiredArgsConstructor
public class RepositoryController {

    private final RepositoryIngestionService ingestionService;
    private final com.copilot.repository.RepositoryRepository repositoryRepository;
    private final RepositoryResponseMapper repositoryResponseMapper;

    @PostMapping("/import")
    public ResponseEntity<RepositoryResponse> importRepository(@RequestBody RepositoryImportRequest request) {
        if (request == null) {
            throw new com.copilot.service.ingestion.InvalidRepositoryPathException("Request body is required");
        }
        Repository repo = ingestionService.importLocalRepository(request.getPath(), request.getName());
        return ResponseEntity.ok(repositoryResponseMapper.toResponse(repo));
    }

    @GetMapping
    public ResponseEntity<List<RepositoryResponse>> getAllRepositories() {
        return ResponseEntity.ok(repositoryResponseMapper.toResponses(repositoryRepository.findAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RepositoryResponse> getRepository(@PathVariable java.util.UUID id) {
        return repositoryRepository.findById(id)
                .map(repositoryResponseMapper::toResponse)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}

package com.copilot.service.ingestion;

public record ParsedCodeChunk(String symbolName, int startLine, int endLine, String content) {
}

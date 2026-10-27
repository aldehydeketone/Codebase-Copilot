package com.copilot.service.ingestion;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JavaSourceParserTest {
    private final JavaSourceParser parser = new JavaSourceParser();

    @Test
    void createsMethodChunksWithExactSourceLinesAndSymbols() {
        String source = "package example;\n\npublic class Greeting {\n    public String message() {\n        return \"hello\";\n    }\n}\n";

        List<ParsedCodeChunk> chunks = parser.parse(Path.of("Greeting.java"), source);

        assertEquals(1, chunks.size());
        assertEquals("Greeting#message", chunks.get(0).symbolName());
        assertEquals(4, chunks.get(0).startLine());
        assertEquals(6, chunks.get(0).endLine());
        assertTrue(chunks.get(0).content().contains("return \"hello\";"));
    }

    @Test
    void reportsInvalidJavaSyntaxWithTheSourceLine() {
        String source = "class Broken {\n    void method( {\n}\n";

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> parser.parse(Path.of("Broken.java"), source));

        assertTrue(error.getMessage().contains("Java syntax error"));
        assertTrue(error.getMessage().contains("line 2"));
    }
}

package com.copilot.service.ingestion;

import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.util.JavacTask;
import com.sun.source.util.SourcePositions;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.Trees;
import org.springframework.stereotype.Component;

import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.SimpleJavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Component
public class JavaSourceParser {

    public List<ParsedCodeChunk> parse(Path file, String source) {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            throw new IllegalStateException("A JDK compiler is required to parse Java source");
        }

        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        JavaFileObject sourceObject = new StringSource(file.getFileName().toString(), source);
        try (StandardJavaFileManager fileManager = compiler.getStandardFileManager(diagnostics, Locale.ROOT, null)) {
            JavacTask task = (JavacTask) compiler.getTask(null, fileManager, diagnostics,
                    List.of("-proc:none"), null, List.of(sourceObject));
            CompilationUnitTree unit = task.parse().iterator().next();
            List<Diagnostic<? extends JavaFileObject>> errors = diagnostics.getDiagnostics().stream()
                    .filter(diagnostic -> diagnostic.getKind() == Diagnostic.Kind.ERROR)
                    .toList();
            if (!errors.isEmpty()) {
                Diagnostic<? extends JavaFileObject> first = errors.get(0);
                throw new IllegalArgumentException("Java syntax error in " + file + " at line "
                        + first.getLineNumber() + ": " + first.getMessage(Locale.ROOT));
            }

            SourcePositions positions = Trees.instance(task).getSourcePositions();
            List<ParsedCodeChunk> chunks = new ArrayList<>();
            Deque<String> typeNames = new ArrayDeque<>();
            new TreePathScanner<Void, Void>() {
                @Override
                public Void visitClass(ClassTree node, Void unused) {
                    String name = node.getSimpleName().toString();
                    typeNames.addLast(name.isBlank() ? "<anonymous>" : name);
                    try {
                        return super.visitClass(node, unused);
                    } finally {
                        typeNames.removeLast();
                    }
                }

                @Override
                public Void visitMethod(MethodTree node, Void unused) {
                    long start = positions.getStartPosition(unit, node);
                    long end = positions.getEndPosition(unit, node);
                    if (start >= 0 && end > start && end <= source.length()) {
                        String symbol = typeNames.stream().collect(Collectors.joining("."))
                                + "#" + node.getName();
                        int startLine = (int) unit.getLineMap().getLineNumber(start);
                        int endLine = (int) unit.getLineMap().getLineNumber(end - 1);
                        String content = source.substring((int) start, (int) end).strip();
                        chunks.add(new ParsedCodeChunk(symbol, startLine, endLine, content));
                    }
                    return super.visitMethod(node, unused);
                }
            }.scan(unit, null);

            if (chunks.isEmpty() && !unit.getTypeDecls().isEmpty()) {
                long start = positions.getStartPosition(unit, unit.getTypeDecls().get(0));
                long end = positions.getEndPosition(unit, unit.getTypeDecls().get(0));
                if (start >= 0 && end > start && end <= source.length()) {
                    String symbol = unit.getTypeDecls().get(0) instanceof ClassTree classTree
                            ? classTree.getSimpleName().toString() : file.getFileName().toString();
                    chunks.add(new ParsedCodeChunk(symbol,
                            (int) unit.getLineMap().getLineNumber(start),
                            (int) unit.getLineMap().getLineNumber(end - 1),
                            source.substring((int) start, (int) end).strip()));
                }
            }
            chunks.sort((left, right) -> Integer.compare(left.startLine(), right.startLine()));
            return chunks;
        } catch (IOException exception) {
            throw new IllegalArgumentException("Unable to parse " + file + ": " + exception.getMessage(), exception);
        }
    }

    private static final class StringSource extends SimpleJavaFileObject {
        private final String source;

        private StringSource(String fileName, String source) {
            super(URI.create("string:///" + fileName.replace('\\', '/')), Kind.SOURCE);
            this.source = source;
        }

        @Override
        public CharSequence getCharContent(boolean ignoreEncodingErrors) {
            return source;
        }
    }
}

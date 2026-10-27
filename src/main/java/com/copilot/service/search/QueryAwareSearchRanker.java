package com.copilot.service.search;

import com.copilot.model.SearchResponse;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Reranks semantic candidates with source-token overlap while preserving the raw cosine score. */
@Component
public class QueryAwareSearchRanker {
    private static final Pattern CAMEL_BOUNDARY = Pattern.compile("(?<=[a-z0-9])(?=[A-Z])");
    private static final Pattern TOKEN = Pattern.compile("[^a-z0-9]+");
    private static final Set<String> STOP_WORDS = Set.of(
            "a", "an", "and", "are", "as", "at", "be", "by", "does", "do", "for", "from", "give",
            "has", "have", "how", "in", "into", "is", "it", "of", "on", "or", "the", "this", "to",
            "what", "which", "who", "with", "where", "when", "why"
    );
    private static final Pattern BEHAVIOR_INTENT = Pattern.compile(
            "(?i)\\b(where|how|calculate|calculated|calculates|calculating|validate|validates|updated|update|"
                    + "handle|handles|create|creates|process|processes|check|checks|reserve|implementation|implemented)\\b");

    public List<SearchResponse> rank(String query, List<SearchResponse> candidates, double minimumCosineScore, int limit) {
        if (candidates == null || candidates.isEmpty()) return List.of();

        Set<String> queryTerms = terms(query);
        boolean behaviorIntent = query != null && BEHAVIOR_INTENT.matcher(query).find();
        return candidates.stream()
                .filter(candidate -> candidate.getScore() >= minimumCosineScore)
                .map(candidate -> new Ranked(candidate, rankScore(candidate, queryTerms, behaviorIntent)))
                .sorted(Comparator.comparingDouble(Ranked::rankScore).reversed()
                        .thenComparing(Comparator.comparingDouble((Ranked value) -> value.result().getScore()).reversed())
                        .thenComparing(value -> value.result().getFilePath())
                        .thenComparingInt(value -> value.result().getStartLine()))
                .limit(limit)
                .map(Ranked::result)
                .toList();
    }

    private double rankScore(SearchResponse result, Set<String> queryTerms, boolean behaviorIntent) {
        Set<String> sourceTerms = terms(String.join(" ",
                nullToEmpty(result.getSymbolName()), nullToEmpty(result.getFilePath()), nullToEmpty(result.getContent())));
        long overlap = queryTerms.stream().filter(sourceTerms::contains).count();
        double lexicalCoverage = queryTerms.isEmpty() ? 0d : (double) overlap / queryTerms.size();
        double executableSymbolBonus = behaviorIntent && result.getSymbolName() != null
                && result.getSymbolName().contains("#") ? 0.02d : 0d;
        return result.getScore() + 0.06d * lexicalCoverage + executableSymbolBonus;
    }

    private Set<String> terms(String text) {
        if (text == null || text.isBlank()) return Set.of();
        String camelSeparated = CAMEL_BOUNDARY.matcher(text).replaceAll(" ");
        return TOKEN.splitAsStream(camelSeparated.toLowerCase(Locale.ROOT))
                .map(this::normalize)
                .filter(token -> token.length() > 1 && !STOP_WORDS.contains(token))
                .collect(Collectors.toSet());
    }

    private String normalize(String token) {
        if (token.endsWith("ing") && token.length() > 5) return token.substring(0, token.length() - 3);
        if (token.endsWith("ed") && token.length() > 4) return token.substring(0, token.length() - 2);
        if (token.endsWith("es") && token.length() > 4) return token.substring(0, token.length() - 2);
        if (token.endsWith("s") && token.length() > 3) return token.substring(0, token.length() - 1);
        if (token.endsWith("e") && token.length() > 4) return token.substring(0, token.length() - 1);
        return token;
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private record Ranked(SearchResponse result, double rankScore) { }
}

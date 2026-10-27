package com.copilot.service.search;

import com.copilot.model.SearchResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class QueryAwareSearchRankerTest {
    private final QueryAwareSearchRanker ranker = new QueryAwareSearchRanker();

    @Test
    void behaviorQuestionRanksImplementationAheadOfHigherCosineDataHolder() {
        SearchResponse dataHolder = result("Order.java", "Order", "private BigDecimal total;", 0.607);
        SearchResponse implementation = result("PaymentService.java", "PaymentService#calculateTotal",
                "BigDecimal calculateTotal() { return subtotal.add(tax).setScale(2); }", 0.585);

        List<SearchResponse> ranked = ranker.rank("Where is order total calculated, including tax and rounding?",
                List.of(dataHolder, implementation), 0.52, 5);

        assertEquals("PaymentService.java", ranked.getFirst().getFilePath());
        assertEquals(0.585, ranked.getFirst().getScore(), 0.000001, "API score remains the raw cosine score");
    }

    @Test
    void calibratedFloorKeepsObservedRelevantBoundaryAndRejectsObservedAbsentBoundary() {
        SearchResponse relevant = result("PaymentService.java", "PaymentService#calculateTotal",
                "calculate total and apply tax", 0.522);
        SearchResponse unrelated = result("CheckoutService.java", "CheckoutService#checkout",
                "create order and handle payment", 0.512);

        List<SearchResponse> ranked = ranker.rank("Where is order total calculated?",
                List.of(unrelated, relevant), 0.52, 10);

        assertEquals(List.of(relevant), ranked);
    }

    @Test
    void absentTopicBelowCalibratedFloorReturnsNoConfidentResults() {
        assertTrue(ranker.rank("How does shipping encryption work?",
                List.of(result("CheckoutService.java", "CheckoutService#checkout", "create order", 0.484)),
                0.52, 10).isEmpty());
    }

    @Test
    void emptyCandidatesStayEmpty() {
        assertTrue(ranker.rank("query", List.of(), 0.52, 10).isEmpty());
    }

    private SearchResponse result(String path, String symbol, String content, double score) {
        return SearchResponse.builder().filePath(path).symbolName(symbol).content(content)
                .startLine(1).endLine(4).score(score).build();
    }
}

package com.ershak.coach;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MoodTest {

    @Test
    @DisplayName("Mood follows the percent of budget left: >60 playful, 25-60 calm, <25 firm")
    void boundaries() {
        assertEquals(Mood.PLAYFUL, Mood.fromLeftPercent(new BigDecimal("60.01")));
        assertEquals(Mood.CALM, Mood.fromLeftPercent(new BigDecimal("60")));
        assertEquals(Mood.CALM, Mood.fromLeftPercent(new BigDecimal("25")));
        assertEquals(Mood.FIRM, Mood.fromLeftPercent(new BigDecimal("24.99")));
        assertEquals(Mood.FIRM, Mood.fromLeftPercent(new BigDecimal("-10")));
    }
}

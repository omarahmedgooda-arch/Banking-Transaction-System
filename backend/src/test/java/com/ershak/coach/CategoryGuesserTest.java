package com.ershak.coach;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CategoryGuesserTest {

    @Test
    @DisplayName("Common Egyptian merchants map to the right category")
    void merchants() {
        assertEquals("groceries", CategoryGuesser.guess("CARREFOUR MAADI"));
        assertEquals("outings", CategoryGuesser.guess("TALABAT"));
        assertEquals("transport", CategoryGuesser.guess("UBER"));
        assertEquals("subscriptions", CategoryGuesser.guess("NETFLIX"));
        assertEquals("health", CategoryGuesser.guess("صيدلية العزبي"));
        assertEquals("other", CategoryGuesser.guess("Ahmed"));
    }
}

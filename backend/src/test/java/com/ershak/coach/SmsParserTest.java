package com.ershak.coach;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SmsParserTest {

    @Test
    @DisplayName("Arabic purchase SMS: amount, merchant and debit")
    void arabicPurchase() {
        var p = SmsParser.parse("تم خصم مبلغ 250.00 جنيه من حسابك رقم ***1234 لدى CARREFOUR MAADI في 27/11").orElseThrow();
        assertEquals(new BigDecimal("250.00"), p.amount());
        assertEquals("CARREFOUR MAADI", p.merchant());
        assertTrue(p.debit());
    }

    @Test
    @DisplayName("English card SMS with thousands separator")
    void englishCard() {
        var p = SmsParser.parse("Your card ending 1234 was charged EGP 1,250.50 at ZARA CITY STARS on 27-11-2026").orElseThrow();
        assertEquals(new BigDecimal("1250.50"), p.amount());
        assertEquals("ZARA CITY STARS", p.merchant());
        assertTrue(p.debit());
    }

    @Test
    @DisplayName("Arabic-Indic digits and a deposit are read as money coming in")
    void depositWithArabicDigits() {
        var p = SmsParser.parse("تم إيداع ٥٠٠٠ ج.م في حسابك").orElseThrow();
        assertEquals(new BigDecimal("5000.00"), p.amount());
        assertFalse(p.debit());
    }

    @Test
    @DisplayName("A message without an amount gives nothing")
    void noAmount() {
        assertTrue(SmsParser.parse("كود التحقق الخاص بك هو").isEmpty());
        assertTrue(SmsParser.parse("").isEmpty());
    }
}

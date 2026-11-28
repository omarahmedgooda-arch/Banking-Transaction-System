package com.ershak.coach;

import com.ershak.db.Database;
import com.ershak.exception.ForbiddenException;
import com.ershak.exception.InvalidAmountException;
import com.ershak.exception.ValidationException;
import com.ershak.model.User;
import com.ershak.service.Bank;
import com.ershak.util.BankClock;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.ZonedDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The coach against a real temporary SQLite database, with the clock fixed on 20 November 2026. */
class CoachServiceTest {

    private File dbFile;
    private Bank bank;
    private User ali;
    private User sara;

    @BeforeEach
    void setUp() throws Exception {
        dbFile = File.createTempFile("ershak-coach", ".db");
        bank = new Bank(Database.init("jdbc:sqlite:" + dbFile.getAbsolutePath()));
        BankClock.useClock(Clock.fixed(ZonedDateTime.of(2026, 11, 20, 12, 0, 0, 0, BankClock.ZONE).toInstant(),
                BankClock.ZONE));
        ali = bank.auth.register("Ali Hassan", "ali@test.com", "01011111111", "ali", "Password1");
        sara = bank.auth.register("Sara Mahmoud", "sara@test.com", "01022222222", "sara", "Password1");
    }

    @AfterEach
    void tearDown() {
        BankClock.reset();
        dbFile.delete();
    }

    private long cat(String code) {
        return bank.coach.categories(ali.getId()).stream().filter(c -> code.equals(c.code())).findFirst()
                .orElseThrow().id();
    }

    @Test
    @DisplayName("Built-in categories exist, with essential and non-essential ones")
    void defaultCategories() {
        var cats = bank.coach.categories(ali.getId());
        assertEquals(13, cats.size());
        assertTrue(cats.stream().anyMatch(c -> "bills".equals(c.code()) && c.essential()));
        assertTrue(cats.stream().anyMatch(c -> "outings".equals(c.code()) && !c.essential()));
    }

    @Test
    @DisplayName("Overview: spent, left and the mood follow the budget")
    void overviewAndMood() {
        bank.coach.setBudget(ali.getId(), "2026-11", new BigDecimal("1000"));
        bank.coach.addExpense(ali.getId(), cat("bills"), new BigDecimal("300"), "كهربا", null, null, "2026-11-05");
        var ov = bank.coach.overview(ali.getId(), "2026-11");
        assertEquals(0, new BigDecimal("300").compareTo(ov.spent()));
        assertEquals(0, new BigDecimal("700").compareTo(ov.left()));
        assertEquals(Mood.PLAYFUL, ov.mood());

        bank.coach.addExpense(ali.getId(), cat("outings"), new BigDecimal("500"), null, null, null, "2026-11-06");
        assertEquals(Mood.FIRM, bank.coach.overview(ali.getId(), "2026-11").mood());
    }

    @Test
    @DisplayName("Without a budget, the coach asks for one")
    void noBudget() {
        var ov = bank.coach.overview(ali.getId(), "2026-11");
        assertNull(ov.budget());
        assertEquals(Mood.CALM, ov.mood());
    }

    @Test
    @DisplayName("Crossing 90% of the budget sends one alert, only once")
    void budgetAlertOnce() {
        bank.coach.setBudget(ali.getId(), "2026-11", new BigDecimal("1000"));
        var first = bank.coach.addExpense(ali.getId(), cat("groceries"), new BigDecimal("920"), null, null, null, null);
        assertEquals(1, first.alerts().size());
        var second = bank.coach.addExpense(ali.getId(), cat("groceries"), new BigDecimal("10"), null, null, null, null);
        assertTrue(second.alerts().isEmpty());
    }

    @Test
    @DisplayName("Validation: no zero amounts, no future dates")
    void validation() {
        assertThrows(InvalidAmountException.class, () ->
                bank.coach.addExpense(ali.getId(), cat("bills"), BigDecimal.ZERO, null, null, null, null));
        assertThrows(ValidationException.class, () ->
                bank.coach.addExpense(ali.getId(), cat("bills"), BigDecimal.TEN, null, null, null, "2026-12-01"));
    }

    @Test
    @DisplayName("Nobody can edit or delete another person's expense")
    void ownership() {
        var e = bank.coach.addExpense(ali.getId(), cat("bills"), BigDecimal.TEN, null, null, null, null).expense();
        assertThrows(ForbiddenException.class, () -> bank.coach.deleteExpense(sara.getId(), e.id()));
        bank.coach.deleteExpense(ali.getId(), e.id());
        assertFalse(bank.coach.expenses(ali.getId(), "2026-11").stream().anyMatch(x -> x.id() == e.id()));
    }

    @Test
    @DisplayName("A bank SMS becomes a suggested expense in the right category")
    void sms() {
        var s = bank.coach.fromSms(ali.getId(), "تم خصم مبلغ 120.50 جنيه لدى TALABAT");
        assertEquals(new BigDecimal("120.50"), s.amount());
        assertEquals("outings", s.category().code());
    }
}

package com.ershak.model;

import com.ershak.exception.AccountFrozenException;
import com.ershak.exception.InsufficientFundsException;
import com.ershak.exception.InvalidAmountException;
import com.ershak.exception.LimitExceededException;
import com.ershak.service.BankSettings;
import com.ershak.util.Money;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AccountTest {

    private final BankSettings settings = BankSettings.defaults();

    private Account account(AccountType type, String balance) {
        Account a = AccountFactory.create(type, settings);
        a.setAccountNumber("100112345678");
        a.setBalance(new BigDecimal(balance));
        return a;
    }

    @Test
    @DisplayName("Factory builds the right subclass for each type")
    void factoryCreatesSubclasses() {
        assertTrue(AccountFactory.create(AccountType.SAVINGS, settings) instanceof SavingsAccount);
        assertTrue(AccountFactory.create(AccountType.CURRENT, settings) instanceof CurrentAccount);
    }

    @Test
    @DisplayName("Current account allows going down to the overdraft limit")
    void currentAccountOverdraft() {
        Account a = account(AccountType.CURRENT, "500");
        assertEquals(Money.of("2500"), a.getAvailableBalance());
        a.debit(new BigDecimal("2500"));
        assertEquals(Money.of("-2000"), a.getBalance());
        assertThrows(InsufficientFundsException.class, () -> a.debit(new BigDecimal("0.01")));
    }

    @Test
    @DisplayName("Savings account cannot go below zero")
    void savingsHasNoOverdraft() {
        Account a = account(AccountType.SAVINGS, "100");
        assertThrows(InsufficientFundsException.class, () -> a.debit(new BigDecimal("100.01")));
        a.debit(new BigDecimal("100"));
        assertEquals(Money.ZERO, a.getBalance());
    }

    @Test
    @DisplayName("Savings account allows only 4 outgoing operations per month")
    void savingsMonthlyLimit() {
        Account a = account(AccountType.SAVINGS, "1000");
        a.checkOutgoingAllowed(3);
        assertThrows(LimitExceededException.class, () -> a.checkOutgoingAllowed(4));
        account(AccountType.CURRENT, "0").checkOutgoingAllowed(100);
    }

    @Test
    @DisplayName("Held money is not available but still part of the balance")
    void holds() {
        Account a = account(AccountType.SAVINGS, "1000");
        a.placeHold(new BigDecimal("600"));
        assertEquals(Money.of("1000"), a.getBalance());
        assertEquals(Money.of("400"), a.getAvailableBalance());
        assertThrows(InsufficientFundsException.class, () -> a.placeHold(new BigDecimal("401")));
        a.releaseHold(new BigDecimal("600"));
        assertEquals(Money.of("1000"), a.getAvailableBalance());
    }

    @Test
    @DisplayName("Frozen accounts reject operations; negative amounts are invalid")
    void frozenAndInvalid() {
        Account a = account(AccountType.CURRENT, "1000");
        a.setStatus(AccountStatus.FROZEN);
        assertThrows(AccountFrozenException.class, a::ensureActive);
        assertThrows(InvalidAmountException.class, () -> a.credit(new BigDecimal("-1")));
    }
}

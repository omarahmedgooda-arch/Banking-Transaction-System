package com.ershak.model;

import com.ershak.util.Money;

import java.math.BigDecimal;

/**
 * A current (checking) account for everyday spending.
 * Allows an overdraft, has no monthly limit.
 */
public class CurrentAccount extends Account {

    private final BigDecimal overdraftLimit;

    public CurrentAccount(BigDecimal overdraftLimit) {
        this.overdraftLimit = Money.of(overdraftLimit);
    }

    @Override
    public AccountType getType() {
        return AccountType.CURRENT;
    }

    @Override
    public BigDecimal getOverdraftLimit() {
        return overdraftLimit;
    }

    @Override
    public void checkOutgoingAllowed(int outgoingThisMonth) {
        // No monthly limit on current accounts.
    }

}

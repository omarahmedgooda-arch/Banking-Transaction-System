package com.ershak.model;

import com.ershak.exception.LimitExceededException;
import com.ershak.util.Money;

import java.math.BigDecimal;

/**
 * "El Ersh El Abyad": a savings account.
 * No overdraft and a limited number of outgoing operations per month.
 * It pays no interest (no riba): it is a place to put money aside for goals.
 */
public class SavingsAccount extends Account {

    private final int monthlyOutgoingLimit;

    public SavingsAccount(int monthlyOutgoingLimit) {
        this.monthlyOutgoingLimit = monthlyOutgoingLimit;
    }

    @Override
    public AccountType getType() {
        return AccountType.SAVINGS;
    }

    @Override
    public BigDecimal getOverdraftLimit() {
        return Money.ZERO;
    }

    @Override
    public void checkOutgoingAllowed(int outgoingThisMonth) {
        if (outgoingThisMonth >= monthlyOutgoingLimit) {
            throw new LimitExceededException("Savings accounts allow " + monthlyOutgoingLimit
                    + " withdrawals or transfers per month. Use a current account for daily spending.");
        }
    }


    public int getMonthlyOutgoingLimit() {
        return monthlyOutgoingLimit;
    }

}

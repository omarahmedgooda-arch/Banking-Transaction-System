package com.ershak.model;

import com.ershak.service.BankSettings;

/**
 * Factory pattern: creates the right {@link Account} subclass for a type,
 * configured from the bank's current settings.
 */
public final class AccountFactory {

    private AccountFactory() {
    }

    public static Account create(AccountType type, BankSettings settings) {
        return switch (type) {
            case SAVINGS -> new SavingsAccount(settings.savingsMonthlyOutgoing());
            case CURRENT -> new CurrentAccount(settings.overdraftLimit());
        };
    }
}

package com.ershak.model;

import com.ershak.exception.AccountFrozenException;
import com.ershak.exception.InsufficientFundsException;
import com.ershak.exception.InvalidAmountException;
import com.ershak.util.Money;

import java.math.BigDecimal;

/**
 * Base class for every bank account.
 * <p>
 * Subclasses decide the rules that differ between account types
 * (overdraft, monthly outgoing limit) by overriding the abstract methods.
 * This is where inheritance and polymorphism live in the project.
 */
public abstract class Account {

    private long id;
    private long userId;
    private String accountNumber;
    private BigDecimal balance = Money.ZERO;
    private BigDecimal holdAmount = Money.ZERO;
    private AccountStatus status = AccountStatus.ACTIVE;
    private long openedAt;

    protected Account() {
    }

    protected Account(long userId, String accountNumber, BigDecimal balance) {
        this.userId = userId;
        this.accountNumber = accountNumber;
        this.balance = Money.of(balance);
    }

    /** SAVINGS or CURRENT. */
    public abstract AccountType getType();

    /** How far below zero this account may go. */
    public abstract BigDecimal getOverdraftLimit();

    /**
     * Throws if this account may not send money out again this month.
     *
     * @param outgoingThisMonth outgoing operations already made this calendar month
     */
    public abstract void checkOutgoingAllowed(int outgoingThisMonth);


    /** Money the customer can use right now: balance minus held funds plus any overdraft. */
    public BigDecimal getAvailableBalance() {
        return Money.of(balance.subtract(holdAmount).add(getOverdraftLimit()));
    }

    public void ensureActive() {
        if (status != AccountStatus.ACTIVE) {
            throw new AccountFrozenException(accountNumber, status.name());
        }
    }

    public void ensureCanCover(BigDecimal amount) {
        if (amount.compareTo(getAvailableBalance()) > 0) {
            throw new InsufficientFundsException(getAvailableBalance());
        }
    }

    public void credit(BigDecimal amount) {
        requirePositive(amount);
        balance = Money.of(balance.add(amount));
    }

    public void debit(BigDecimal amount) {
        requirePositive(amount);
        ensureCanCover(amount);
        balance = Money.of(balance.subtract(amount));
    }

    /** Reserves money for a transaction that waits for an OTP or an admin review. */
    public void placeHold(BigDecimal amount) {
        requirePositive(amount);
        ensureCanCover(amount);
        holdAmount = Money.of(holdAmount.add(amount));
    }

    public void releaseHold(BigDecimal amount) {
        BigDecimal next = holdAmount.subtract(amount);
        holdAmount = next.signum() < 0 ? Money.ZERO : Money.of(next);
    }

    private static void requirePositive(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            throw new InvalidAmountException("Amount must be greater than zero.");
        }
    }

    public String getMaskedNumber() {
        return "•••• " + accountNumber.substring(accountNumber.length() - 4);
    }

    public long getId() { return id; }
    public void setId(long id) { this.id = id; }
    public long getUserId() { return userId; }
    public void setUserId(long userId) { this.userId = userId; }
    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }
    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = Money.of(balance); }
    public BigDecimal getHoldAmount() { return holdAmount; }
    public void setHoldAmount(BigDecimal holdAmount) { this.holdAmount = Money.of(holdAmount); }
    public AccountStatus getStatus() { return status; }
    public void setStatus(AccountStatus status) { this.status = status; }
    public long getOpenedAt() { return openedAt; }
    public void setOpenedAt(long openedAt) { this.openedAt = openedAt; }
}

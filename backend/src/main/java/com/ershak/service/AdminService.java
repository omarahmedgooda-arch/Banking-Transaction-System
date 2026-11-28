package com.ershak.service;

import com.ershak.db.Database;
import com.ershak.exception.NotFoundException;
import com.ershak.exception.ValidationException;
import com.ershak.fraud.FraudEngine;
import com.ershak.fraud.RuleResult;
import com.ershak.model.Account;
import com.ershak.model.AccountStatus;
import com.ershak.model.AuditEntry;
import com.ershak.model.FraudEvent;
import com.ershak.model.Transaction;
import com.ershak.model.TransactionStatus;
import com.ershak.model.TransactionType;
import com.ershak.model.User;
import com.ershak.security.SessionManager;
import com.ershak.util.BankClock;
import com.ershak.util.Money;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** "El Me3alem": everything a bank officer can do. */
public class AdminService {

    public record Overview(int customers, int accounts, BigDecimal totalDeposits, int transactionsToday,
                           int pendingReviews, int flaggedToday, AuditService.VerifyResult audit,
                           List<AuditEntry> recentAudit, List<ReviewItem> reviews) {
    }

    public record ReviewItem(long transactionId, String reference, String type, String customerName,
                             String username, BigDecimal amount, BigDecimal fee, String fromAccount,
                             String toAccount, int score, List<RuleResult> reasons, long createdAt) {
    }

    public record AccountSummary(long id, String accountNumber, String type, BigDecimal balance,
                                 BigDecimal holdAmount, String status) {
    }

    public record CustomerView(long id, String fullName, String username, String email, String phone,
                               boolean locked, long lockedUntil, long createdAt, List<AccountSummary> accounts) {
    }


    public record RuleInfo(String id, String description) {
    }

    private static final long PERMANENT_LOCK = 100L * 365 * 86_400_000L;

    private final Database db;
    private final Repositories repos;
    private final SettingsService settings;
    private final AuditService audit;
    private final NotificationService notifications;
    private final TransactionService transactions;
    private final SessionManager sessions;
    private final FraudEngine fraudEngine;

    public AdminService(Database db, Repositories repos, SettingsService settings, AuditService audit,
                        NotificationService notifications, TransactionService transactions,
                        SessionManager sessions, FraudEngine fraudEngine) {
        this.db = db;
        this.repos = repos;
        this.settings = settings;
        this.audit = audit;
        this.notifications = notifications;
        this.transactions = transactions;
        this.sessions = sessions;
        this.fraudEngine = fraudEngine;
    }

    public Overview overview() {
        BankSettings s = settings.current();
        AuditService.VerifyResult verify = audit.verify();
        return db.read(c -> {
            List<Account> open = repos.accounts().findAllOpen(c, s);
            BigDecimal deposits = open.stream().map(Account::getBalance).filter(b -> b.signum() > 0)
                    .reduce(Money.ZERO, BigDecimal::add);
            List<ReviewItem> reviews = reviewItems(c, s);
            return new Overview(repos.users().countCustomers(c), open.size(), deposits,
                    repos.transactions().countSince(c, BankClock.startOfToday()), reviews.size(),
                    repos.fraud().countSince(c, BankClock.startOfToday()), verify,
                    repos.audit().findRecent(c, 6), reviews);
        });
    }

    public List<ReviewItem> reviewQueue() {
        BankSettings s = settings.current();
        return db.read(c -> reviewItems(c, s));
    }

    public void approve(long adminId, String adminName, long transactionId) {
        db.inTransaction(c -> {
            Transaction t = pendingReview(c, transactionId);
            transactions.approveHeld(c, t);
            repos.fraud().markReviewed(c, t.getId(), "APPROVED", adminId, BankClock.nowMillis());
            boolean ok = t.getStatus() == TransactionStatus.COMPLETED;
            audit.append(c, adminName, "REVIEW_APPROVED", t.getReference() + (ok ? " sent" : " failed on execution"));
            notifications.notify(c, t.getInitiatedBy(), "REVIEW", ok ? "Transfer approved" : "Transfer failed",
                    ok ? "A bank officer approved " + t.getReference() + ". " + Money.format(t.getAmount()) + " was sent."
                       : t.getReference() + " couldn't be completed. The held money is back in your account.");
            return null;
        });
    }

    public void reject(long adminId, String adminName, long transactionId) {
        BankSettings s = settings.current();
        db.inTransaction(c -> {
            Transaction t = pendingReview(c, transactionId);
            transactions.reject(c, s, t, "Rejected by officer");
            repos.fraud().markReviewed(c, t.getId(), "REJECTED", adminId, BankClock.nowMillis());
            audit.append(c, adminName, "REVIEW_REJECTED", t.getReference());
            notifications.notify(c, t.getInitiatedBy(), "REVIEW", "Transfer stopped",
                    "A bank officer stopped " + t.getReference() + ". " + Money.format(t.getTotalDebit())
                            + " is free in your account again.");
            return null;
        });
    }

    public List<CustomerView> customers(String query) {
        BankSettings s = settings.current();
        String q = query == null ? "" : query.trim();
        return db.read(c -> {
            List<CustomerView> out = new ArrayList<>();
            long now = BankClock.nowMillis();
            for (User u : repos.users().searchCustomers(c, q, 100)) {
                List<AccountSummary> accounts = new ArrayList<>();
                for (Account a : repos.accounts().findByUser(c, u.getId(), s)) {
                    accounts.add(new AccountSummary(a.getId(), a.getAccountNumber(), a.getType().name(),
                            a.getBalance(), a.getHoldAmount(), a.getStatus().name()));
                }
                out.add(new CustomerView(u.getId(), u.getFullName(), u.getUsername(), u.getEmail(), u.getPhone(),
                        u.isLocked(now), u.getLockedUntil(), u.getCreatedAt(), accounts));
            }
            return out;
        });
    }

    public void setUserLocked(String adminName, long userId, boolean locked) {
        db.inTransaction(c -> {
            User u = repos.users().findById(c, userId).filter(x -> !x.isAdmin())
                    .orElseThrow(() -> new NotFoundException("Customer"));
            u.setFailedAttempts(0);
            u.setLockedUntil(locked ? BankClock.nowMillis() + PERMANENT_LOCK : 0);
            repos.users().updateLoginState(c, u);
            audit.append(c, adminName, locked ? "USER_LOCKED" : "USER_UNLOCKED", u.getUsername() + " by officer");
            if (!locked) {
                notifications.notify(c, userId, "INFO", "Login unlocked", "A bank officer unlocked your login.");
            }
            return null;
        });
        if (locked) {
            sessions.invalidateUser(userId);
        }
    }

    public void setAccountFrozen(String adminName, long accountId, boolean frozen) {
        BankSettings s = settings.current();
        db.inTransaction(c -> {
            Account a = repos.accounts().findById(c, accountId, s).orElseThrow(() -> new NotFoundException("Account"));
            if (a.getStatus() == AccountStatus.CLOSED) {
                throw new ValidationException("This account is closed.");
            }
            a.setStatus(frozen ? AccountStatus.FROZEN : AccountStatus.ACTIVE);
            repos.accounts().update(c, a);
            audit.append(c, adminName, frozen ? "ACCOUNT_FROZEN" : "ACCOUNT_UNFROZEN", a.getMaskedNumber());
            notifications.notify(c, a.getUserId(), "INFO", frozen ? "Account frozen" : "Account active again",
                    frozen ? a.getMaskedNumber() + " is frozen. Contact the bank for help."
                           : a.getMaskedNumber() + " can be used again.");
            return null;
        });
    }


    public List<AuditEntry> auditLog(int limit) {
        return audit.recent(limit);
    }

    public AuditService.VerifyResult verifyAudit(String adminName) {
        AuditService.VerifyResult result = audit.verify();
        if (result.intact()) {
            db.inTransaction(c -> {
                audit.append(c, adminName, "AUDIT_VERIFIED", result.totalEntries() + " entries intact");
                return null;
            });
        }
        return result;
    }

    public List<RuleInfo> rules() {
        return fraudEngine.getRules().stream().map(r -> new RuleInfo(r.id(), r.description())).toList();
    }

    public Map<String, String> settingsMap() {
        return settings.current().asMap();
    }

    public Map<String, String> updateSettings(String adminName, Map<String, String> changes) {
        return settings.update(adminName, changes).asMap();
    }

    private Transaction pendingReview(Connection c, long transactionId) throws SQLException {
        Transaction t = repos.transactions().findById(c, transactionId)
                .orElseThrow(() -> new NotFoundException("Transaction"));
        if (t.getStatus() != TransactionStatus.PENDING_REVIEW) {
            throw new ValidationException("ALREADY_REVIEWED", "This transaction was already handled.");
        }
        return t;
    }

    private List<ReviewItem> reviewItems(Connection c, BankSettings s) throws SQLException {
        List<ReviewItem> out = new ArrayList<>();
        for (Transaction t : repos.transactions().findByStatus(c, TransactionStatus.PENDING_REVIEW)) {
            User u = repos.users().findById(c, t.getInitiatedBy()).orElse(null);
            FraudEvent f = repos.fraud().findByTransaction(c, t.getId()).orElse(null);
            String from = t.getFromAccountId() == null ? null
                    : repos.accounts().findById(c, t.getFromAccountId(), s).map(Account::getMaskedNumber).orElse(null);
            String to = t.getToAccountId() == null ? null
                    : repos.accounts().findById(c, t.getToAccountId(), s).map(Account::getMaskedNumber).orElse(null);
            out.add(new ReviewItem(t.getId(), t.getReference(), t.getType().name(),
                    u == null ? "?" : u.getFullName(), u == null ? "?" : u.getUsername(), t.getAmount(), t.getFee(),
                    from, to, f == null ? 0 : f.score(), f == null ? List.of() : f.triggeredRules(), t.getCreatedAt()));
        }
        return out;
    }
}

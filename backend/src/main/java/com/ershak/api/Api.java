package com.ershak.api;

import com.ershak.api.Dto.AccountDto;
import com.ershak.api.Dto.GoalDto;
import com.ershak.api.Dto.RiskDto;
import com.ershak.api.Dto.TransactionDto;
import com.ershak.api.Dto.TransactionResultDto;
import com.ershak.api.Dto.UserDto;
import com.ershak.exception.AccountLockedException;
import com.ershak.exception.ForbiddenException;
import com.ershak.exception.ValidationException;
import com.ershak.model.AccountType;
import com.ershak.security.RateLimiter;
import com.ershak.security.Session;
import com.ershak.service.AuthService;
import com.ershak.service.Bank;
import com.ershak.service.TransactionService;
import com.ershak.util.BankClock;
import com.ershak.web.Ctx;
import com.ershak.web.WebServer;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The REST API. Every route reads the request, calls one method of the pure Java core,
 * and turns the result into JSON. No business rules live here.
 */
public final class Api {

    private static final String SESSION = "session";
    private static final Set<String> PUBLIC = Set.of("/api/health", "/api/auth/login", "/api/auth/register");

    private final Bank bank;
    private final RateLimiter loginLimiter = new RateLimiter(10, 60_000);
    private final RateLimiter registerLimiter = new RateLimiter(5, 60_000);

    public Api(Bank bank) {
        this.bank = bank;
    }

    public void register(WebServer app) {
        app.errorExtras((e, body) -> {
            if (e instanceof AccountLockedException locked) {
                body.put("lockedUntil", locked.getLockedUntil());
            }
        });
        app.before("/api/", this::authenticate);

        app.get("/api/health", ctx -> ctx.json(Map.of("status", "ok")));

        // ----- auth
        app.post("/api/auth/register", ctx -> {
            registerLimiter.check(ctx.ip(), BankClock.nowMillis());
            var user = bank.auth.register(ctx.str("fullName"), ctx.str("email"), ctx.str("phone"),
                    ctx.str("username"), ctx.str("password"));
            ctx.status(201).json(UserDto.of(user));
        });
        app.post("/api/auth/login", ctx -> {
            loginLimiter.check(ctx.ip(), BankClock.nowMillis());
            AuthService.LoginResult r = bank.auth.login(ctx.str("username"), ctx.str("password"));
            ctx.json(Map.of("token", r.session().token(), "user", UserDto.of(r.user())));
        });
        app.post("/api/auth/logout", ctx -> {
            bank.auth.logout(bearer(ctx));
            ctx.status(204);
        });
        app.get("/api/me", ctx -> {
            Session s = session(ctx);
            ctx.json(Map.of("user", UserDto.of(bank.auth.me(s.userId())),
                    "unreadNotifications", bank.notifications.unread(s.userId())));
        });
        app.post("/api/me/password", ctx -> {
            bank.auth.changePassword(session(ctx).userId(), ctx.str("currentPassword"), ctx.str("newPassword"));
            ctx.json(Map.of("message", "Password changed."));
        });

        // ----- accounts
        app.get("/api/accounts", ctx -> ctx.json(
                bank.accounts.listForUser(session(ctx).userId()).stream().map(AccountDto::of).toList()));
        app.post("/api/accounts", ctx -> {
            AccountType type = parseType(ctx.str("type"));
            ctx.status(201).json(AccountDto.of(
                    bank.accounts.open(session(ctx).userId(), type, ctx.decimal("initialDeposit"))));
        });
        app.post("/api/accounts/{id}/close", ctx -> {
            bank.accounts.close(session(ctx).userId(), ctx.pathId());
            ctx.json(Map.of("message", "Account closed."));
        });
        app.get("/api/accounts/{id}/transactions", ctx -> {
            var filter = new TransactionService.HistoryFilter(ctx.queryParam("type"), ctx.queryParam("status"),
                    ctx.queryParam("from"), ctx.queryParam("to"), ctx.queryDecimal("min"), ctx.queryDecimal("max"),
                    ctx.queryInt("page", 1), Math.min(ctx.queryInt("size", 20), 100));
            ctx.json(bank.transactions.history(session(ctx).userId(), ctx.pathId(), filter));
        });
        app.get("/api/accounts/{id}/statement.csv", ctx -> {
            String csv = bank.transactions.statementCsv(session(ctx).userId(), ctx.pathId(),
                    ctx.queryParam("from"), ctx.queryParam("to"));
            ctx.contentType("text/csv; charset=utf-8");
            ctx.header("Content-Disposition", "attachment; filename=\"ershak-statement.csv\"");
            ctx.result("﻿" + csv);
        });

        app.get("/api/accounts/{id}/statement.pdf", ctx -> {
            byte[] pdf = bank.transactions.statementPdf(session(ctx).userId(), ctx.pathId(),
                    ctx.queryParam("from"), ctx.queryParam("to"));
            ctx.contentType("application/pdf");
            ctx.header("Content-Disposition", "attachment; filename=\"ershak-statement.pdf\"");
            ctx.resultBytes(pdf);
        });

        // ----- money
        app.post("/api/transactions/deposit", ctx -> ctx.json(result(
                bank.transactions.deposit(session(ctx).userId(), ctx.lng("accountId"), ctx.decimal("amount")))));
        app.post("/api/transactions/withdraw", ctx -> ctx.json(result(
                bank.transactions.withdraw(session(ctx).userId(), ctx.lng("accountId"), ctx.decimal("amount")))));
        app.post("/api/transactions/transfer", ctx -> ctx.json(result(
                bank.transactions.transfer(session(ctx).userId(), ctx.lng("fromAccountId"),
                        ctx.str("toAccountNumber"), ctx.decimal("amount"), ctx.str("note")))));
        app.post("/api/transactions/{id}/otp", ctx -> {
            var r = bank.transactions.confirmOtp(session(ctx).userId(), ctx.pathId(), ctx.str("code"));
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("success", r.success());
            body.put("transaction", TransactionDto.of(r.transaction()));
            body.put("attemptsLeft", r.attemptsLeft());
            body.put("message", r.message());
            ctx.json(body);
        });
        app.post("/api/transactions/{id}/cancel", ctx -> ctx.json(TransactionDto.of(
                bank.transactions.cancelPending(session(ctx).userId(), ctx.pathId(), ctx.bool("freezeAccount")))));
        app.get("/api/transactions/recent", ctx -> ctx.json(
                bank.transactions.recentForUser(session(ctx).userId(), Math.min(ctx.queryInt("limit", 8), 50))));
        app.get("/api/transactions/{id}", ctx -> {
            var d = bank.transactions.detail(session(ctx).userId(), ctx.pathId());
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("transaction", d.view());
            body.put("fromAccount", d.fromAccount());
            body.put("toAccount", d.toAccount());
            body.put("risk", d.fraud().map(f -> Map.of("score", f.score(), "decision", f.decision(),
                    "reasons", f.triggeredRules())).orElse(null));
            ctx.json(body);
        });

        // ----- coach: categories, expenses, budget, insights
        app.get("/api/coach/categories", ctx -> ctx.json(bank.coach.categories(session(ctx).userId())));
        app.post("/api/coach/categories", ctx -> ctx.status(201).json(bank.coach.addCategory(session(ctx).userId(),
                ctx.str("name"), ctx.str("icon"), ctx.str("color"), ctx.bool("essential"))));
        app.delete("/api/coach/categories/{id}", ctx -> {
            bank.coach.deleteCategory(session(ctx).userId(), ctx.pathId());
            ctx.status(204);
        });
        app.get("/api/coach/expenses", ctx -> ctx.json(bank.coach.expenses(session(ctx).userId(),
                ctx.queryParam("month"))));
        app.post("/api/coach/expenses", ctx -> ctx.status(201).json(bank.coach.addExpense(session(ctx).userId(),
                ctx.lng("categoryId"), ctx.decimal("amount"), ctx.str("note"), ctx.str("merchant"),
                expenseSource(ctx.str("source")), ctx.str("date"))));
        app.put("/api/coach/expenses/{id}", ctx -> ctx.json(bank.coach.updateExpense(session(ctx).userId(),
                ctx.pathId(), ctx.lng("categoryId"), ctx.decimal("amount"), ctx.str("note"), ctx.str("merchant"),
                ctx.str("date"))));
        app.delete("/api/coach/expenses/{id}", ctx -> {
            bank.coach.deleteExpense(session(ctx).userId(), ctx.pathId());
            ctx.status(204);
        });
        app.put("/api/coach/budget", ctx -> ctx.json(Map.of("month", String.valueOf(ctx.str("month")),
                "amount", bank.coach.setBudget(session(ctx).userId(), ctx.str("month"), ctx.decimal("amount")))));
        app.get("/api/coach/overview", ctx -> ctx.json(bank.coach.overview(session(ctx).userId(),
                ctx.queryParam("month"))));
        app.get("/api/coach/insights", ctx -> ctx.json(bank.coach.insights(session(ctx).userId(),
                ctx.queryParam("month"))));
        app.get("/api/coach/goals/{id}/plan", ctx -> ctx.json(bank.coach.goalPlan(session(ctx).userId(),
                ctx.pathId())));
        app.post("/api/coach/sms", ctx -> ctx.json(bank.coach.fromSms(session(ctx).userId(), ctx.str("text"))));
        // ----- push notifications
        app.get("/api/push/key", ctx -> ctx.json(Map.of("publicKey", bank.push.publicKey())));
        app.post("/api/push/subscribe", ctx -> {
            long uid = session(ctx).userId();
            bank.push.subscribe(uid, ctx.str("endpoint"), ctx.str("p256dh"), ctx.str("auth"));
            ctx.json(Map.of("devices", bank.push.deviceCount(uid)));
        });
        app.post("/api/push/unsubscribe", ctx -> {
            bank.push.unsubscribe(session(ctx).userId(), ctx.str("endpoint"));
            ctx.status(204);
        });
        app.get("/api/push/prefs", ctx -> {
            long uid = session(ctx).userId();
            ctx.json(Map.of("prefs", bank.push.prefs(uid), "devices", bank.push.deviceCount(uid)));
        });
        app.put("/api/push/prefs", ctx -> ctx.json(bank.push.savePrefs(session(ctx).userId(),
                new com.ershak.service.PushService.Prefs(ctx.bool("daily"), ctx.str("time"), ctx.bool("weekly"),
                        ctx.str("weeklyDay"), ctx.bool("budget"), ctx.bool("goals"), ctx.str("quietFrom"),
                        ctx.str("quietTo")))));
        app.post("/api/push/test", ctx -> ctx.json(Map.of("sent", bank.push.sendTest(session(ctx).userId()))));
        app.get("/api/coach/ai", ctx -> ctx.json(Map.of("enabled", bank.ai.enabled())));
        app.post("/api/coach/chat", ctx -> {
            Object messages = ctx.json().get("messages");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> list = messages instanceof List<?> l
                    ? l.stream().filter(Map.class::isInstance).map(m -> (Map<String, Object>) m).toList() : List.of();
            ctx.json(bank.ai.chat(session(ctx).userId(), list));
        });
        app.post("/api/coach/receipt", ctx -> ctx.json(bank.ai.readReceipt(session(ctx).userId(),
                ctx.str("image"), ctx.str("mimeType"))));

        // ----- savings goals
        app.get("/api/goals", ctx -> ctx.json(
                bank.goals.list(session(ctx).userId()).stream().map(GoalDto::of).toList()));
        app.post("/api/goals", ctx -> ctx.status(201).json(GoalDto.of(bank.goals.create(session(ctx).userId(),
                ctx.lng("accountId"), ctx.str("name"), ctx.decimal("targetAmount"), ctx.str("targetDate")))));
        app.post("/api/goals/{id}/contribute", ctx -> ctx.json(GoalDto.of(
                bank.goals.contribute(session(ctx).userId(), ctx.pathId(), ctx.decimal("amount")))));
        app.post("/api/goals/{id}/withdraw", ctx -> ctx.json(GoalDto.of(
                bank.goals.withdraw(session(ctx).userId(), ctx.pathId(), ctx.decimal("amount")))));
        app.delete("/api/goals/{id}", ctx -> {
            bank.goals.delete(session(ctx).userId(), ctx.pathId());
            ctx.status(204);
        });

        // ----- notifications and the simulated SMS inbox
        app.get("/api/notifications", ctx -> ctx.json(bank.notifications.list(session(ctx).userId())));
        app.post("/api/notifications/read-all", ctx -> {
            bank.notifications.markAllRead(session(ctx).userId());
            ctx.status(204);
        });
        app.get("/api/sms", ctx -> ctx.json(bank.notifications.smsInbox(session(ctx).userId())));

        // ----- admin console
        app.get("/api/admin/overview", ctx -> ctx.json(bank.admin.overview()));
        app.get("/api/admin/reviews", ctx -> ctx.json(bank.admin.reviewQueue()));
        app.post("/api/admin/reviews/{id}/approve", ctx -> {
            Session s = session(ctx);
            bank.admin.approve(s.userId(), s.username(), ctx.pathId());
            ctx.json(Map.of("message", "Approved. The money was sent."));
        });
        app.post("/api/admin/reviews/{id}/reject", ctx -> {
            Session s = session(ctx);
            bank.admin.reject(s.userId(), s.username(), ctx.pathId());
            ctx.json(Map.of("message", "Rejected. The money is back with the customer."));
        });
        app.get("/api/admin/customers", ctx -> ctx.json(bank.admin.customers(ctx.queryParam("q"))));
        app.post("/api/admin/users/{id}/lock", ctx -> {
            bank.admin.setUserLocked(session(ctx).username(), ctx.pathId(), true);
            ctx.json(Map.of("message", "Login locked."));
        });
        app.post("/api/admin/users/{id}/unlock", ctx -> {
            bank.admin.setUserLocked(session(ctx).username(), ctx.pathId(), false);
            ctx.json(Map.of("message", "Login unlocked."));
        });
        app.post("/api/admin/accounts/{id}/freeze", ctx -> {
            bank.admin.setAccountFrozen(session(ctx).username(), ctx.pathId(), true);
            ctx.json(Map.of("message", "Account frozen."));
        });
        app.post("/api/admin/accounts/{id}/unfreeze", ctx -> {
            bank.admin.setAccountFrozen(session(ctx).username(), ctx.pathId(), false);
            ctx.json(Map.of("message", "Account active again."));
        });
        app.get("/api/admin/audit", ctx -> ctx.json(bank.admin.auditLog(Math.min(ctx.queryInt("limit", 100), 500))));
        app.post("/api/admin/audit/verify", ctx -> ctx.json(bank.admin.verifyAudit(session(ctx).username())));
        app.get("/api/admin/rules", ctx -> ctx.json(Map.of("rules", bank.admin.rules(),
                "settings", bank.admin.settingsMap())));
        app.put("/api/admin/settings", ctx -> {
            Map<String, String> changes = new LinkedHashMap<>();
            ctx.json().forEach((k, v) -> changes.put(k, String.valueOf(v)));
            ctx.json(bank.admin.updateSettings(session(ctx).username(), changes));
        });
    }

    /** Every /api/ call except login, register and health needs a valid session; /api/admin/ needs an officer. */
    private void authenticate(Ctx ctx) {
        if (PUBLIC.contains(ctx.path())) {
            return;
        }
        Session s = bank.sessions.validate(bearer(ctx), !"1".equals(ctx.header("X-Passive")));
        ctx.attribute(SESSION, s);
        if (ctx.path().startsWith("/api/admin/") && !s.isAdmin()) {
            throw new ForbiddenException();
        }
    }

    private static Session session(Ctx ctx) {
        return ctx.attribute(SESSION);
    }

    private static String bearer(Ctx ctx) {
        String h = ctx.header("Authorization");
        return h != null && h.startsWith("Bearer ") ? h.substring(7).trim() : null;
    }

    private static TransactionResultDto result(TransactionService.TransactionResult r) {
        return new TransactionResultDto(TransactionDto.of(r.transaction()), RiskDto.of(r.risk()), r.message());
    }

    private static AccountType parseType(String type) {
        try {
            return AccountType.valueOf(type == null ? "" : type.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ValidationException("Choose SAVINGS or CURRENT.");
        }
    }

    private static com.ershak.coach.ExpenseSource expenseSource(String s) {
        if (s == null || s.isBlank()) {
            return com.ershak.coach.ExpenseSource.MANUAL;
        }
        try {
            return com.ershak.coach.ExpenseSource.valueOf(s.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ValidationException("source must be MANUAL, RECEIPT, SMS or BANK.");
        }
    }
}

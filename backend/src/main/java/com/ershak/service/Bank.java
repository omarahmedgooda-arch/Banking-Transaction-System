package com.ershak.service;

import com.ershak.coach.AiService;
import com.ershak.coach.CoachService;
import com.ershak.db.Database;
import com.ershak.fraud.FraudEngine;
import com.ershak.security.SessionManager;

/** Wires every service together once. The API layer and the tests both start from here. */
public final class Bank {

    public final Database db;
    public final Repositories repos;
    public final AuditService audit;
    public final SettingsService settings;
    public final NotificationService notifications;
    public final SessionManager sessions;
    public final FraudEngine fraudEngine;
    public final AuthService auth;
    public final AccountService accounts;
    public final TransactionService transactions;
    public final GoalService goals;
    public final AdminService admin;
    public final CoachService coach;
    public final AiService ai;

    public Bank(Database db) {
        this.db = db;
        this.repos = Repositories.create();
        this.audit = new AuditService(db, repos);
        this.settings = new SettingsService(db, repos, audit);
        this.notifications = new NotificationService(db, repos);
        this.sessions = new SessionManager(() -> settings.current().sessionTimeoutMinutes());
        this.fraudEngine = new FraudEngine();
        this.auth = new AuthService(db, repos, settings, audit, notifications, sessions);
        this.accounts = new AccountService(db, repos, settings, audit, notifications);
        this.transactions = new TransactionService(db, repos, settings, audit, notifications, fraudEngine);
        this.goals = new GoalService(db, repos, settings, audit, notifications);
        this.coach = new CoachService(db, repos, notifications);
        this.ai = new AiService(coach, goals::list, java.time.Clock.system(java.time.ZoneId.of("Africa/Cairo")));
        this.admin = new AdminService(db, repos, settings, audit, notifications, transactions, sessions, fraudEngine);
    }
}

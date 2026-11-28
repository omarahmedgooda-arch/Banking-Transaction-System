package com.ershak.service;

import com.ershak.dao.NotificationDao;
import com.ershak.db.Database;
import com.ershak.model.Notification;
import com.ershak.model.Role;
import com.ershak.model.User;
import com.ershak.util.BankClock;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

/**
 * "5od balak": in-app notifications, plus a simulated SMS inbox used to deliver OTP codes
 * (the project doesn't send real text messages).
 */
public class NotificationService {

    /** Receives every new notification, e.g. to send it to the customer's phone as a push. */
    public interface Listener {
        void onNotification(long userId, String kind, String title, String message);
    }

    private final Database db;
    private final Repositories repos;
    private volatile Listener listener = (u, k, t, m) -> { };

    public void listen(Listener l) {
        this.listener = l;
    }

    public NotificationService(Database db, Repositories repos) {
        this.db = db;
        this.repos = repos;
    }

    public void notify(Connection c, long userId, String kind, String title, String message) throws SQLException {
        repos.notifications().insert(c, userId, kind, title, message, BankClock.nowMillis());
        listener.onNotification(userId, kind, title, message);
    }

    public void notifyAdmins(Connection c, String kind, String title, String message) throws SQLException {
        for (User admin : repos.users().findByRole(c, Role.ADMIN)) {
            notify(c, admin.getId(), kind, title, message);
        }
    }

    public void sms(Connection c, long userId, String message) throws SQLException {
        repos.notifications().insertSms(c, userId, message, BankClock.nowMillis());
    }

    public List<Notification> list(long userId) {
        return db.read(c -> repos.notifications().findByUser(c, userId, 50));
    }

    public int unread(long userId) {
        return db.read(c -> repos.notifications().countUnread(c, userId));
    }

    public void markAllRead(long userId) {
        db.inTransaction(c -> {
            repos.notifications().markAllRead(c, userId);
            return null;
        });
    }

    public List<NotificationDao.Sms> smsInbox(long userId) {
        return db.read(c -> repos.notifications().findSms(c, userId, 10));
    }
}

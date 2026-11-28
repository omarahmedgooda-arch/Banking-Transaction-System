package com.ershak.service;

import com.ershak.db.Database;

import java.util.LinkedHashMap;
import java.util.Map;

/** Loads and updates the bank settings. Keeps a cached copy that is refreshed after every change. */
public class SettingsService {

    private final Database db;
    private final Repositories repos;
    private final AuditService audit;
    private volatile BankSettings cached;

    public SettingsService(Database db, Repositories repos, AuditService audit) {
        this.db = db;
        this.repos = repos;
        this.audit = audit;
    }

    public BankSettings current() {
        BankSettings s = cached;
        if (s == null) {
            s = db.read(c -> new BankSettings(repos.settings().findAll(c)));
            cached = s;
        }
        return s;
    }

    /** Admin edit. Every value is validated and every change is written to the audit log. */
    public BankSettings update(String actor, Map<String, String> changes) {
        Map<String, String> clean = new LinkedHashMap<>();
        changes.forEach((k, v) -> clean.put(k, BankSettings.validate(k, String.valueOf(v))));
        db.inTransaction(c -> {
            BankSettings before = new BankSettings(repos.settings().findAll(c));
            for (Map.Entry<String, String> e : clean.entrySet()) {
                String old = before.asMap().get(e.getKey());
                if (!e.getValue().equals(old)) {
                    repos.settings().put(c, e.getKey(), e.getValue());
                    audit.append(c, actor, "SETTINGS_CHANGED", e.getKey() + ": " + old + " → " + e.getValue());
                }
            }
            return null;
        });
        cached = null;
        return current();
    }

    /** For system state that is not an admin-editable number. */
    public String getState(String key) {
        return db.read(c -> repos.settings().find(c, "state." + key).orElse(""));
    }
}

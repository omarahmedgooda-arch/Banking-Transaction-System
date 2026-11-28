package com.ershak.service;

import com.ershak.exception.ValidationException;
import com.ershak.util.Money;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Every limit, fee and fraud threshold in one place.
 * Defaults live here; admins can override them and the overrides are stored in the settings table.
 */
public final class BankSettings {

    /** Default values (key → value). Order is kept for the admin screen. */
    public static final Map<String, String> DEFAULTS;

    static {
        Map<String, String> d = new LinkedHashMap<>();
        d.put("min_opening_deposit", "100");
        d.put("max_deposit", "50000");
        d.put("daily_withdraw_limit", "10000");
        d.put("daily_transfer_limit", "20000");
        d.put("transfer_fee", "2");
        d.put("overdraft_limit", "2000");
        d.put("savings_monthly_outgoing", "4");
        d.put("max_failed_logins", "3");
        d.put("lock_minutes", "15");
        d.put("session_timeout_minutes", "5");
        d.put("otp_threshold", "30");
        d.put("hold_threshold", "60");
        d.put("r1_multiplier", "5");
        d.put("r1_min_history", "3");
        d.put("r1_points", "30");
        d.put("r2_count", "3");
        d.put("r2_window_minutes", "2");
        d.put("r2_points", "30");
        d.put("r3_amount", "5000");
        d.put("r3_points", "30");
        d.put("r4_start_hour", "0");
        d.put("r4_end_hour", "5");
        d.put("r4_amount", "2000");
        d.put("r4_points", "20");
        d.put("r5_ratio", "0.9");
        d.put("r5_points", "20");
        d.put("r6_ratio", "0.8");
        d.put("r6_points", "10");
        DEFAULTS = Collections.unmodifiableMap(d);
    }

    private final Map<String, String> values;

    public BankSettings(Map<String, String> overrides) {
        Map<String, String> merged = new LinkedHashMap<>(DEFAULTS);
        overrides.forEach((k, v) -> {
            if (DEFAULTS.containsKey(k)) {
                merged.put(k, v);
            }
        });
        this.values = Collections.unmodifiableMap(merged);
    }

    public static BankSettings defaults() {
        return new BankSettings(Map.of());
    }

    /** Checks an admin edit before it is saved: known key and a non-negative number. */
    public static String validate(String key, String value) {
        if (!DEFAULTS.containsKey(key)) {
            throw new ValidationException("Unknown setting: " + key);
        }
        try {
            BigDecimal v = new BigDecimal(value.trim());
            if (v.signum() < 0) {
                throw new ValidationException(key + " can't be negative.");
            }
            return v.stripTrailingZeros().toPlainString();
        } catch (NumberFormatException e) {
            throw new ValidationException(key + " must be a number.");
        }
    }

    public Map<String, String> asMap() {
        return values;
    }

    private BigDecimal dec(String key) {
        return new BigDecimal(values.get(key));
    }

    private int integer(String key) {
        return dec(key).intValue();
    }

    public BigDecimal minOpeningDeposit() { return Money.of(dec("min_opening_deposit")); }
    public BigDecimal maxDeposit() { return Money.of(dec("max_deposit")); }
    public BigDecimal dailyWithdrawLimit() { return Money.of(dec("daily_withdraw_limit")); }
    public BigDecimal dailyTransferLimit() { return Money.of(dec("daily_transfer_limit")); }
    public BigDecimal transferFee() { return Money.of(dec("transfer_fee")); }
    public BigDecimal overdraftLimit() { return Money.of(dec("overdraft_limit")); }
    public int savingsMonthlyOutgoing() { return integer("savings_monthly_outgoing"); }
    public int maxFailedLogins() { return integer("max_failed_logins"); }
    public int lockMinutes() { return integer("lock_minutes"); }
    public int sessionTimeoutMinutes() { return integer("session_timeout_minutes"); }
    public int otpThreshold() { return integer("otp_threshold"); }
    public int holdThreshold() { return integer("hold_threshold"); }

    public BigDecimal r1Multiplier() { return dec("r1_multiplier"); }
    public int r1MinHistory() { return integer("r1_min_history"); }
    public int r1Points() { return integer("r1_points"); }
    public int r2Count() { return integer("r2_count"); }
    public int r2WindowMinutes() { return integer("r2_window_minutes"); }
    public int r2Points() { return integer("r2_points"); }
    public BigDecimal r3Amount() { return Money.of(dec("r3_amount")); }
    public int r3Points() { return integer("r3_points"); }
    public int r4StartHour() { return integer("r4_start_hour"); }
    public int r4EndHour() { return integer("r4_end_hour"); }
    public BigDecimal r4Amount() { return Money.of(dec("r4_amount")); }
    public int r4Points() { return integer("r4_points"); }
    public BigDecimal r5Ratio() { return dec("r5_ratio"); }
    public int r5Points() { return integer("r5_points"); }
    public BigDecimal r6Ratio() { return dec("r6_ratio"); }
    public int r6Points() { return integer("r6_points"); }
}

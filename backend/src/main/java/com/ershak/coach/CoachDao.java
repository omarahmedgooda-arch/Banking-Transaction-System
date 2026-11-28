package com.ershak.coach;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Data access for categories, expenses, budgets and sent alerts. Money is stored as TEXT. */
public class CoachDao {

    // ----- categories

    public int countBuiltIn(Connection c) throws SQLException {
        try (Statement s = c.createStatement(); ResultSet rs = s.executeQuery(
                "SELECT COUNT(*) FROM categories WHERE user_id IS NULL")) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    public long insertCategory(Connection c, Long userId, String code, String nameAr, String nameEn, String icon,
                               String color, boolean essential, int sortOrder, long now) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("INSERT INTO categories (user_id, code, name_ar, name_en, "
                + "icon, color, essential, sort_order, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            if (userId == null) {
                ps.setNull(1, Types.INTEGER);
            } else {
                ps.setLong(1, userId);
            }
            ps.setString(2, code);
            ps.setString(3, nameAr);
            ps.setString(4, nameEn);
            ps.setString(5, icon);
            ps.setString(6, color);
            ps.setInt(7, essential ? 1 : 0);
            ps.setInt(8, sortOrder);
            ps.setLong(9, now);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                return keys.next() ? keys.getLong(1) : 0;
            }
        }
    }

    /** Built-in categories plus the user's own, in display order. */
    public List<Category> categoriesFor(Connection c, long userId) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT * FROM categories WHERE user_id IS NULL OR user_id = ? "
                + "ORDER BY sort_order, id")) {
            ps.setLong(1, userId);
            List<Category> out = new ArrayList<>();
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(category(rs));
                }
            }
            return out;
        }
    }

    public Optional<Category> findCategory(Connection c, long id) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT * FROM categories WHERE id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(category(rs)) : Optional.empty();
            }
        }
    }

    public Optional<Category> findBuiltInByCode(Connection c, String code) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT * FROM categories WHERE user_id IS NULL AND code = ?")) {
            ps.setString(1, code);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(category(rs)) : Optional.empty();
            }
        }
    }

    public void deleteCategory(Connection c, long id) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("DELETE FROM categories WHERE id = ?")) {
            ps.setLong(1, id);
            ps.executeUpdate();
        }
    }

    public int countExpensesInCategory(Connection c, long categoryId) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM expenses WHERE category_id = ?")) {
            ps.setLong(1, categoryId);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        }
    }

    private Category category(ResultSet rs) throws SQLException {
        long owner = rs.getLong("user_id");
        Long userId = rs.wasNull() ? null : owner;
        return new Category(rs.getLong("id"), userId, rs.getString("code"), rs.getString("name_ar"),
                rs.getString("name_en"), rs.getString("icon"), rs.getString("color"),
                rs.getInt("essential") == 1, rs.getInt("sort_order"));
    }

    // ----- expenses

    public long insertExpense(Connection c, Expense e) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("INSERT INTO expenses (user_id, category_id, amount, note, "
                + "merchant, source, spent_at, created_at) VALUES (?,?,?,?,?,?,?,?)", Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, e.userId());
            ps.setLong(2, e.categoryId());
            ps.setString(3, e.amount().toPlainString());
            ps.setString(4, e.note());
            ps.setString(5, e.merchant());
            ps.setString(6, e.source().name());
            ps.setLong(7, e.spentAt());
            ps.setLong(8, e.createdAt());
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                return keys.next() ? keys.getLong(1) : 0;
            }
        }
    }

    public void updateExpense(Connection c, Expense e) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("UPDATE expenses SET category_id = ?, amount = ?, note = ?, "
                + "merchant = ?, spent_at = ? WHERE id = ?")) {
            ps.setLong(1, e.categoryId());
            ps.setString(2, e.amount().toPlainString());
            ps.setString(3, e.note());
            ps.setString(4, e.merchant());
            ps.setLong(5, e.spentAt());
            ps.setLong(6, e.id());
            ps.executeUpdate();
        }
    }

    public void deleteExpense(Connection c, long id) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("DELETE FROM expenses WHERE id = ?")) {
            ps.setLong(1, id);
            ps.executeUpdate();
        }
    }

    public Optional<Expense> findExpense(Connection c, long id) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT * FROM expenses WHERE id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(expense(rs)) : Optional.empty();
            }
        }
    }

    /** Expenses with {@code from <= spent_at < to}, newest first. */
    public List<Expense> expensesBetween(Connection c, long userId, long from, long to) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT * FROM expenses WHERE user_id = ? AND spent_at >= ? "
                + "AND spent_at < ? ORDER BY spent_at DESC, id DESC")) {
            ps.setLong(1, userId);
            ps.setLong(2, from);
            ps.setLong(3, to);
            List<Expense> out = new ArrayList<>();
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    out.add(expense(rs));
                }
            }
            return out;
        }
    }

    /** Total per category id for {@code from <= spent_at < to}. Summed in Java to keep exact decimals. */
    public Map<Long, BigDecimal> totalsByCategory(Connection c, long userId, long from, long to) throws SQLException {
        Map<Long, BigDecimal> out = new LinkedHashMap<>();
        for (Expense e : expensesBetween(c, userId, from, to)) {
            out.merge(e.categoryId(), e.amount(), BigDecimal::add);
        }
        return out;
    }

    private Expense expense(ResultSet rs) throws SQLException {
        return new Expense(rs.getLong("id"), rs.getLong("user_id"), rs.getLong("category_id"),
                new BigDecimal(rs.getString("amount")), rs.getString("note"), rs.getString("merchant"),
                ExpenseSource.valueOf(rs.getString("source")), rs.getLong("spent_at"), rs.getLong("created_at"));
    }

    // ----- budgets

    public Optional<BigDecimal> budget(Connection c, long userId, String month) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT amount FROM budgets WHERE user_id = ? AND month = ?")) {
            ps.setLong(1, userId);
            ps.setString(2, month);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(new BigDecimal(rs.getString(1))) : Optional.empty();
            }
        }
    }

    /** The most recent budget set on or before {@code month}, so a budget carries over to later months. */
    public Optional<BigDecimal> latestBudget(Connection c, long userId, String month) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("SELECT amount FROM budgets WHERE user_id = ? AND month <= ? "
                + "ORDER BY month DESC LIMIT 1")) {
            ps.setLong(1, userId);
            ps.setString(2, month);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(new BigDecimal(rs.getString(1))) : Optional.empty();
            }
        }
    }

    public void putBudget(Connection c, long userId, String month, BigDecimal amount) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement("INSERT INTO budgets (user_id, month, amount) VALUES (?,?,?) "
                + "ON CONFLICT (user_id, month) DO UPDATE SET amount = excluded.amount")) {
            ps.setLong(1, userId);
            ps.setString(2, month);
            ps.setString(3, amount.toPlainString());
            ps.executeUpdate();
        }
    }

    // ----- alerts

    /** Records an alert; returns false if it was already sent this month. */
    public boolean markAlert(Connection c, long userId, String month, String code) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT OR IGNORE INTO coach_alerts (user_id, month, code) VALUES (?,?,?)")) {
            ps.setLong(1, userId);
            ps.setString(2, month);
            ps.setString(3, code);
            return ps.executeUpdate() == 1;
        }
    }
}

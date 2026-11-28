package com.ershak.coach;

import com.ershak.db.Database;
import com.ershak.exception.ForbiddenException;
import com.ershak.exception.InvalidAmountException;
import com.ershak.exception.NotFoundException;
import com.ershak.exception.ValidationException;
import com.ershak.model.SavingsGoal;
import com.ershak.service.NotificationService;
import com.ershak.service.Repositories;
import com.ershak.util.BankClock;
import com.ershak.util.Money;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Ershak the coach: tracks what the user spends, compares it with the monthly budget, works out
 * the mood, the money personality and a savings plan, and sends alerts when spending runs high.
 * All the arithmetic is here, in plain Java, so the numbers are exact and testable; an AI (later)
 * only rephrases what this class computes.
 */
public class CoachService {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal MAX_EXPENSE = new BigDecimal("1000000");

    /** code, Arabic name, English name, icon (Lucide name), color, essential, order. */
    private static final Object[][] DEFAULT_CATEGORIES = {
        {"bills", "فواتير", "Bills", "receipt", "#3E6FD8", true, 10},
        {"rent", "إيجار", "Rent", "home", "#475569", true, 20},
        {"groceries", "أكل وبقالة", "Groceries", "shopping-cart", "#1F9D6B", true, 30},
        {"transport", "مواصلات وبنزين", "Transport & fuel", "bus", "#0E8FA3", true, 40},
        {"health", "صحة ودوا", "Health", "heart-pulse", "#D64545", true, 50},
        {"education", "مدارس وتعليم", "Education", "graduation-cap", "#B7791F", true, 60},
        {"charity", "صدقة وزكاة", "Charity & zakat", "hand-heart", "#1F7A55", true, 70},
        {"outings", "خروج وكافيهات", "Outings & cafés", "coffee", "#D9822B", false, 80},
        {"clothes", "هدوم", "Clothes", "shirt", "#8B5CF6", false, 90},
        {"subscriptions", "اشتراكات", "Subscriptions", "credit-card", "#5B6BD8", false, 100},
        {"electronics", "إلكترونيات", "Electronics", "smartphone", "#0F766E", false, 110},
        {"gifts", "هدايا ومناسبات", "Gifts & occasions", "gift", "#DB2777", false, 120},
        {"other", "أخرى", "Other", "circle-dot", "#64748B", false, 130},
    };

    // ----- results returned to the API (records serialize straight to JSON)

    public record ExpenseView(long id, BigDecimal amount, String note, String merchant, ExpenseSource source,
                              long spentAt, Category category) {
    }

    public record AddResult(ExpenseView expense, List<String> alerts) {
    }

    public record CategoryTotal(Category category, BigDecimal total, BigDecimal percent) {
    }

    public record Overview(String month, BigDecimal budget, BigDecimal spent, BigDecimal left, BigDecimal leftPercent,
                           Mood mood, String moodLabel, String message, BigDecimal essential, BigDecimal nonEssential,
                           int daysLeft, List<CategoryTotal> categories) {
    }

    public record WeekTotal(String label, BigDecimal total) {
    }

    public record Personality(String title, String description) {
    }

    public record Insights(Overview overview, List<WeekTotal> weeks, Personality personality,
                           List<String> observations, BigDecimal previousMonthSpent) {
    }

    public record Cut(Category category, BigDecimal monthlyNow, BigDecimal suggested, BigDecimal saving) {
    }

    public record GoalPlan(long goalId, String goalName, BigDecimal target, BigDecimal saved, BigDecimal remaining,
                           int monthsLeft, BigDecimal neededPerMonth, BigDecimal savingNow, BigDecimal gap,
                           List<Cut> cuts, BigDecimal totalCuts, boolean reachable, String message) {
    }

    public record SmsSuggestion(BigDecimal amount, String merchant, boolean debit, Category category) {
    }

    private final Database db;
    private final Repositories repos;
    private final NotificationService notifications;
    private final CoachDao dao = new CoachDao();

    public CoachService(Database db, Repositories repos, NotificationService notifications) {
        this.db = db;
        this.repos = repos;
        this.notifications = notifications;
        ensureDefaultCategories();
    }

    private void ensureDefaultCategories() {
        db.inTransaction(c -> {
            if (dao.countBuiltIn(c) == 0) {
                long now = BankClock.nowMillis();
                for (Object[] d : DEFAULT_CATEGORIES) {
                    dao.insertCategory(c, null, (String) d[0], (String) d[1], (String) d[2], (String) d[3],
                            (String) d[4], (Boolean) d[5], (Integer) d[6], now);
                }
            }
            return null;
        });
    }

    // ----- categories

    public List<Category> categories(long userId) {
        return db.read(c -> dao.categoriesFor(c, userId));
    }

    public Category addCategory(long userId, String name, String icon, String color, boolean essential) {
        String clean = name == null ? "" : name.trim();
        if (clean.isEmpty() || clean.length() > 30) {
            throw new ValidationException("Give the category a name up to 30 characters.");
        }
        String iconName = icon == null || icon.isBlank() ? "circle-dot" : icon.trim();
        if (!iconName.matches("[a-z0-9-]{1,30}")) {
            throw new ValidationException("Unknown icon.");
        }
        String hex = color == null || color.isBlank() ? "#64748B" : color.trim();
        if (!hex.matches("#[0-9A-Fa-f]{6}")) {
            throw new ValidationException("Colors look like #3E6FD8.");
        }
        return db.inTransaction(c -> {
            long id = dao.insertCategory(c, userId, null, clean, clean, iconName, hex.toUpperCase(), essential, 500,
                    BankClock.nowMillis());
            return dao.findCategory(c, id).orElseThrow();
        });
    }

    public void deleteCategory(long userId, long categoryId) {
        db.inTransaction(c -> {
            Category cat = dao.findCategory(c, categoryId).orElseThrow(() -> new NotFoundException("Category"));
            if (cat.builtIn() || cat.userId() != userId) {
                throw new ForbiddenException();
            }
            if (dao.countExpensesInCategory(c, categoryId) > 0) {
                throw new ValidationException("This category has expenses. Move them to another category first.");
            }
            dao.deleteCategory(c, categoryId);
            return null;
        });
    }

    // ----- expenses

    public AddResult addExpense(long userId, long categoryId, BigDecimal amount, String note, String merchant,
                                ExpenseSource source, String date) {
        BigDecimal value = checkAmount(amount);
        String cleanNote = clip(note, 80, "note");
        String cleanMerchant = clip(merchant, 40, "merchant");
        long spentAt = spentAt(date);
        ExpenseSource src = source == null ? ExpenseSource.MANUAL : source;
        return db.inTransaction(c -> {
            Category cat = usableCategory(c, userId, categoryId);
            long now = BankClock.nowMillis();
            Expense e = new Expense(0, userId, cat.id(), value, cleanNote, cleanMerchant, src, spentAt, now);
            long id = dao.insertExpense(c, e);
            List<String> alerts = checkAlerts(c, userId, cat, YearMonth.from(BankClock.toZoned(spentAt)));
            return new AddResult(new ExpenseView(id, value, cleanNote, cleanMerchant, src, spentAt, cat), alerts);
        });
    }

    public ExpenseView updateExpense(long userId, long expenseId, long categoryId, BigDecimal amount, String note,
                                     String merchant, String date) {
        BigDecimal value = checkAmount(amount);
        String cleanNote = clip(note, 80, "note");
        String cleanMerchant = clip(merchant, 40, "merchant");
        return db.inTransaction(c -> {
            Expense old = ownExpense(c, userId, expenseId);
            Category cat = usableCategory(c, userId, categoryId);
            long when = date == null || date.isBlank() ? old.spentAt() : spentAt(date);
            Expense e = new Expense(old.id(), userId, cat.id(), value, cleanNote, cleanMerchant, old.source(), when,
                    old.createdAt());
            dao.updateExpense(c, e);
            return new ExpenseView(e.id(), value, cleanNote, cleanMerchant, e.source(), when, cat);
        });
    }

    public void deleteExpense(long userId, long expenseId) {
        db.inTransaction(c -> {
            ownExpense(c, userId, expenseId);
            dao.deleteExpense(c, expenseId);
            return null;
        });
    }

    public List<ExpenseView> expenses(long userId, String month) {
        YearMonth ym = month(month);
        return db.read(c -> {
            Map<Long, Category> cats = categoryMap(c, userId);
            List<ExpenseView> out = new ArrayList<>();
            for (Expense e : dao.expensesBetween(c, userId, start(ym), start(ym.plusMonths(1)))) {
                out.add(new ExpenseView(e.id(), e.amount(), e.note(), e.merchant(), e.source(), e.spentAt(),
                        cats.get(e.categoryId())));
            }
            return out;
        });
    }

    // ----- budget, overview, insights

    public BigDecimal setBudget(long userId, String month, BigDecimal amount) {
        BigDecimal value = Money.requirePositive(amount);
        if (Money.greaterThan(value, MAX_EXPENSE)) {
            throw new InvalidAmountException("That budget is too large.");
        }
        YearMonth ym = month(month);
        db.inTransaction(c -> {
            dao.putBudget(c, userId, ym.toString(), value);
            return null;
        });
        return value;
    }

    public Overview overview(long userId, String month) {
        YearMonth ym = month(month);
        return db.read(c -> overview(c, userId, ym));
    }

    private Overview overview(Connection c, long userId, YearMonth ym) throws SQLException {
        Map<Long, Category> cats = categoryMap(c, userId);
        Map<Long, BigDecimal> totals = dao.totalsByCategory(c, userId, start(ym), start(ym.plusMonths(1)));
        BigDecimal spent = Money.ZERO;
        BigDecimal essential = Money.ZERO;
        BigDecimal nonEssential = Money.ZERO;
        List<CategoryTotal> byCategory = new ArrayList<>();
        for (Map.Entry<Long, BigDecimal> t : totals.entrySet()) {
            spent = spent.add(t.getValue());
        }
        for (Map.Entry<Long, BigDecimal> t : totals.entrySet()) {
            Category cat = cats.get(t.getKey());
            if (cat == null) {
                continue;
            }
            if (cat.essential()) {
                essential = essential.add(t.getValue());
            } else {
                nonEssential = nonEssential.add(t.getValue());
            }
            byCategory.add(new CategoryTotal(cat, Money.of(t.getValue()), percent(t.getValue(), spent)));
        }
        byCategory.sort(Comparator.comparing(CategoryTotal::total).reversed());

        BigDecimal budget = dao.latestBudget(c, userId, ym.toString()).orElse(null);
        BigDecimal left = budget == null ? null : Money.of(budget.subtract(spent));
        BigDecimal leftPercent = budget == null ? null : percent(budget.subtract(spent), budget);
        Mood mood = leftPercent == null ? Mood.CALM : Mood.fromLeftPercent(leftPercent);
        CategoryTotal topWant = byCategory.stream().filter(t -> !t.category().essential()).findFirst().orElse(null);
        String message = CoachMessages.forMood(mood, budget, spent, left, leftPercent, topWant);
        return new Overview(ym.toString(), budget, Money.of(spent), left, leftPercent, mood, mood.labelAr(), message,
                Money.of(essential), Money.of(nonEssential), daysLeft(ym), byCategory);
    }

    public Insights insights(long userId, String month) {
        YearMonth ym = month(month);
        return db.read(c -> {
            Overview ov = overview(c, userId, ym);
            Map<Long, Category> cats = categoryMap(c, userId);
            List<Expense> list = dao.expensesBetween(c, userId, start(ym), start(ym.plusMonths(1)));

            BigDecimal[] weeks = new BigDecimal[5];
            java.util.Arrays.fill(weeks, BigDecimal.ZERO);
            BigDecimal wantsWeekend = BigDecimal.ZERO;
            for (Expense e : list) {
                ZonedDateTime when = BankClock.toZoned(e.spentAt());
                weeks[Math.min(4, (when.getDayOfMonth() - 1) / 7)] = weeks[Math.min(4, (when.getDayOfMonth() - 1) / 7)]
                        .add(e.amount());
                Category cat = cats.get(e.categoryId());
                DayOfWeek d = when.getDayOfWeek();
                if (cat != null && !cat.essential() && (d == DayOfWeek.THURSDAY || d == DayOfWeek.FRIDAY)) {
                    wantsWeekend = wantsWeekend.add(e.amount());
                }
            }
            List<WeekTotal> weekTotals = new ArrayList<>();
            int weekCount = ym.lengthOfMonth() > 28 ? 5 : 4;
            for (int i = 0; i < weekCount; i++) {
                weekTotals.add(new WeekTotal("أسبوع " + (i + 1), Money.of(weeks[i])));
            }

            Personality personality = personality(ov, wantsWeekend);

            Map<Long, BigDecimal> prev = dao.totalsByCategory(c, userId, start(ym.minusMonths(1)), start(ym));
            BigDecimal prevSpent = Money.ZERO;
            for (BigDecimal v : prev.values()) {
                prevSpent = prevSpent.add(v);
            }
            List<String> observations = new ArrayList<>();
            for (CategoryTotal t : ov.categories()) {
                BigDecimal before = prev.getOrDefault(t.category().id(), BigDecimal.ZERO);
                if (before.signum() <= 0) {
                    continue;
                }
                BigDecimal diff = t.total().subtract(before);
                BigDecimal change = percent(diff, before);
                if (diff.compareTo(new BigDecimal("200")) >= 0 && change.compareTo(new BigDecimal("25")) >= 0) {
                    observations.add(t.category().nameAr() + " زاد " + change.setScale(0, RoundingMode.HALF_UP)
                            + "% عن الشهر اللي فات");
                } else if (diff.negate().compareTo(new BigDecimal("200")) >= 0
                        && change.negate().compareTo(new BigDecimal("25")) >= 0) {
                    observations.add(t.category().nameAr() + " قل " + change.negate().setScale(0, RoundingMode.HALF_UP)
                            + "% عن الشهر اللي فات، عاش");
                }
            }
            ov.categories().stream().filter(t -> "subscriptions".equals(t.category().code())).findFirst()
                    .ifPresent(t -> observations.add("الاشتراكات واخدة " + CoachMessages.egp(t.total())
                            + " الشهر ده. فيه حاجة مش بتستخدمها؟"));
            ov.categories().stream().filter(t -> !t.category().essential()).findFirst()
                    .ifPresent(t -> observations.add(t.category().nameAr() + " أكتر بند مش أساسي ("
                            + CoachMessages.egp(t.total()) + ")"));
            return new Insights(ov, weekTotals, personality,
                    observations.size() > 4 ? observations.subList(0, 4) : observations, Money.of(prevSpent));
        });
    }

    private Personality personality(Overview ov, BigDecimal wantsWeekend) {
        if (ov.spent().signum() <= 0) {
            return new Personality("لسه بنتعرف", "سجّل مصاريف أسبوع، وهقولك شخصيتك المالية.");
        }
        BigDecimal essentialShare = percent(ov.essential(), ov.spent());
        String base;
        if (essentialShare.compareTo(new BigDecimal("75")) >= 0) {
            base = "مدبّر البيت";
        } else if (essentialShare.compareTo(new BigDecimal("55")) >= 0) {
            base = "متوازن";
        } else {
            base = "بيحب يعيش اللحظة";
        }
        BigDecimal weekendShare = ov.nonEssential().signum() > 0 ? percent(wantsWeekend, ov.nonEssential()) : Money.ZERO;
        boolean weekend = weekendShare.compareTo(new BigDecimal("50")) >= 0;
        String title = weekend ? base + "، بس كريم في الويك إند" : base;
        String description = essentialShare.setScale(0, RoundingMode.HALF_UP) + "% من صرفك على حاجات أساسية"
                + (weekend ? "، و" + weekendShare.setScale(0, RoundingMode.HALF_UP)
                + "% من صرفك على الحاجات اللي مش أساسية يوم الخميس والجمعة." : ".");
        return new Personality(title, description);
    }

    // ----- savings goal plan

    public GoalPlan goalPlan(long userId, long goalId) {
        return db.read(c -> {
            SavingsGoal g = repos.goals().findById(c, goalId).orElseThrow(() -> new NotFoundException("Goal"));
            if (g.getUserId() != userId) {
                throw new ForbiddenException();
            }
            YearMonth now = YearMonth.from(BankClock.now());
            BigDecimal remaining = g.getTargetAmount().subtract(g.getSavedAmount()).max(BigDecimal.ZERO);
            int months = 6;
            if (g.getTargetDate() != null && !g.getTargetDate().isBlank()) {
                YearMonth target = YearMonth.from(LocalDate.parse(g.getTargetDate()));
                months = (int) Math.max(1, ChronoUnit.MONTHS.between(now, target));
            }
            BigDecimal needed = roundUp(remaining.divide(BigDecimal.valueOf(months), 2, RoundingMode.UP), 10);

            // What the user saves today: budget minus spending, averaged over the last 3 full months.
            BigDecimal saved = BigDecimal.ZERO;
            int counted = 0;
            Map<Long, BigDecimal> wantsTotals = new HashMap<>();
            for (int i = 1; i <= 3; i++) {
                YearMonth m = now.minusMonths(i);
                Map<Long, BigDecimal> totals = dao.totalsByCategory(c, userId, start(m), start(m.plusMonths(1)));
                if (totals.isEmpty()) {
                    continue;
                }
                BigDecimal spent = totals.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
                Optional<BigDecimal> budget = dao.latestBudget(c, userId, m.toString());
                if (budget.isPresent()) {
                    saved = saved.add(budget.get().subtract(spent).max(BigDecimal.ZERO));
                    counted++;
                }
                totals.forEach((k, v) -> wantsTotals.merge(k, v, BigDecimal::add));
            }
            int wantMonths = Math.max(1, counted);
            if (counted == 0) {
                // No full month yet: use this month so far.
                Overview ov = overview(c, userId, now);
                if (ov.budget() != null) {
                    saved = ov.left().max(BigDecimal.ZERO);
                }
                counted = 1;
                for (CategoryTotal t : ov.categories()) {
                    wantsTotals.put(t.category().id(), t.total());
                }
            }
            BigDecimal savingNow = Money.of(saved.divide(BigDecimal.valueOf(counted), 2, RoundingMode.HALF_EVEN));
            BigDecimal gap = Money.of(needed.subtract(savingNow).max(BigDecimal.ZERO));

            Map<Long, Category> cats = categoryMap(c, userId);
            List<Cut> cuts = new ArrayList<>();
            BigDecimal totalCuts = Money.ZERO;
            List<Map.Entry<Long, BigDecimal>> wants = new ArrayList<>(wantsTotals.entrySet());
            wants.sort(Map.Entry.<Long, BigDecimal>comparingByValue().reversed());
            for (Map.Entry<Long, BigDecimal> w : wants) {
                if (totalCuts.compareTo(gap) >= 0) {
                    break;
                }
                Category cat = cats.get(w.getKey());
                if (cat == null || cat.essential()) {
                    continue;
                }
                BigDecimal monthly = Money.of(w.getValue().divide(BigDecimal.valueOf(wantMonths), 2, RoundingMode.HALF_EVEN));
                BigDecimal saving = roundDown(monthly.divide(BigDecimal.valueOf(2), 2, RoundingMode.DOWN), 50);
                if (saving.signum() <= 0) {
                    continue;
                }
                cuts.add(new Cut(cat, monthly, Money.of(monthly.subtract(saving)), saving));
                totalCuts = totalCuts.add(saving);
            }
            boolean reachable = totalCuts.compareTo(gap) >= 0;
            String message;
            if (gap.signum() == 0) {
                message = "ماشي على الطريق الصح. كمّل كده وهتوصل في معادك.";
            } else if (reachable) {
                message = "ناقصك " + CoachMessages.egp(gap) + " في الشهر. لو عملت الخطة دي هتوصل في معادك.";
            } else {
                BigDecimal perMonth = savingNow.add(totalCuts);
                String extra = perMonth.signum() > 0
                        ? " لو مدّيت المعاد لـ " + remaining.divide(perMonth, 0, RoundingMode.UP) + " شهر هتوصل."
                        : " محتاج تحط ميزانية للشهر الأول عشان أحسبلك.";
                message = "حتى لو قللت الحاجات اللي مش أساسية، الفرق كبير." + extra;
            }
            return new GoalPlan(g.getId(), g.getName(), Money.of(g.getTargetAmount()), Money.of(g.getSavedAmount()),
                    Money.of(remaining), months, Money.of(needed), savingNow, gap, cuts, Money.of(totalCuts), reachable,
                    message);
        });
    }

    // ----- SMS

    public SmsSuggestion fromSms(long userId, String text) {
        SmsParser.Parsed p = SmsParser.parse(text)
                .orElseThrow(() -> new ValidationException("Couldn't find an amount in this message."));
        String code = CategoryGuesser.guess(p.merchant(), text);
        Category cat = db.read(c -> dao.findBuiltInByCode(c, code).orElseGet(() -> null));
        return new SmsSuggestion(p.amount(), p.merchant(), p.debit(), cat);
    }

    // ----- alerts

    private List<String> checkAlerts(Connection c, long userId, Category cat, YearMonth ym) throws SQLException {
        List<String> alerts = new ArrayList<>();
        String month = ym.toString();
        Map<Long, BigDecimal> totals = dao.totalsByCategory(c, userId, start(ym), start(ym.plusMonths(1)));
        BigDecimal spent = totals.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        Optional<BigDecimal> budget = dao.latestBudget(c, userId, month);
        if (budget.isPresent() && budget.get().signum() > 0) {
            BigDecimal used = percent(spent, budget.get());
            if (used.compareTo(HUNDRED) >= 0 && dao.markAlert(c, userId, month, "BUDGET_100")) {
                dao.markAlert(c, userId, month, "BUDGET_90");
                dao.markAlert(c, userId, month, "BUDGET_75");
                alerts.add(alert(c, userId, "عديت الميزانية", "صرفت " + CoachMessages.egp(spent) + " من "
                        + CoachMessages.egp(budget.get()) + ". من النهارده الأساسي بس لحد أول الشهر."));
            } else if (used.compareTo(new BigDecimal("90")) >= 0 && dao.markAlert(c, userId, month, "BUDGET_90")) {
                dao.markAlert(c, userId, month, "BUDGET_75");
                alerts.add(alert(c, userId, "فاضل 10% بس", "فاضل " + CoachMessages.egp(budget.get().subtract(spent))
                        + " لآخر الشهر. الحاجات اللي مش أساسية تستنى."));
            } else if (used.compareTo(new BigDecimal("75")) >= 0 && dao.markAlert(c, userId, month, "BUDGET_75")) {
                alerts.add(alert(c, userId, "صرفت 75% من الميزانية", "فاضل " + CoachMessages.egp(budget.get().subtract(spent))
                        + ". خلّي بالك الأيام الجاية."));
            }
        }
        // A category well above its usual level (average of the previous 3 months).
        BigDecimal thisMonth = totals.getOrDefault(cat.id(), BigDecimal.ZERO);
        BigDecimal history = BigDecimal.ZERO;
        int months = 0;
        for (int i = 1; i <= 3; i++) {
            YearMonth m = ym.minusMonths(i);
            Map<Long, BigDecimal> t = dao.totalsByCategory(c, userId, start(m), start(m.plusMonths(1)));
            if (!t.isEmpty()) {
                history = history.add(t.getOrDefault(cat.id(), BigDecimal.ZERO));
                months++;
            }
        }
        if (months > 0 && !cat.essential()) {
            BigDecimal usual = history.divide(BigDecimal.valueOf(months), 2, RoundingMode.HALF_EVEN);
            if (usual.signum() > 0 && thisMonth.compareTo(usual.multiply(new BigDecimal("1.5"))) > 0
                    && thisMonth.subtract(usual).compareTo(new BigDecimal("300")) >= 0
                    && dao.markAlert(c, userId, month, "CATEGORY_" + cat.id())) {
                alerts.add(alert(c, userId, cat.nameAr() + " أكتر من عادتك", "صرفت " + CoachMessages.egp(thisMonth)
                        + " على " + cat.nameAr() + " الشهر ده، وعادتك " + CoachMessages.egp(usual) + "."));
            }
        }
        return alerts;
    }

    private String alert(Connection c, long userId, String title, String message) throws SQLException {
        notifications.notify(c, userId, "COACH", "قرشك: " + title, message);
        return title + ": " + message;
    }

    // ----- helpers

    private Category usableCategory(Connection c, long userId, long categoryId) throws SQLException {
        Category cat = dao.findCategory(c, categoryId).orElseThrow(() -> new NotFoundException("Category"));
        if (!cat.builtIn() && cat.userId() != userId) {
            throw new ForbiddenException();
        }
        return cat;
    }

    private Expense ownExpense(Connection c, long userId, long expenseId) throws SQLException {
        Expense e = dao.findExpense(c, expenseId).orElseThrow(() -> new NotFoundException("Expense"));
        if (e.userId() != userId) {
            throw new ForbiddenException();
        }
        return e;
    }

    private Map<Long, Category> categoryMap(Connection c, long userId) throws SQLException {
        Map<Long, Category> m = new HashMap<>();
        for (Category cat : dao.categoriesFor(c, userId)) {
            m.put(cat.id(), cat);
        }
        return m;
    }

    private static BigDecimal checkAmount(BigDecimal amount) {
        BigDecimal value = Money.requirePositive(amount);
        if (Money.greaterThan(value, MAX_EXPENSE)) {
            throw new InvalidAmountException("That amount is too large for one expense.");
        }
        return value;
    }

    private static String clip(String s, int max, String field) {
        if (s == null || s.isBlank()) {
            return null;
        }
        String t = s.trim();
        if (t.length() > max) {
            throw new ValidationException("The " + field + " can be up to " + max + " characters.");
        }
        return t;
    }

    /** "2026-11-23" or blank (= now). Future dates are refused. */
    private static long spentAt(String date) {
        if (date == null || date.isBlank()) {
            return BankClock.nowMillis();
        }
        try {
            LocalDate d = LocalDate.parse(date.trim());
            LocalDate today = BankClock.now().toLocalDate();
            if (d.isAfter(today)) {
                throw new ValidationException("The date can't be in the future.");
            }
            if (d.equals(today)) {
                return BankClock.nowMillis();
            }
            return d.atTime(12, 0).atZone(BankClock.ZONE).toInstant().toEpochMilli();
        } catch (DateTimeParseException e) {
            throw new ValidationException("Dates must look like 2026-11-23.");
        }
    }

    static YearMonth month(String month) {
        if (month == null || month.isBlank()) {
            return YearMonth.from(BankClock.now());
        }
        try {
            return YearMonth.parse(month.trim());
        } catch (DateTimeParseException e) {
            throw new ValidationException("Months must look like 2026-11.");
        }
    }

    private static long start(YearMonth ym) {
        return ym.atDay(1).atStartOfDay(BankClock.ZONE).toInstant().toEpochMilli();
    }

    private static int daysLeft(YearMonth ym) {
        LocalDate today = BankClock.now().toLocalDate();
        if (!YearMonth.from(today).equals(ym)) {
            return YearMonth.from(today).isAfter(ym) ? 0 : ym.lengthOfMonth();
        }
        return ym.lengthOfMonth() - today.getDayOfMonth() + 1;
    }

    /** part / whole * 100, two decimals; zero when whole is zero. */
    static BigDecimal percent(BigDecimal part, BigDecimal whole) {
        if (whole == null || whole.signum() == 0) {
            return Money.ZERO;
        }
        return part.multiply(HUNDRED).divide(whole, 2, RoundingMode.HALF_EVEN);
    }

    private static BigDecimal roundUp(BigDecimal v, int step) {
        BigDecimal s = BigDecimal.valueOf(step);
        return Money.of(v.divide(s, 0, RoundingMode.UP).multiply(s));
    }

    private static BigDecimal roundDown(BigDecimal v, int step) {
        BigDecimal s = BigDecimal.valueOf(step);
        return Money.of(v.divide(s, 0, RoundingMode.DOWN).multiply(s));
    }
}

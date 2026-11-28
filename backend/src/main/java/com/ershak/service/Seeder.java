package com.ershak.service;

import com.ershak.model.Account;
import com.ershak.model.AccountType;
import com.ershak.model.Role;
import com.ershak.model.SavingsGoal;
import com.ershak.model.User;
import com.ershak.util.BankClock;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.ZonedDateTime;

/**
 * Creates the first bank officer and, optionally, demo customers with some history,
 * so the system can be shown right after the first start.
 */
public final class Seeder {

    public static final String ADMIN_USERNAME = "admin";
    public static final String ADMIN_PASSWORD = "Admin@2026";

    /** On a public server, set ERSHAK_ADMIN_PASSWORD so the officers do not start with the published password. */
    private static String officerPassword() {
        String v = System.getenv("ERSHAK_ADMIN_PASSWORD");
        return v == null || v.isBlank() ? ADMIN_PASSWORD : v;
    }
    public static final String DEMO_PASSWORD = "Ershak@2026";

    /** The password every seeded customer starts with. On a public server set ERSHAK_TEAM_PASSWORD and share it privately. */
    public static String teamPassword() {
        String v = System.getenv("ERSHAK_TEAM_PASSWORD");
        return v == null || v.isBlank() ? DEMO_PASSWORD : v;
    }

    /** True when the published demo passwords are in use (local runs), so the login page may show them. */
    public static boolean publicDemo() {
        String v = System.getenv("ERSHAK_TEAM_PASSWORD");
        return v == null || v.isBlank();
    }

    private Seeder() {
    }

    public static void seed(Bank bank, boolean demoData) {
        boolean hasAdmin = bank.db.read(c -> !bank.repos.users().findByRole(c, Role.ADMIN).isEmpty());
        if (!hasAdmin) {
            bank.db.inTransaction(c -> {
                User admin = new User("Bank Officer", "officer@ershak.bank", "01000000000", ADMIN_USERNAME, Role.ADMIN);
                AuthService.setPassword(admin, officerPassword());
                admin.setMustChangePassword(true);
                admin.setCreatedAt(BankClock.nowMillis());
                bank.repos.users().insert(c, admin);
                bank.audit.append(c, "system", "ADMIN_CREATED", "Default officer account");
                return null;
            });
        }
        boolean hasCustomers = bank.db.read(c -> bank.repos.users().countCustomers(c) > 0);
        if (demoData && !hasCustomers) {
            seedDemo(bank);
        }
        if (demoData) {
            seedTeam(bank);
            seedCoach(bank);
        }
    }

    /**
     * Gives every demo customer three months of everyday spending and a 9,000 EGP monthly budget,
     * so the coach screens (mood, analysis, alerts, goal plan) have something real to show.
     * Skips customers who already have a budget.
     */
    private static void seedCoach(Bank bank) {
        com.ershak.coach.CoachDao dao = new com.ershak.coach.CoachDao();
        java.time.YearMonth now = java.time.YearMonth.from(BankClock.now());
        int today = BankClock.now().getDayOfMonth();
        // day of month, category code, amount, note, merchant (outings mostly on Thursday/Friday nights)
        Object[][] month = {
            {1, "subscriptions", "165", "Netflix", "NETFLIX"}, {1, "subscriptions", "175", "شاهد", "SHAHID"},
            {2, "groceries", "620", "طلبات البيت", "CARREFOUR"}, {3, "transport", "180", "بنزين", "WATANIYA"},
            {4, "outings", "240", "قهوة", "STARBUCKS"}, {5, "bills", "650", "فاتورة الكهربا", null},
            {6, "outings", "320", "عشا مع الشلة", "TALABAT"}, {7, "transport", "120", "أوبر", "UBER"},
            {8, "groceries", "410", "خضار وفاكهة", null}, {9, "bills", "450", "النت", "WE"},
            {10, "health", "210", "دوا", "EL EZABY"}, {11, "clothes", "610", "قميص وبنطلون", "DEFACTO"},
            {12, "outings", "180", "سينما", "VOX"}, {13, "outings", "260", "كافيه", null},
            {14, "groceries", "520", "طلبات البيت", "SEOUDI"}, {15, "bills", "300", "كارت فودافون", "VODAFONE"},
            {16, "transport", "200", "بنزين", "WATANIYA"}, {17, "charity", "200", "صدقة", "RESALA"},
            {18, "outings", "200", "قهوة مع الشغل", null}, {20, "groceries", "300", "عيش ولبن", null},
            {21, "transport", "150", "مواصلات", null}, {22, "bills", "150", "الغاز", null},
            {24, "gifts", "350", "هدية عيد ميلاد", null}, {25, "outings", "340", "خروجة الويك إند", null},
            {27, "groceries", "450", "طلبات البيت", "CARREFOUR"}, {28, "health", "120", "كشف", null},
        };
        // Only the seeded demo and team customers: people who register themselves start empty.
        java.util.Set<String> seeded = new java.util.HashSet<>(java.util.List.of(
                "omar.ahmed", "sara.mahmoud", "mona.khaled", "youssef.gomaa"));
        for (Member m : TEAM) {
            seeded.add(m.username());
        }
        for (User u : bank.db.read(c -> bank.repos.users().findByRole(c, Role.CUSTOMER))) {
            if (!seeded.contains(u.getUsername())) {
                continue;
            }
            boolean has = bank.db.read(c -> dao.latestBudget(c, u.getId(), now.toString()).isPresent());
            if (has) {
                continue;
            }
            bank.db.inTransaction(c -> {
                for (int back = 2; back >= 0; back--) {
                    java.time.YearMonth ym = now.minusMonths(back);
                    dao.putBudget(c, u.getId(), ym.toString(), new BigDecimal("9000"));
                    for (Object[] e : month) {
                        int day = (Integer) e[0];
                        if (day > ym.lengthOfMonth() || (back == 0 && day > today)) {
                            continue;
                        }
                        BigDecimal amount = new BigDecimal((String) e[2]);
                        // Last month people went out less, so this month shows a real increase.
                        if (back == 1 && "outings".equals(e[1])) {
                            amount = amount.multiply(new BigDecimal("0.7")).setScale(0, java.math.RoundingMode.HALF_UP);
                        }
                        long cat = dao.findBuiltInByCode(c, (String) e[1]).orElseThrow().id();
                        long when = ym.atDay(day).atTime(20, 0).atZone(BankClock.ZONE).toInstant().toEpochMilli();
                        dao.insertExpense(c, new com.ershak.coach.Expense(0, u.getId(), cat, amount.setScale(2),
                                (String) e[3], (String) e[4], com.ershak.coach.ExpenseSource.MANUAL, when, when));
                    }
                }
                return null;
            });
        }
    }

    /** One person on the team: a customer login with money, and an officer login for the admin console. */
    private record Member(String name, String username, String phone, String officerUsername, String officerPhone,
                          String current, String savings) {
    }

    static final String NEW_USER = "test.new";

    private static final Member[] TEAM = {
            new Member("Youel", "youel", "01022222201", "youel.admin", "01000000001", "30000", null),
            new Member("Mohamed Shaaban", "mohamed.shaaban", "01022222202", "shaaban.admin", "01000000002", "10000", "40000"),
            new Member("Mohamed Hany", "mohamed.hany", "01022222203", "hany.admin", "01000000003", "35000", null),
            new Member("Asmaa", "asmaa", "01022222204", "asmaa.admin", "01000000004", "12000", "28000"),
            new Member("Eng. Ahmed", "eng.ahmed", "01022222205", "ahmed.admin", "01000000005", "50000", "50000"),
            new Member("Omar Mostafa", "omar.mostafa", "01022222207", "omar.mostafa.admin", "01000000007", "25000", "20000"),
            new Member("Test User", "test", "01022222206", null, null, "20000", null),
            // Only for automated tests, so scripts never clash with someone testing by hand.
            new Member("Automation", "auto.customer", "01022222208", "auto.officer", "01000000008", "40000", "20000"),
    };

    /**
     * Adds the project team and the instructor as customers with money (and officers for the console).
     * Safe to run on an existing database: anyone who already exists is skipped.
     */
    private static void seedTeam(Bank bank) {
        ZonedDateTime base = ZonedDateTime.now(BankClock.ZONE).withHour(12).withMinute(0).withSecond(0).withNano(0);
        try {
            String saraNumber = bank.db.read(c -> bank.repos.users().findByUsername(c, "sara.mahmoud"))
                    .flatMap(u -> bank.accounts.listForUser(u.getId()).stream().findFirst())
                    .map(Account::getAccountNumber).orElse(null);
            // A brand-new customer with no accounts and no expenses, for first-run and empty-state tests.
            if (!bank.db.read(c -> bank.repos.users().existsByUsername(c, NEW_USER))) {
                bank.auth.register("New Customer", "test_new@example.com", "01022222209", NEW_USER, teamPassword());
            }
            for (Member m : TEAM) {
                boolean exists = bank.db.read(c -> bank.repos.users().existsByUsername(c, m.username()));
                if (!exists) {
                    at(base.minusDays(14));
                    String slug = m.username().replace('.', '_');
                    User u = bank.auth.register(m.name(), slug + "@example.com", m.phone(), m.username(), teamPassword());
                    Account current = bank.accounts.open(u.getId(), AccountType.CURRENT, new BigDecimal(m.current()));
                    if (m.savings() != null) {
                        bank.accounts.open(u.getId(), AccountType.SAVINGS, new BigDecimal(m.savings()));
                    }
                    // Three small transfers, so the Fraud Guard already knows what "usual" looks like.
                    if (saraNumber != null) {
                        String[] amounts = {"300", "250", "350"};
                        int[] daysAgo = {12, 8, 4};
                        for (int i = 0; i < amounts.length; i++) {
                            at(base.minusDays(daysAgo[i]));
                            bank.transactions.transfer(u.getId(), current.getId(), saraNumber,
                                    new BigDecimal(amounts[i]), "Lunch");
                        }
                    }
                }
                if (m.officerUsername() != null) {
                    String officer = m.officerUsername();
                    boolean has = bank.db.read(c -> bank.repos.users().existsByUsername(c, officer));
                    if (!has) {
                        at(base.minusDays(14));
                        bank.db.inTransaction(c -> {
                            User o = new User(m.name() + " (Officer)", officer.replace('.', '_') + "@ershak.bank",
                                    m.officerPhone(), officer, Role.ADMIN);
                            AuthService.setPassword(o, officerPassword());
                            o.setMustChangePassword(!officer.startsWith("auto.")); // scripts can't change a password
                            o.setCreatedAt(BankClock.nowMillis());
                            bank.repos.users().insert(c, o);
                            bank.audit.append(c, "system", "OFFICER_CREATED", officer);
                            return null;
                        });
                    }
                }
            }
        } finally {
            BankClock.reset();
        }
    }

    private static void seedDemo(Bank bank) {
        ZonedDateTime base = ZonedDateTime.now(BankClock.ZONE).withHour(12).withMinute(0).withSecond(0).withNano(0);
        try {
            at(base.minusDays(20));
            User omar = bank.auth.register("Omar Ahmed", "omar@example.com", "01012345678", "omar.ahmed", teamPassword());
            User sara = bank.auth.register("Sara Mahmoud", "sara@example.com", "01112345678", "sara.mahmoud", teamPassword());
            User mona = bank.auth.register("Mona Khaled", "mona@example.com", "01212345678", "mona.khaled", teamPassword());
            User youssef = bank.auth.register("Youssef Gomaa", "youssef@example.com", "01512345678", "youssef.gomaa", teamPassword());

            Account omarSavings = bank.accounts.open(omar.getId(), AccountType.SAVINGS, new BigDecimal("45000"));
            Account omarCurrent = bank.accounts.open(omar.getId(), AccountType.CURRENT, new BigDecimal("15000"));
            Account saraCurrent = bank.accounts.open(sara.getId(), AccountType.CURRENT, new BigDecimal("5000"));
            bank.accounts.open(mona.getId(), AccountType.CURRENT, new BigDecimal("8000"));
            bank.accounts.open(youssef.getId(), AccountType.SAVINGS, new BigDecimal("6000"));

            // A normal spending pattern, so the Fraud Guard knows what "usual" looks like for Omar.
            at(base.minusDays(15));
            bank.transactions.transfer(omar.getId(), omarCurrent.getId(), saraCurrent.getAccountNumber(),
                    new BigDecimal("500"), "Dinner");
            at(base.minusDays(10));
            bank.transactions.transfer(omar.getId(), omarCurrent.getId(), saraCurrent.getAccountNumber(),
                    new BigDecimal("400"), "Gift");
            at(base.minusDays(6));
            bank.transactions.withdraw(omar.getId(), omarCurrent.getId(), new BigDecimal("600"));

            at(base.minusDays(1));
            bank.transactions.deposit(omar.getId(), omarSavings.getId(), new BigDecimal("25000"), "November salary");
            bank.transactions.transfer(omar.getId(), omarCurrent.getId(), saraCurrent.getAccountNumber(),
                    new BigDecimal("750"), "Rent share");

            SavingsGoal laptop = bank.goals.create(omar.getId(), omarSavings.getId(), "New laptop",
                    new BigDecimal("20000"), null);
            bank.goals.contribute(omar.getId(), laptop.getId(), new BigDecimal("6000"));
            SavingsGoal sahel = bank.goals.create(omar.getId(), omarSavings.getId(), "Sahel trip",
                    new BigDecimal("3000"), null);
            bank.goals.contribute(omar.getId(), sahel.getId(), new BigDecimal("3000"));
        } finally {
            BankClock.reset();
        }
    }

    private static void at(ZonedDateTime time) {
        BankClock.useClock(Clock.fixed(time.toInstant(), BankClock.ZONE));
    }
}

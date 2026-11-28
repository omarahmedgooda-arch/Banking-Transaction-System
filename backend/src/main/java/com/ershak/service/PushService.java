package com.ershak.service;

import com.ershak.coach.CoachMessages;
import com.ershak.coach.CoachService;
import com.ershak.coach.Mood;
import com.ershak.db.Database;
import com.ershak.exception.ValidationException;
import com.ershak.util.BankClock;
import com.ershak.web.Json;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Duration;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Real push notifications (Web Push), written on the JDK only: VAPID (RFC 8292) to identify the server and
 * aes128gcm payload encryption (RFC 8291) so the push service can't read the message.
 * <p>
 * Sends every in-app notification to the customer's devices, plus scheduled reminders: a daily
 * "how much did you spend today?" (skipped if they already logged something) and a weekly summary.
 * Quiet hours are respected for everything except security alerts.
 */
public class PushService {

    public record Prefs(boolean daily, String time, boolean weekly, String weeklyDay, boolean budget, boolean goals,
                        String quietFrom, String quietTo) {
    }

    private record Sub(long id, long userId, String endpoint, String p256dh, String auth) {
    }

    /** Kinds that are about the customer's safety: always sent, even in quiet hours. */
    private static final Set<String> SECURITY = Set.of("HOLD", "LOCK", "REVIEW");
    private static final Set<String> DAYS = Set.of("sat", "sun", "mon", "tue", "wed", "thu", "fri");
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();

    private final Database db;
    private final CoachService coach;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
    private final SecureRandom random = new SecureRandom();
    private final ScheduledExecutorService worker = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "push");
        t.setDaemon(true);
        return t;
    });
    private final String subject = env("ERSHAK_PUSH_SUBJECT", "mailto:ershak@example.com");
    private ECParameterSpec curve;
    private ECPublicKey vapidPublic;
    private ECPrivateKey vapidPrivate;

    public PushService(Database db, CoachService coach) {
        this.db = db;
        this.coach = coach;
        loadOrCreateKeys();
    }

    /** Starts the minute-by-minute reminder check. */
    public void start() {
        worker.scheduleAtFixedRate(this::safeTick, 30, 60, TimeUnit.SECONDS);
    }

    public String publicKey() {
        return B64.encodeToString(point(vapidPublic));
    }

    // ------------------------------------------------------------------ subscriptions and preferences

    public void subscribe(long userId, String endpoint, String p256dh, String auth) {
        if (endpoint == null || !endpoint.startsWith("https://") || endpoint.length() > 1000) {
            throw new ValidationException("Invalid push subscription.");
        }
        try {
            if (B64D.decode(p256dh).length != 65 || B64D.decode(auth).length != 16) {
                throw new ValidationException("Invalid push subscription.");
            }
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new ValidationException("Invalid push subscription.");
        }
        db.inTransaction(c -> {
            try (PreparedStatement ps = c.prepareStatement("DELETE FROM push_subscriptions WHERE endpoint = ?")) {
                ps.setString(1, endpoint);
                ps.executeUpdate();
            }
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)")) {
                ps.setLong(1, userId);
                ps.setString(2, endpoint);
                ps.setString(3, p256dh);
                ps.setString(4, auth);
                ps.setLong(5, BankClock.nowMillis());
                ps.executeUpdate();
            }
            return null;
        });
    }

    public void unsubscribe(long userId, String endpoint) {
        db.inTransaction(c -> {
            try (PreparedStatement ps = c.prepareStatement(
                    "DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?")) {
                ps.setString(1, endpoint);
                ps.setLong(2, userId);
                ps.executeUpdate();
            }
            return null;
        });
    }

    public int deviceCount(long userId) {
        return db.read(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM push_subscriptions WHERE user_id = ?")) {
                ps.setLong(1, userId);
                try (ResultSet rs = ps.executeQuery()) {
                    return rs.next() ? rs.getInt(1) : 0;
                }
            }
        });
    }

    public Prefs prefs(long userId) {
        return db.read(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT * FROM reminder_prefs WHERE user_id = ?")) {
                ps.setLong(1, userId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        return new Prefs(true, "21:00", true, "fri", true, true, "00:00", "08:00");
                    }
                    return new Prefs(rs.getInt("daily") == 1, rs.getString("time"), rs.getInt("weekly") == 1,
                            rs.getString("weekly_day"), rs.getInt("budget") == 1, rs.getInt("goals") == 1,
                            rs.getString("quiet_from"), rs.getString("quiet_to"));
                }
            }
        });
    }

    public Prefs savePrefs(long userId, Prefs p) {
        for (String t : new String[] {p.time(), p.quietFrom(), p.quietTo()}) {
            if (t == null || !t.matches("([01]\\d|2[0-3]):[0-5]\\d")) {
                throw new ValidationException("Times must look like 21:00.");
            }
        }
        if (!DAYS.contains(p.weeklyDay())) {
            throw new ValidationException("Pick a day of the week.");
        }
        db.inTransaction(c -> {
            try (PreparedStatement ps = c.prepareStatement("""
                    INSERT INTO reminder_prefs (user_id, daily, time, weekly, weekly_day, budget, goals, quiet_from, quiet_to)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET daily = excluded.daily, time = excluded.time,
                      weekly = excluded.weekly, weekly_day = excluded.weekly_day, budget = excluded.budget,
                      goals = excluded.goals, quiet_from = excluded.quiet_from, quiet_to = excluded.quiet_to""")) {
                ps.setLong(1, userId);
                ps.setInt(2, p.daily() ? 1 : 0);
                ps.setString(3, p.time());
                ps.setInt(4, p.weekly() ? 1 : 0);
                ps.setString(5, p.weeklyDay());
                ps.setInt(6, p.budget() ? 1 : 0);
                ps.setInt(7, p.goals() ? 1 : 0);
                ps.setString(8, p.quietFrom());
                ps.setString(9, p.quietTo());
                ps.executeUpdate();
            }
            return null;
        });
        return prefs(userId);
    }

    // ------------------------------------------------------------------ sending

    /** Called for every in-app notification. Sends in the background so the request isn't slowed down. */
    public void onNotification(long userId, String kind, String title, String message) {
        worker.schedule(() -> {
            try {
                Prefs p = prefs(userId);
                boolean security = SECURITY.contains(kind);
                if (!security && quiet(p, BankClock.now().toLocalTime())) {
                    return;
                }
                if ("COACH".equals(kind) && !p.budget()) {
                    return;
                }
                String url = security ? "/notifications" : "COACH".equals(kind) ? "/" : "/notifications";
                sendToUser(userId, title, message, url, kind.toLowerCase(Locale.ROOT));
            } catch (RuntimeException e) {
                System.err.println("[push] " + e.getMessage());
            }
        }, 1, TimeUnit.SECONDS);
    }

    /** Sends a test notification right away; returns how many devices accepted it. */
    public int sendTest(long userId) {
        return sendToUser(userId, "قرشك", "الإشعارات شغالة 👌 هفكّرك تسجّل مصاريفك كل يوم.", "/", "test");
    }

    public int sendToUser(long userId, String title, String body, String url, String tag) {
        List<Sub> subs = db.read(c -> {
            List<Sub> out = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?")) {
                ps.setLong(1, userId);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        out.add(new Sub(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4), rs.getString(5)));
                    }
                }
            }
            return out;
        });
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", title);
        payload.put("body", body);
        payload.put("url", url);
        payload.put("tag", tag);
        byte[] json = Json.write(payload).getBytes(StandardCharsets.UTF_8);
        int ok = 0;
        for (Sub s : subs) {
            try {
                int status = send(s, json);
                if (status == 404 || status == 410) { // the browser unsubscribed: forget this device
                    db.inTransaction(c -> {
                        try (PreparedStatement ps = c.prepareStatement("DELETE FROM push_subscriptions WHERE id = ?")) {
                            ps.setLong(1, s.id());
                            ps.executeUpdate();
                        }
                        return null;
                    });
                } else if (status / 100 == 2) {
                    ok++;
                } else {
                    System.err.println("[push] push service answered " + status);
                }
            } catch (Exception e) {
                System.err.println("[push] send failed: " + e.getMessage());
            }
        }
        return ok;
    }

    private int send(Sub s, byte[] plaintext) throws Exception {
        byte[] body = encrypt(plaintext, B64D.decode(s.p256dh()), B64D.decode(s.auth()));
        URI uri = URI.create(s.endpoint());
        String audience = uri.getScheme() + "://" + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "");
        HttpRequest req = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(15))
                .header("Content-Encoding", "aes128gcm")
                .header("Content-Type", "application/octet-stream")
                .header("TTL", "86400")
                .header("Urgency", "normal")
                .header("Authorization", "vapid t=" + vapidJwt(audience) + ", k=" + publicKey())
                .POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
        return http.send(req, HttpResponse.BodyHandlers.discarding()).statusCode();
    }

    // ------------------------------------------------------------------ scheduled reminders

    private void safeTick() {
        try {
            tick(BankClock.now().atZone(BankClock.ZONE));
        } catch (RuntimeException e) {
            System.err.println("[push] reminder check failed: " + e.getMessage());
        }
    }

    /** Package-visible for tests: runs the reminder check as if it were {@code now}. */
    void tick(ZonedDateTime now) {
        String hhmm = String.format("%02d:%02d", now.getHour(), now.getMinute());
        String today = now.toLocalDate().toString();
        String day = now.getDayOfWeek().getDisplayName(java.time.format.TextStyle.SHORT, Locale.ENGLISH)
                .toLowerCase(Locale.ROOT);
        List<long[]> due = new ArrayList<>(); // userId, 1 = daily, 2 = weekly
        db.read(c -> {
            try (PreparedStatement ps = c.prepareStatement("""
                    SELECT r.user_id, r.daily, r.weekly, r.weekly_day, r.last_daily, r.last_weekly
                    FROM reminder_prefs r WHERE r.time = ?
                      AND EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = r.user_id)""")) {
                ps.setString(1, hhmm);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        long uid = rs.getLong(1);
                        if (rs.getInt(2) == 1 && !today.equals(rs.getString(5))) {
                            due.add(new long[] {uid, 1});
                        }
                        if (rs.getInt(3) == 1 && day.equals(rs.getString(4)) && !today.equals(rs.getString(6))) {
                            due.add(new long[] {uid, 2});
                        }
                    }
                }
            }
            return null;
        });
        for (long[] d : due) {
            long uid = d[0];
            Prefs p = prefs(uid);
            mark(uid, d[1] == 1 ? "last_daily" : "last_weekly", today);
            if (quiet(p, now.toLocalTime())) {
                continue;
            }
            if (d[1] == 1) {
                dailyReminder(uid, now);
            } else {
                weeklySummary(uid, now, p);
            }
        }
    }

    private void dailyReminder(long userId, ZonedDateTime now) {
        long startOfDay = now.toLocalDate().atStartOfDay(BankClock.ZONE).toInstant().toEpochMilli();
        boolean loggedToday = coach.expenses(userId, null).stream().anyMatch(e -> e.spentAt() >= startOfDay);
        if (loggedToday) {
            return; // they already logged: don't nag
        }
        CoachService.Overview o = coach.overview(userId, null);
        String body = switch (o.mood()) {
            case PLAYFUL -> "صرفت كام النهارده يا معلم؟ سجّلهم في ثانية.";
            case CALM -> "متنساش تسجّل مصاريف النهارده.";
            case FIRM -> "سجّل مصاريف النهارده. فاضل " + CoachMessages.egp(o.left()) + " والشهر لسه مخلصش.";
        };
        sendToUser(userId, "قرشك", body, "/?add=1", "daily");
    }

    private void weeklySummary(long userId, ZonedDateTime now, Prefs p) {
        long weekAgo = now.minusDays(7).toInstant().toEpochMilli();
        BigDecimal week = BigDecimal.ZERO;
        for (CoachService.ExpenseView e : coach.expenses(userId, null)) {
            if (e.spentAt() >= weekAgo) {
                week = week.add(e.amount());
            }
        }
        if (now.getDayOfMonth() <= 7) { // early in the month: include last month's tail too
            for (CoachService.ExpenseView e : coach.expenses(userId, now.minusMonths(1).toLocalDate().toString().substring(0, 7))) {
                if (e.spentAt() >= weekAgo) {
                    week = week.add(e.amount());
                }
            }
        }
        CoachService.Overview o = coach.overview(userId, null);
        String body = "صرفت " + CoachMessages.egp(week) + " الأسبوع ده، والفاضل " + CoachMessages.egp(o.left())
                + " لآخر الشهر.";
        if (o.mood() == Mood.FIRM) {
            body += " الحاجات اللي مش أساسية تستنى.";
        }
        sendToUser(userId, "ملخص الأسبوع", body, "/expenses?tab=insights", "weekly");
    }

    private void mark(long userId, String column, String date) {
        db.inTransaction(c -> {
            try (PreparedStatement ps = c.prepareStatement(
                    "UPDATE reminder_prefs SET " + column + " = ? WHERE user_id = ?")) { // column is a constant above
                ps.setString(1, date);
                ps.setLong(2, userId);
                ps.executeUpdate();
            }
            return null;
        });
    }

    /** True inside quiet hours. Handles ranges that cross midnight, such as 23:00–08:00. */
    static boolean quiet(Prefs p, LocalTime t) {
        LocalTime from = LocalTime.parse(p.quietFrom());
        LocalTime to = LocalTime.parse(p.quietTo());
        if (from.equals(to)) {
            return false;
        }
        return from.isBefore(to) ? !t.isBefore(from) && t.isBefore(to) : !t.isBefore(from) || t.isBefore(to);
    }

    // ------------------------------------------------------------------ crypto (RFC 8291 + RFC 8292)

    /** Encrypts a push message for one browser (aes128gcm content coding, a single record). */
    byte[] encrypt(byte[] plaintext, byte[] uaPublic, byte[] authSecret) throws Exception {
        KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
        g.initialize(new ECGenParameterSpec("secp256r1"), random);
        KeyPair as = g.generateKeyPair();
        byte[] asPublic = point((ECPublicKey) as.getPublic());

        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(as.getPrivate());
        ka.doPhase(publicFromPoint(uaPublic), true);
        byte[] ecdh = ka.generateSecret();

        byte[] prkKey = hmac(authSecret, ecdh);
        byte[] keyInfo = concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublic, asPublic, new byte[] {1});
        byte[] ikm = hmac(prkKey, keyInfo);

        byte[] salt = new byte[16];
        random.nextBytes(salt);
        byte[] prk = hmac(salt, ikm);
        byte[] cek = slice(hmac(prk, concat("Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), new byte[] {1})), 16);
        byte[] nonce = slice(hmac(prk, concat("Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), new byte[] {1})), 12);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] ciphertext = cipher.doFinal(concat(plaintext, new byte[] {2})); // 0x02 = last record

        ByteBuffer header = ByteBuffer.allocate(16 + 4 + 1 + asPublic.length);
        header.put(salt).putInt(4096).put((byte) asPublic.length).put(asPublic);
        return concat(header.array(), ciphertext);
    }

    /** A short-lived ES256 JWT that proves the push came from this server. */
    String vapidJwt(String audience) throws Exception {
        String head = B64.encodeToString("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
        long exp = BankClock.nowMillis() / 1000 + 12 * 3600;
        String claims = B64.encodeToString(Json.write(Map.of("aud", audience, "exp", exp, "sub", subject))
                .getBytes(StandardCharsets.UTF_8));
        String signingInput = head + "." + claims;
        Signature sig = Signature.getInstance("SHA256withECDSA");
        sig.initSign(vapidPrivate);
        sig.update(signingInput.getBytes(StandardCharsets.US_ASCII));
        return signingInput + "." + B64.encodeToString(derToRaw(sig.sign()));
    }

    private void loadOrCreateKeys() {
        try {
            AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
            params.init(new ECGenParameterSpec("secp256r1"));
            curve = params.getParameterSpec(ECParameterSpec.class);
            String pub = setting("vapid_public");
            String priv = setting("vapid_private");
            if (pub == null || priv == null) {
                KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
                g.initialize(new ECGenParameterSpec("secp256r1"), random);
                KeyPair kp = g.generateKeyPair();
                pub = B64.encodeToString(point((ECPublicKey) kp.getPublic()));
                priv = B64.encodeToString(fixed(((ECPrivateKey) kp.getPrivate()).getS()));
                saveSetting("vapid_public", pub);
                saveSetting("vapid_private", priv);
            }
            vapidPublic = publicFromPoint(B64D.decode(pub));
            vapidPrivate = (ECPrivateKey) KeyFactory.getInstance("EC")
                    .generatePrivate(new ECPrivateKeySpec(new BigInteger(1, B64D.decode(priv)), curve));
        } catch (Exception e) {
            throw new IllegalStateException("Could not set up push keys", e);
        }
    }

    private String setting(String key) {
        return db.read(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT value FROM settings WHERE key = ?")) {
                ps.setString(1, key);
                try (ResultSet rs = ps.executeQuery()) {
                    return rs.next() ? rs.getString(1) : null;
                }
            }
        });
    }

    private void saveSetting(String key, String value) {
        db.inTransaction(c -> {
            try (PreparedStatement ps = c.prepareStatement(
                    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")) {
                ps.setString(1, key);
                ps.setString(2, value);
                ps.executeUpdate();
            }
            return null;
        });
    }

    private ECPublicKey publicFromPoint(byte[] p) throws Exception {
        if (p.length != 65 || p[0] != 4) {
            throw new IllegalArgumentException("not an uncompressed P-256 point");
        }
        BigInteger x = new BigInteger(1, java.util.Arrays.copyOfRange(p, 1, 33));
        BigInteger y = new BigInteger(1, java.util.Arrays.copyOfRange(p, 33, 65));
        return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(new ECPoint(x, y), curve));
    }

    private static byte[] point(ECPublicKey k) {
        return concat(new byte[] {4}, fixed(k.getW().getAffineX()), fixed(k.getW().getAffineY()));
    }

    /** A positive big integer as exactly 32 bytes. */
    private static byte[] fixed(BigInteger v) {
        byte[] b = v.toByteArray();
        byte[] out = new byte[32];
        int n = Math.min(b.length, 32);
        System.arraycopy(b, b.length - n, out, 32 - n, n);
        return out;
    }

    /** Java signs ECDSA as DER; JWT needs the raw 64-byte R||S. */
    private static byte[] derToRaw(byte[] der) {
        int i = 2;
        if ((der[1] & 0x80) != 0) {
            i += der[1] & 0x7f;
        }
        int rLen = der[i + 1];
        BigInteger r = new BigInteger(1, java.util.Arrays.copyOfRange(der, i + 2, i + 2 + rLen));
        i = i + 2 + rLen;
        int sLen = der[i + 1];
        BigInteger s = new BigInteger(1, java.util.Arrays.copyOfRange(der, i + 2, i + 2 + sLen));
        return concat(fixed(r), fixed(s));
    }

    private static byte[] hmac(byte[] key, byte[] data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    private static byte[] slice(byte[] b, int n) {
        return java.util.Arrays.copyOf(b, n);
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] p : parts) {
            out.writeBytes(p);
        }
        return out.toByteArray();
    }

    private static String env(String k, String fallback) {
        String v = System.getenv(k);
        return v == null || v.isBlank() ? fallback : v;
    }
}

package com.ershak.coach;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads an Egyptian bank or wallet SMS (Arabic or English) and pulls out the amount, the merchant
 * and whether money left or entered the account. Nothing is stored here: the result is a suggestion
 * the user confirms before it becomes an expense.
 */
public final class SmsParser {

    /** What was understood from one message. {@code merchant} may be null. */
    public record Parsed(BigDecimal amount, String merchant, boolean debit) {
    }

    private static final String NUM = "(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)";
    private static final String CUR = "(?:EGP|E\\.G\\.P|L\\.E\\.?|LE|جنيه(?:ا)?|جنية|ج\\.م\\.?|ج\\s?م)";
    private static final Pattern AMOUNT_AFTER = Pattern.compile(CUR + "\\s*" + NUM, Pattern.CASE_INSENSITIVE);
    private static final Pattern AMOUNT_BEFORE = Pattern.compile(NUM + "\\s*" + CUR, Pattern.CASE_INSENSITIVE);
    private static final Pattern AMOUNT_WORD = Pattern.compile("(?:مبلغ|بمبلغ|amount(?: of)?)\\s*" + NUM,
            Pattern.CASE_INSENSITIVE);

    private static final Pattern MERCHANT = Pattern.compile(
            "(?:\\bat\\b|\\bto\\b|لدى|لدي|عند|إلى|الى|الي)\\s+(.+?)(?=\\s+(?:on|في|بتاريخ|يوم|بنجاح|عبر|بواسطة|using|via|ref|رقم)(?:\\s|$)|\\s+\\d{1,2}[/-]\\d{1,2}|[.،,\\n]|$)",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern CREDIT = Pattern.compile(
            "(إيداع|ايداع|إضافة|اضافة|استلام|استلمت|وارد|credited|received|deposit|refund|استرداد)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern DEBIT = Pattern.compile(
            "(خصم|شراء|سحب|دفع|تحويل|سداد|charged|purchase|debited|spent|paid|withdraw|payment|transfer)",
            Pattern.CASE_INSENSITIVE);

    private SmsParser() {
    }

    public static Optional<Parsed> parse(String sms) {
        if (sms == null || sms.isBlank()) {
            return Optional.empty();
        }
        String text = normalizeDigits(sms.trim());
        BigDecimal amount = firstAmount(text);
        if (amount == null || amount.signum() <= 0) {
            return Optional.empty();
        }
        boolean credit = CREDIT.matcher(text).find();
        boolean debit = DEBIT.matcher(text).find();
        return Optional.of(new Parsed(amount, merchant(text), debit || !credit));
    }

    private static BigDecimal firstAmount(String text) {
        for (Pattern p : new Pattern[] {AMOUNT_AFTER, AMOUNT_BEFORE, AMOUNT_WORD}) {
            Matcher m = p.matcher(text);
            if (m.find()) {
                try {
                    return new BigDecimal(m.group(1).replace(",", "")).setScale(2, java.math.RoundingMode.HALF_EVEN);
                } catch (NumberFormatException ignored) {
                    // try the next pattern
                }
            }
        }
        return null;
    }

    private static String merchant(String text) {
        Matcher m = MERCHANT.matcher(text);
        while (m.find()) {
            String name = m.group(1).replaceAll("\\*+\\d*", "").replaceAll("\\s+", " ").trim();
            if (name.isEmpty() || name.toLowerCase(Locale.ROOT).matches(".*\\b(your|account|card)\\b.*")
                    || name.matches(".*(حسابك|حساب|بطاقتك|كارت).*")) {
                continue;
            }
            return name.length() > 40 ? name.substring(0, 40).trim() : name;
        }
        return null;
    }

    /** Converts Arabic-Indic digits (٠١٢...) and the Arabic decimal/thousands marks to ASCII. */
    static String normalizeDigits(String s) {
        StringBuilder out = new StringBuilder(s.length());
        for (char ch : s.toCharArray()) {
            if (ch >= '٠' && ch <= '٩') {
                out.append((char) ('0' + (ch - '٠')));
            } else if (ch >= '۰' && ch <= '۹') {
                out.append((char) ('0' + (ch - '۰')));
            } else if (ch == '٫') {
                out.append('.');
            } else if (ch == '٬') {
                out.append(',');
            } else {
                out.append(ch);
            }
        }
        return out.toString();
    }
}

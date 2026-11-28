package com.ershak.coach;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * The words Ershak says on the home screen, in Egyptian Arabic, picked by mood.
 * These are the built-in messages; the AI coach (later) can rephrase them, and they are the
 * fallback when the AI is not available.
 */
public final class CoachMessages {

    private CoachMessages() {
    }

    public static String egp(BigDecimal amount) {
        return String.format("%,d", amount.setScale(0, RoundingMode.HALF_UP).longValueExact()) + " جنيه";
    }

    static String forMood(Mood mood, BigDecimal budget, BigDecimal spent, BigDecimal left, BigDecimal leftPercent,
                          CoachService.CategoryTotal topWant) {
        if (budget == null) {
            return "حط ميزانية للشهر ده عشان أعرف أنصحك صح.";
        }
        if (left.signum() < 0) {
            return "عديت الميزانية بـ " + egp(left.negate()) + ". من النهارده الأساسي بس لحد أول الشهر.";
        }
        String want = topWant == null ? null : topWant.category().nameAr();
        return switch (mood) {
            case PLAYFUL -> spent.signum() == 0
                    ? "الشهر لسه بادئ وإنت ملك. سجّل مصاريفك أول بأول عشان أعرف أساعدك."
                    : want == null
                    ? "لسه بدري والدنيا فل. كمّل كده يا معلم."
                    : "لسه بدري والدنيا فل. بس " + want + " واخد " + egp(topWant.total()) + " لحد دلوقتي، خف شوية يا معلم.";
            case CALM -> {
                BigDecimal used = new BigDecimal("100").subtract(leftPercent).setScale(0, RoundingMode.HALF_UP);
                yield want == null
                        ? "صرفت " + used + "% من الميزانية. ماشي كويس، كمّل على كده."
                        : "صرفت " + used + "% من الميزانية. لو قللت " + want + " شوية الأسبوع ده، هتقفل الشهر مرتاح.";
            }
            case FIRM -> "فاضل " + egp(left) + " لآخر الشهر. "
                    + (want == null ? "أي حاجة مش أساسية تستنى" : want + " وأي حاجة مش أساسية يستنوا")
                    + "، الفواتير والأكل الأول.";
        };
    }
}

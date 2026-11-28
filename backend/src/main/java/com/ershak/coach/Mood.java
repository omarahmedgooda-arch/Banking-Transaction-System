package com.ershak.coach;

import java.math.BigDecimal;

/**
 * Ershak's mood depends on how much of the month's budget is left, not on the date:
 * more than 60% left = playful, 25% to 60% = calm advice, under 25% = the firm conscience.
 */
public enum Mood {
    PLAYFUL("رايق", "Playful"),
    CALM("هادي", "Calm"),
    FIRM("حازم", "Firm");

    public static final BigDecimal PLAYFUL_ABOVE = new BigDecimal("60");
    public static final BigDecimal CALM_FROM = new BigDecimal("25");

    private final String labelAr;
    private final String labelEn;

    Mood(String labelAr, String labelEn) {
        this.labelAr = labelAr;
        this.labelEn = labelEn;
    }

    public String labelAr() {
        return labelAr;
    }

    public String labelEn() {
        return labelEn;
    }

    /** @param leftPercent percent of the budget still left (may be negative when over budget) */
    public static Mood fromLeftPercent(BigDecimal leftPercent) {
        if (leftPercent.compareTo(PLAYFUL_ABOVE) > 0) {
            return PLAYFUL;
        }
        if (leftPercent.compareTo(CALM_FROM) >= 0) {
            return CALM;
        }
        return FIRM;
    }
}

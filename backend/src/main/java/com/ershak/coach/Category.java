package com.ershak.coach;

/**
 * A spending category such as "Bills" or "Outings".
 * Built-in categories have no owner ({@code userId == null}); users can add their own.
 * {@code essential} decides whether spending here counts as a need or a want.
 */
public record Category(long id, Long userId, String code, String nameAr, String nameEn,
                       String icon, String color, boolean essential, int sortOrder) {

    public boolean builtIn() {
        return userId == null;
    }
}

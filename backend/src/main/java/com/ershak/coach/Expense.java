package com.ershak.coach;

import java.math.BigDecimal;

/** One thing the user spent money on. Times are epoch milliseconds. */
public record Expense(long id, long userId, long categoryId, BigDecimal amount, String note,
                      String merchant, ExpenseSource source, long spentAt, long createdAt) {
}

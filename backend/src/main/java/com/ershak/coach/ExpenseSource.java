package com.ershak.coach;

/** Where an expense came from. */
public enum ExpenseSource {
    /** Typed by the user. */
    MANUAL,
    /** Read from a photo of a receipt. */
    RECEIPT,
    /** Read from a bank SMS. */
    SMS,
    /** Created from a payment made inside Ershak. */
    BANK
}

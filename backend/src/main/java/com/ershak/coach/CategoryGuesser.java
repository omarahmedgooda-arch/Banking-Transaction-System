package com.ershak.coach;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Guesses a built-in category code from a merchant name or a note, using keyword lists of
 * common Egyptian shops, apps and services. Returns "other" when nothing matches.
 */
public final class CategoryGuesser {

    private static final Map<String, List<String>> KEYWORDS = new LinkedHashMap<>();

    static {
        KEYWORDS.put("subscriptions", List.of("netflix", "shahid", "شاهد", "spotify", "anghami", "أنغامي", "انغامي",
                "osn", "watch it", "watchit", "youtube", "icloud", "google one", "chatgpt", "اشتراك"));
        KEYWORDS.put("charity", List.of("resala", "رسالة", "مصر الخير", "بنك الطعام", "food bank", "57357",
                "magdi yacoub", "مجدي يعقوب", "orman", "الأورمان", "الاورمان", "صدقة", "زكاة", "zakat"));
        KEYWORDS.put("rent", List.of("rent", "إيجار", "ايجار"));
        KEYWORDS.put("bills", List.of("electric", "كهرب", "water", "مياه", "gas", "غاز", "vodafone", "فودافون",
                "orange", "أورنج", "اورنج", "etisalat", "اتصالات", "e&", "telecom egypt", " we ", "internet", "انترنت", "إنترنت",
                "فاتورة", "فاتوره", "bill"));
        KEYWORDS.put("transport", List.of("uber", "اوبر", "أوبر", "careem", "indrive", "didi", "swvl",
                "بنزين", "petrol", "fuel", "wataniya", "وطنية", "totalenergies", "mobil", "shell", "chillout", "مترو", "metro ticket"));
        KEYWORDS.put("groceries", List.of("carrefour", "كارفور", "spinneys", "سبينيس", "seoudi", "سعودي", "hyper",
                "metro market", "مترو ماركت", "kazyon", "كازيون", "oscar", "gourmet", "breadfast", "talabat mart",
                "خضار", "فاكهة", "بقالة", "سوبر ماركت", "supermarket", "market"));
        KEYWORDS.put("outings", List.of("talabat", "طلبات", "elmenus", "mcdonald", "ماكدونالدز", "kfc", "starbucks",
                "ستاربكس", "cilantro", "costa", "cafe", "café", "كافيه", "قهوة", "coffee", "مطعم", "restaurant",
                "cinema", "سينما", "vox", "pizza", "بيتزا", "burger", "برجر"));
        KEYWORDS.put("health", List.of("pharmacy", "صيدلية", "صيدليه", "seif", "سيف", "ezaby", "العزبي", "hospital",
                "مستشفى", "clinic", "عيادة", "دكتور", " lab ", "معمل", "دوا", "دواء"));
        KEYWORDS.put("education", List.of("school", "مدرسة", "university", "جامعة", "course", "كورس", "udemy",
                "coursera", "book", "كتاب", "دروس", "درس"));
        KEYWORDS.put("clothes", List.of("zara", "h&m", "defacto", "lc waikiki", "waikiki", "max fashion", "town team",
                "adidas", "nike", "ملابس", "هدوم", "جزمة", "shoes"));
        KEYWORDS.put("electronics", List.of("b.tech", "btech", "بي تك", "2b", "raya", "راية", "samsung", "xiaomi",
                "apple store", "شاحن", "موبايل", "لابتوب"));
        KEYWORDS.put("gifts", List.of("gift", "هدية", "هديه", "flowers", "ورد", "عيدية"));
    }

    private CategoryGuesser() {
    }

    public static String guess(String... texts) {
        StringBuilder all = new StringBuilder(" ");
        for (String t : texts) {
            if (t != null) {
                all.append(t.toLowerCase(Locale.ROOT)).append(' ');
            }
        }
        String hay = all.toString();
        for (Map.Entry<String, List<String>> e : KEYWORDS.entrySet()) {
            for (String word : e.getValue()) {
                if (hay.contains(word)) {
                    return e.getKey();
                }
            }
        }
        return "other";
    }
}

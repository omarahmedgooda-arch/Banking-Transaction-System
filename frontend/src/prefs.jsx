import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Per-device preferences: language, theme, reminders. Stored locally, never sent to the server.
const KEY = 'ershak.prefs';
const defaults = {
  lang: 'ar',
  theme: 'system',
  onboarded: false,
  setupDone: false,
  reminder: { daily: true, time: '21:00', weekly: true, weeklyDay: 'fri', budget: true, goals: true, quietFrom: '00:00', quietTo: '08:00' },
};

function load() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return defaults;
  }
}

const dict = {
  ar: {
    home: 'الرئيسية', expenses: 'المصاريف', goals: 'الأهداف', ershak: 'قرشك', add: 'سجّل مصروف',
    greetMorning: 'صباح الخير يا', greetEvening: 'مساء الخير يا',
    leftThisMonth: 'فاضل من ميزانية الشهر', of: 'من', daysLeft: 'يوم فاضل',
    setBudget: 'حط ميزانية الشهر', setBudgetHint: 'قرشك محتاج يعرف ميزانيتك علشان ينصحك صح.',
    today: 'النهارده', yesterday: 'امبارح', todayNone: 'لسه مسجلتش حاجة النهارده', logNow: 'سجّل',
    todaySome: (n, a) => `سجلت ${n} مصاريف النهارده بـ ${a}`,
    topSpending: 'أكتر حاجات بتصرف فيها', all: 'الكل', essential: 'أساسي', nonEssential: 'مش أساسي',
    myAccounts: 'حساباتي', open: 'افتح', nearestGoal: 'أقرب هدف', noGoal: 'عايز تحوش لإيه؟ اعمل هدف',
    welcomeTitle: 'أهلًا بيك في قرشك', welcomeBody: 'سجّل أول مصروف وأنا هبدأ أفهم فلوسك بتروح فين.', firstExpense: 'سجّل أول مصروف',
    manual: 'يدوي', receipt: 'صورة فاتورة', sms: 'من رسالة', amount: 'المبلغ', category: 'البند', allCategories: 'كل البنود',
    note: 'ملاحظة (اختياري)', date: 'التاريخ', save: 'سجّل المصروف', saved: 'اتسجل', undo: 'تراجع', likeYesterday: 'زي امبارح',
    enterAmount: 'اكتب المبلغ', chooseCategory: 'اختار البند',
    pasteSms: 'الصق رسالة البنك هنا', readSms: 'اقرا الرسالة', smsIncome: 'دي فلوس داخلة، مش مصروف.', smsNone: 'مش لاقي مبلغ في الرسالة دي.',
    receiptSoon: 'قراية الفواتير بالذكاء الاصطناعي جاية في التحديث الجاي. لحد ما تيجي، اكتب الإجمالي بإيدك.',
    privacy: 'الصورة بتتقري وبتتمسح، ومش بنحفظها.',
    takePhoto: 'صوّر الفاتورة', fromGallery: 'اختار من الصور', reading: 'قرشك بيقرا الفاتورة…', receiptFail: 'مش لاقي إجمالي في الصورة دي. اكتبه بإيدك.',
    receiptItems: (n) => `قريت ${n} أصناف`,
    list: 'القايمة', insights: 'التحليل', search: 'دوّر في المصاريف', noExpenses: 'مفيش مصاريف الشهر ده', total: 'الإجمالي',
    edit: 'تعديل', delete: 'مسح', deleted: 'اتمسح', confirmDelete: 'متأكد إنك عايز تمسح المصروف ده؟', cancel: 'إلغاء', yes: 'أيوه',
    spentOfBudget: 'صرفت من الميزانية', personality: 'شخصيتك المالية', weekly: 'الصرف كل أسبوع', byCategory: 'البنود',
    noticed: 'قرشك لاحظ', vsLast: 'مقارنة بالشهر اللي فات', lastMonth: 'الشهر اللي فات', thisMonth: 'الشهر ده',
    week: 'أسبوع', budget: 'الميزانية', monthlyBudget: 'ميزانيتك الشهرية', budgetSaved: 'الميزانية اتحفظت',
    plan: 'خطة قرشك', neededMonth: 'محتاج في الشهر', savingNow: 'بتحوش دلوقتي', gap: 'الفرق', cutIn: 'قلل في', perMonth: 'في الشهر',
    zakat: 'حاسبة الزكاة', zakatHint: 'احسب زكاة فلوسك ودهبك في دقيقة.',
    chatTitle: 'اسأل قرشك', chatPlaceholder: 'اكتب لقرشك…', send: 'ابعت',
    settings: 'الإعدادات', language: 'اللغة', theme: 'الشكل', themeSystem: 'زي الموبايل', themeLight: 'فاتح', themeDark: 'غامق',
    reminders: 'التذكيرات', dailyReminder: 'تذكير يومي: صرفت كام النهارده؟', weeklySummary: 'ملخص الأسبوع', budgetAlerts: 'تنبيهات الميزانية',
    goalNudges: 'فكرة الأهداف', quietHours: 'ساعات الهدوء', from: 'من', to: 'لـ', account: 'الحساب والأمان', logout: 'خروج',
    notifications: 'الإشعارات', enableNotif: 'فعّل الإشعارات', notifDenied: 'الإشعارات مقفولة من المتصفح. افتحها من إعدادات الموبايل.',
    next: 'التالي', skip: 'تخطي', start: 'ابدأ', haveAccount: 'عندي حساب', letsGo: 'يلا بينا', back: 'رجوع',
    loading: 'بيحمّل…', retry: 'جرّب تاني', egp: 'ج.م',
  },
  en: {
    home: 'Home', expenses: 'Expenses', goals: 'Goals', ershak: 'Ershak', add: 'Add expense',
    greetMorning: 'Good morning,', greetEvening: 'Good evening,',
    leftThisMonth: 'Left of this month’s budget', of: 'of', daysLeft: 'days left',
    setBudget: 'Set this month’s budget', setBudgetHint: 'Ershak needs your budget to give you good advice.',
    today: 'Today', yesterday: 'Yesterday', todayNone: 'Nothing logged today yet', logNow: 'Log',
    todaySome: (n, a) => `${n} expenses today · ${a}`,
    topSpending: 'Where your money goes', all: 'All', essential: 'Essential', nonEssential: 'Non-essential',
    myAccounts: 'My accounts', open: 'Open', nearestGoal: 'Closest goal', noGoal: 'Saving for something? Create a goal',
    welcomeTitle: 'Welcome to Ershak', welcomeBody: 'Log your first expense and I’ll start learning where your money goes.', firstExpense: 'Log first expense',
    manual: 'Manual', receipt: 'Receipt', sms: 'Bank SMS', amount: 'Amount', category: 'Category', allCategories: 'All categories',
    note: 'Note (optional)', date: 'Date', save: 'Save expense', saved: 'Saved', undo: 'Undo', likeYesterday: 'Same as before',
    enterAmount: 'Enter an amount', chooseCategory: 'Pick a category',
    pasteSms: 'Paste your bank SMS here', readSms: 'Read message', smsIncome: 'That’s money coming in, not an expense.', smsNone: 'No amount found in this message.',
    receiptSoon: 'AI receipt reading is coming in the next update. For now, type the total.',
    privacy: 'Photos are read and deleted. We never keep them.',
    takePhoto: 'Take a photo', fromGallery: 'Choose from gallery', reading: 'Reading your receipt…', receiptFail: 'No total found on this photo. Type it instead.',
    receiptItems: (n) => `${n} items read`,
    list: 'List', insights: 'Insights', search: 'Search expenses', noExpenses: 'No expenses this month', total: 'Total',
    edit: 'Edit', delete: 'Delete', deleted: 'Deleted', confirmDelete: 'Delete this expense?', cancel: 'Cancel', yes: 'Yes',
    spentOfBudget: 'Spent of budget', personality: 'Your money personality', weekly: 'Spending by week', byCategory: 'Categories',
    noticed: 'Ershak noticed', vsLast: 'Compared with last month', lastMonth: 'Last month', thisMonth: 'This month',
    week: 'Week', budget: 'Budget', monthlyBudget: 'Your monthly budget', budgetSaved: 'Budget saved',
    plan: 'Ershak’s plan', neededMonth: 'Needed per month', savingNow: 'Saving now', gap: 'Gap', cutIn: 'Cut', perMonth: 'per month',
    zakat: 'Zakat calculator', zakatHint: 'Work out zakat on your savings and gold in a minute.',
    chatTitle: 'Ask Ershak', chatPlaceholder: 'Message Ershak…', send: 'Send',
    settings: 'Settings', language: 'Language', theme: 'Theme', themeSystem: 'System', themeLight: 'Light', themeDark: 'Dark',
    reminders: 'Reminders', dailyReminder: 'Daily: how much did you spend today?', weeklySummary: 'Weekly summary', budgetAlerts: 'Budget alerts',
    goalNudges: 'Goal nudges', quietHours: 'Quiet hours', from: 'From', to: 'to', account: 'Account & security', logout: 'Log out',
    notifications: 'Notifications', enableNotif: 'Turn on notifications', notifDenied: 'Notifications are blocked. Turn them on in your phone settings.',
    next: 'Next', skip: 'Skip', start: 'Get started', haveAccount: 'I have an account', letsGo: 'Let’s go', back: 'Back',
    loading: 'Loading…', retry: 'Try again', egp: 'EGP',
  },
};

const PrefsContext = createContext(null);

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(load);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const on = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
  }, [prefs]);

  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && systemDark);
  useEffect(() => {
    const el = document.documentElement;
    el.lang = prefs.lang;
    el.dir = prefs.lang === 'ar' ? 'rtl' : 'ltr';
    el.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0D1220' : '#F5F4F0');
  }, [prefs.lang, dark]);

  const update = useCallback((patch) => setPrefs((p) => ({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) })), []);
  const t = useCallback((k, ...args) => {
    const v = dict[prefs.lang][k] ?? dict.ar[k] ?? k;
    return typeof v === 'function' ? v(...args) : v;
  }, [prefs.lang]);

  const value = useMemo(() => ({ prefs, update, t, lang: prefs.lang, dark, ar: prefs.lang === 'ar' }), [prefs, update, t, dark]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);

/** Inline translation for one-off strings: L('Log in', 'دخول'). */
export function useL() {
  const { ar } = usePrefs();
  return (en, a) => (ar ? a : en);
}
export const isArDoc = () => document.documentElement.lang === 'ar';

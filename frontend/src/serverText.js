// Arabic for the English texts the server sends: error messages, transaction titles,
// notifications and Fraud Guard reasons. English stays as the server wrote it.
const ar = () => document.documentElement.lang === 'ar';

const EXACT = {
  // sign-in and session
  'Enter your username and password.': 'اكتب اسم المستخدم والباسورد.',
  'Log in to continue.': 'سجّل دخول علشان تكمّل.',
  'Your session expired. Log in again.': 'الجلسة خلصت. سجّل دخول تاني.',
  'Too many wrong attempts. Your account is locked for your safety.': 'محاولات غلط كتير. قفلنا الدخول علشان أمانك.',
  "You don't have permission to do this.": 'مش مسموحلك تعمل ده.',
  'Too many requests. Wait a minute and try again.': 'طلبات كتير. استنى دقيقة وجرّب تاني.',
  "Can't reach the server. Check your connection.": 'مش قادرين نوصل للسيرفر. اتأكد من النت.',
  'Something went wrong. Try again.': 'حصلت مشكلة. جرّب تاني.',
  'Something went wrong on our side. Try again.': 'حصلت مشكلة عندنا. جرّب تاني.',
  // registration and profile
  'An account with this email already exists.': 'فيه حساب بالإيميل ده قبل كده.',
  'An account with this phone number already exists.': 'فيه حساب برقم الموبايل ده قبل كده.',
  'That username is already taken. Try another.': 'اسم المستخدم ده محجوز. جرّب اسم تاني.',
  'Username must be 3-30 letters, numbers, dots or underscores.': 'اسم المستخدم من 3 لـ 30 حرف أو رقم أو نقطة أو _.',
  'Enter a valid Egyptian mobile number, like 01012345678.': 'اكتب رقم موبايل مصري صحيح، زي 01012345678.',
  'Enter a valid email address.': 'اكتب إيميل صحيح.',
  'Your current password is not correct.': 'الباسورد الحالي غلط.',
  'Choose a password different from the current one.': 'اختار باسورد مختلف عن الحالي.',
  // money
  'Enter an amount.': 'اكتب المبلغ.',
  'Amount must be greater than zero.': 'المبلغ لازم يكون أكبر من صفر.',
  'Amount can have at most 2 decimals.': 'المبلغ ميزيدش عن رقمين بعد العلامة.',
  "You can't transfer to the same account.": 'مينفعش تحوّل لنفس الحساب.',
  "The recipient account can't receive money now.": 'الحساب اللي هتحوّله مش بيستقبل فلوس دلوقتي.',
  "Enter the recipient's account number.": 'اكتب رقم حساب اللي هتحوّله.',
  'This account is closed.': 'الحساب ده مقفول.',
  'Choose Savings or Current.': 'اختار توفير أو جاري.',
  'Choose SAVINGS or CURRENT.': 'اختار توفير أو جاري.',
  'This transaction was already handled.': 'العملية دي اتعاملت قبل كده.',
  'Only a transaction on hold can be cancelled.': 'تقدر تلغي بس عملية متوقفة.',
  "This transaction isn't waiting for a code.": 'العملية دي مش مستنية كود.',
  'Wrong code 3 times. We cancelled the transfer to keep you safe.': 'كتبت الكود غلط 3 مرات، فلغينا التحويل علشان أمانك.',
  // goals
  'Move the money back to your account before deleting the goal.': 'رجّع الفلوس لحسابك الأول قبل ما تمسح الهدف.',
  'This goal is empty.': 'الهدف ده فاضي.',
  'Give the goal a name up to 40 characters.': 'سمّي الهدف بحد أقصى 40 حرف.',
  "The target date can't be in the past.": 'الميعاد مينفعش يكون فات.',
  // coach
  'That amount is too large for one expense.': 'المبلغ ده كبير أوي على مصروف واحد.',
  'That budget is too large.': 'الميزانية دي كبيرة أوي.',
  "The date can't be in the future.": 'التاريخ مينفعش يكون في المستقبل.',
  'Dates must look like 2026-11-23.': 'التاريخ لازم يكون بالشكل ده: 2026-11-23.',
  'Months must look like 2026-11.': 'الشهر لازم يكون بالشكل ده: 2026-11.',
  'Give the category a name up to 30 characters.': 'سمّي البند بحد أقصى 30 حرف.',
  'This category has expenses. Move them to another category first.': 'البند ده فيه مصاريف. انقلها لبند تاني الأول.',
  "Couldn't find an amount in this message.": 'مش لاقي مبلغ في الرسالة دي.',
  'Times must look like 21:00.': 'الوقت لازم يكون بالشكل ده: 21:00.',
  'Pick a day of the week.': 'اختار يوم في الأسبوع.',
  // AI
  "Ershak's AI isn't set up on this server.": 'الذكاء الاصطناعي مش متفعّل على السيرفر ده.',
  "Ershak's AI is busy right now. Try again in a minute.": 'الذكاء الاصطناعي مشغول دلوقتي. جرّب كمان دقيقة.',
  "You've reached today's limit. Try again tomorrow.": 'خلصت حد النهارده. جرّب بكرة.',
  "Couldn't find a total on this photo. Type it instead.": 'مش لاقي إجمالي في الصورة دي. اكتبه بإيدك.',
  'Add a photo of the receipt.': 'ضيف صورة الفاتورة.',
  'Use a JPG, PNG or WebP photo.': 'استخدم صورة JPG أو PNG أو WebP.',
  'The photo could not be read.': 'مقدرناش نقرا الصورة.',
  'The photo is too large. Try a smaller one.': 'الصورة كبيرة أوي. جرّب واحدة أصغر.',
  'Write a message.': 'اكتب رسالة.',
  // transaction titles
  'Cash withdrawal': 'سحب كاش',
  'Cash deposit': 'إيداع كاش',
  'Opening deposit': 'أول إيداع',
  'Monthly interest': 'فوايد (قديم)',
  'Transfer': 'تحويل',
  'November salary': 'مرتب نوفمبر',
  'Lunch': 'غدا',
  // notification titles
  'Welcome to Ershak': 'أهلًا بيك في قرشك',
  'Transfer approved': 'التحويل اتوافق عليه',
  'Transfer failed': 'التحويل متمش',
  'Transfer stopped': 'التحويل اتوقف',
  'Login unlocked': 'الدخول اتفتح',
  'A bank officer unlocked your login.': 'موظف البنك فتحلك الدخول.',
  'Account frozen': 'الحساب اتجمّد',
  'Account active again': 'الحساب رجع يشتغل',
  'Account opened': 'الحساب اتفتح',
  'Money received': 'وصلتلك فلوس',
  'Customer reported fraud': 'عميل بلّغ عن احتيال',
  // admin and OTP results
  'Password changed.': 'الباسورد اتغيّر.',
  'Account closed.': 'الحساب اتقفل.',
  'Approved. The money was sent.': 'اتوافق. الفلوس اتبعتت.',
  'Rejected. The money is back with the customer.': 'اترفض. الفلوس رجعت للعميل.',
  'Login locked.': 'الدخول اتقفل.',
  'Login unlocked.': 'الدخول اتفتح.',
  'Account frozen.': 'الحساب اتجمّد.',
  'Account active again.': 'الحساب رجع يشتغل.',
  'Chain intact. Nobody changed the records.': 'السلسلة سليمة. محدش غيّر في السجلات.',
  'The code expired. The transfer was cancelled and nothing left your account.': 'الكود انتهى. التحويل اتلغى ومفيش فلوس خرجت من حسابك.',
  'Confirmed. Money sent.': 'اتأكد. الفلوس اتبعتت.',
  // rule descriptions
  'Takes nearly the whole account balance': 'بياخد رصيد الحساب تقريبًا كله',
  'Large amount sent late at night': 'مبلغ كبير متبعت بالليل متأخر',
  "Uses most of today's remaining limit": 'بيستخدم أغلب الحد اللي فاضل النهارده',
  'Large first transfer to a new account': 'أول تحويل كبير لحساب جديد',
  'Many outgoing transactions in a few minutes': 'عمليات خروج كتير في دقايق قليلة',
  "Amount is much bigger than the customer's 30-day average": 'المبلغ أكبر بكتير من متوسط العميل في آخر 30 يوم',
  // Fraud Guard reasons
  'Empties almost your whole balance': 'بيفضّي رصيدك تقريبًا كله',
  'Close to your daily limit': 'قريب من حدك اليومي',
  'First transfer to this account': 'أول تحويل للحساب ده',
};

const PATTERNS = [
  [/^(.+) not found\.$/, (m) => `${({ Account: 'الحساب', 'Recipient account': 'حساب المستلم', Transaction: 'العملية', Goal: 'الهدف', Expense: 'المصروف', Category: 'البند', Customer: 'العميل', User: 'المستخدم', Code: 'الكود' })[m[1]] || m[1]} مش موجود.`],
  [/^Not enough balance\. Available: (.+)$/, (m) => `الرصيد مش كفاية. المتاح: ${m[1]}`],
  [/^Account (.+) is (frozen|closed)(.*)$/, (m) => `الحساب ${m[1]} ${m[2] === 'frozen' ? 'متجمّد' : 'مقفول'}.`],
  [/^Daily (withdrawal|transfer) limit is (.+?)\.(.*)$/, (m) => `حد ${m[1] === 'withdrawal' ? 'السحب' : 'التحويل'} اليومي ${m[2]}.`],
  [/^Savings accounts allow (\d+)(.*)$/, (m) => `حساب التوفير مسموحله ${m[1]} عمليات خروج بس في الشهر.`],
  [/^A single deposit can't be more than (.+)\.$/, (m) => `الإيداع الواحد ميزيدش عن ${m[1]}.`],
  [/^(.+) is required\.$/, () => 'فيه خانة مطلوبة فاضية.'],
  [/^(.+) must be a (whole )?number\.$/, () => 'فيه خانة لازم يتكتب فيها رقم.'],
  [/^The (.+) can be up to (\d+) characters\.$/, (m) => `الخانة دي بحد أقصى ${m[2]} حرف.`],
  [/^Wrong code\. (\d+) tr(y|ies) left\.$/, (m) => `الكود غلط. فاضلك ${m[1]} محاولات.`],
  [/^Entry #(\d+) was changed or a record before it was removed\.$/, (m) => `السجل رقم ${m[1]} اتغيّر، أو فيه سجل قبله اتمسح.`],
  // transaction titles
  [/^Saved to goal: (.+)$/, (m) => `اتحوّش في هدف: ${m[1]}`],
  [/^Moved from goal: (.+)$/, (m) => `اترجّع من هدف: ${m[1]}`],
  // notification messages
  [/^You reached your goal "(.+)": (.+)\.$/, (m) => `وصلت لهدف "${m[1]}": ${m[2]}.`],
  [/^Open your first account to start\.(.*)$/, (m) => `افتح أول حساب علشان تبدأ.${m[1]}`],
  [/^Someone typed your password wrong (\d+) times\. We locked your login for (\d+) minutes\.$/, (m) => `حد كتب الباسورد بتاعك غلط ${m[1]} مرات، فقفلنا الدخول ${m[2]} دقيقة.`],
  [/^A bank officer approved (\S+)\. (.+) was sent\.$/, (m) => `موظف البنك وافق على ${m[1]}، و${m[2]} اتبعتوا.`],
  [/^(\S+) couldn't be completed\. The held money is back in your account\.$/, (m) => `${m[1]} متمش، والفلوس المحجوزة رجعت لحسابك.`],
  [/^A bank officer stopped (\S+)\. (.+) is free in your account again\.$/, (m) => `موظف البنك وقّف ${m[1]}، و${m[2]} رجعوا متاحين في حسابك.`],
  [/^(.+) is frozen\. Contact the bank for help\.$/, (m) => `${m[1]} اتجمّد. كلّم البنك علشان يساعدك.`],
  [/^(.+) can be used again\.$/, (m) => `${m[1]} رجع يشتغل.`],
  [/^Your (savings|current) account (.+) is ready\.$/, (m) => `حساب ${m[1] === 'savings' ? 'التوفير' : 'الجاري'} ${m[2]} جاهز.`],
  [/^We cancelled (\S+) after 3 wrong codes\.(.*)$/, (m) => `لغينا ${m[1]} بعد 3 أكواد غلط. لو مش إنت، غيّر الباسورد.`],
  [/^We froze (.+)\. Call the bank to unfreeze it\.$/, (m) => `جمّدنا ${m[1]}. كلّم البنك علشان تفكّه.`],
  [/^We paused (\S+) \((.+)\) until a bank officer reviews it\.(.*)$/, (m) => `وقفنا ${m[1]} (${m[2]}) لحد ما موظف البنك يراجعه. فلوسك محجوزة، مش متبعتة.`],
  [/^(.+) arrived in (.+)\.$/, (m) => `${m[1]} وصلوا ${m[2]}.`],
  // Fraud Guard reasons with numbers
  [/^Sent at (.+)$/, (m) => `اتبعت الساعة ${m[1]}`],
  [/^(\d+) transactions in (\d+) minutes$/, (m) => `${m[1]} عمليات في ${m[2]} دقايق`],
  [/^(.+)× bigger than your usual transfer$/, (m) => `أكبر ${m[1]} مرات من تحويلك المعتاد`],
];

/** The Arabic version of a server text when the app is in Arabic; otherwise the text unchanged. */
export function localize(text) {
  if (!text || !ar()) return text;
  if (EXACT[text]) return EXACT[text];
  for (const [re, fn] of PATTERNS) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return text;
}

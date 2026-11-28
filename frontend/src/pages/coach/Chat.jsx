import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, SendHorizontal, X } from 'lucide-react';
import { get, post, put } from '../../api';
import { CatIcon, money, monthKey, todayIso, useCatName, useQuickAdd } from '../../coach';
import { Sparkles, Target, Wallet } from 'lucide-react';
import { usePrefs } from '../../prefs';

// Built-in Ershak replies. The AI agent (Gemini) plugs in behind the same screen later;
// until then these rules answer the common questions and never move money.
const digits = (s) => s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const KEYWORDS = [
  ['outings', ['قهوة', 'قهوه', 'كافيه', 'كافية', 'كوفي', 'coffee', 'cafe', 'خروج', 'سينما', 'مطعم', 'أكل برا', 'اكل برا']],
  ['transport', ['مواصلات', 'اوبر', 'أوبر', 'uber', 'بنزين', 'تاكسي', 'مترو', 'ميكروباص', 'كريم', 'careem', 'fuel']],
  ['groceries', ['بقالة', 'بقاله', 'سوبر ماركت', 'خضار', 'فاكهة', 'عيش', 'groceries', 'كارفور', 'carrefour']],
  ['bills', ['كهربا', 'كهرباء', 'مية', 'مياه', 'غاز', 'نت', 'انترنت', 'فاتورة', 'رصيد', 'bill']],
  ['health', ['دوا', 'دواء', 'صيدلية', 'دكتور', 'كشف', 'pharmacy']],
  ['clothes', ['هدوم', 'لبس', 'جزمة', 'قميص', 'clothes']],
  ['subscriptions', ['اشتراك', 'نتفليكس', 'netflix', 'سبوتيفاي', 'spotify', 'شاهد', 'جيم', 'gym']],
  ['charity', ['صدقة', 'زكاة', 'تبرع']],
  ['gifts', ['هدية', 'هديه', 'gift']],
  ['education', ['دروس', 'مدرسة', 'كورس', 'كتب', 'course']],
];
const guessCode = (s) => KEYWORDS.find(([, ws]) => ws.some((w) => s.includes(w)))?.[0] || 'other';

function parseExpenses(text) {
  const s = digits(text).replace(/^(انا\s+|أنا\s+)?(صرفت|سجل|سجّل|دفعت)\s*/, '');
  const out = [];
  // "200 قهوة و50 مواصلات، 30 عيش" → one item per number
  for (const part of s.split(/\s+و\s*(?=\d)|،|,|\+|\n/)) {
    const m = part.match(/(\d+(?:\.\d+)?)\s*(?:جنيه|جنية|ج\.م|ج|egp|le)?\s*(.*)/i);
    if (!m) continue;
    const amount = Number(m[1]);
    const label = (m[2] || '').replace(/^(على|علي|في|ل|عل)\s+/, '').trim().slice(0, 40);
    if (amount > 0) out.push({ amount, label, code: guessCode(label || part) });
  }
  return out;
}

export default function Chat() {
  const { t, ar } = usePrefs();
  const catName = useCatName();
  const { changed } = useQuickAdd();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [cats, setCats] = useState([]);
  const [ov, setOv] = useState(null);
  const [ai, setAi] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    get('/api/coach/categories').then(setCats).catch(() => {});
    get('/api/coach/ai').then((r) => setAi(!!r.enabled)).catch(() => {});
    get('/api/coach/overview').then((o) => {
      setOv(o);
      setMsgs([{ who: 'bot', text: o.message }]);
    }).catch(() => setMsgs([{ who: 'bot', text: 'أهلًا! أنا قرشك. اسألني صرفت كام، أو قولي صرفت إيه وأنا أسجّله.' }]));
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, typing]);

  const say = (m) => setMsgs((xs) => [...xs, m]);

  const reply = async (q) => {
    const s = digits(q.toLowerCase());
    if (/(حول|حوّل|تحويل|ابعت فلوس|transfer|send money)/.test(s)) {
      return say({ who: 'bot', text: 'أنا مبحرّكش فلوس خالص، ده علشان أمانك. التحويل من شاشة حساباتي وعليه Fraud Guard.', link: { to: '/transfer', label: 'افتح التحويل' } });
    }
    if (/(زكا)/.test(s)) return say({ who: 'bot', text: 'تعالى نحسبها سوا في دقيقة.', link: { to: '/zakat', label: t('zakat') } });
    if (/(صرفت|سجل|سجّل|دفعت)/.test(s) && /\d/.test(s)) {
      const items = parseExpenses(q);
      if (items.length) {
        return say({
          who: 'bot', text: items.length > 1 ? `هسجّل ${items.length} مصاريف، أكّد كل واحد:` : 'أكّد وأنا أسجّله:',
          confirms: items.map((it) => ({ ...it, category: cats.find((c) => c.code === it.code) || cats.find((c) => c.code === 'other'), state: 'pending' })),
        });
      }
    }
    if (/(قلل|اقلل|أقلل|اوفر|أوفر|وفر|save|cut)/.test(s)) {
      const o = await get('/api/coach/overview');
      const wants = o.categories.filter((c) => !c.category.essential).slice(0, 3);
      if (!wants.length) return say({ who: 'bot', text: 'مصاريفك كلها أساسية الشهر ده. برافو عليك!' });
      const lines = wants.map((c) => `• ${c.category.nameAr}: ${money(c.total)} ← لو قللتها النص توفر ${money(Number(c.total) / 2)}`);
      return say({ who: 'bot', text: `أكتر حاجات مش أساسية الشهر ده:\n${lines.join('\n')}` });
    }
    if (/(صرفت كام|كام صرفت|فاضل|ميزاني|budget|spent|left)/.test(s)) {
      const o = await get('/api/coach/overview');
      setOv(o);
      const top = o.categories[0];
      return say({ who: 'bot', text: `صرفت ${money(o.spent)} من ${money(o.budget)}، وفاضلك ${money(o.left)} لـ ${o.daysLeft} يوم.${top ? `\nأكبر بند: ${top.category.nameAr} (${money(top.total)}).` : ''}\n${o.message}` });
    }
    if (/(النهارده|today)/.test(s)) {
      const xs = await get('/api/coach/expenses');
      const k = todayIso();
      const td = xs.filter((e) => new Date(e.spentAt).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }) === k);
      return say({ who: 'bot', text: td.length ? `النهارده سجلت ${td.length} مصاريف بـ ${money(td.reduce((a, e) => a + Number(e.amount), 0))}.` : 'لسه مسجلتش حاجة النهارده. قولي صرفت إيه.' });
    }
    if (/(شخصي|personality)/.test(s)) {
      const ins = await get('/api/coach/insights');
      return say({ who: 'bot', text: ins.personality ? `${ins.personality.title}\n${ins.personality.description}` : 'سجّل أسبوع مصاريف وهقولك شخصيتك.' });
    }
    return say({ who: 'bot', text: 'لسه بتعلم 😅 جرّب تسألني:\n• صرفت كام الشهر ده؟\n• أقلل في إيه؟\n• صرفت 200 قهوة و50 مواصلات\n• حاسبلي زكاتي' });
  };

  // Ask the AI agent. Returns false when it isn't available, so the built-in replies take over.
  const aiReply = async (v) => {
    const history = [...msgs, { who: 'me', text: v }].filter((m) => m.text).slice(-12)
      .map((m) => ({ role: m.who === 'me' ? 'user' : 'assistant', text: m.text }));
    try {
      const r = await post('/api/coach/chat', { messages: history });
      const confirms = r.actions.map((a) => (a.type === 'add_expense'
        ? { kind: 'expense', amount: Number(a.amount), label: a.note || '', category: cats.find((c) => c.code === a.categoryCode) || cats.find((c) => c.code === 'other'), state: 'pending' }
        : a.type === 'set_budget' ? { kind: 'budget', amount: Number(a.amount), state: 'pending' }
          : { kind: 'goal', amount: Number(a.amount), label: a.name, date: a.date, state: 'pending' }));
      say({ who: 'bot', text: r.reply, confirms: confirms.length ? confirms : undefined, ai: true });
      return true;
    } catch (e) {
      if (e.code === 'AI_OFF') setAi(false);
      if (e.code === 'AI_LIMIT') { say({ who: 'bot', text: 'خلصت رسايل النهارده مع الذكاء الاصطناعي. هرد عليك بالردود الجاهزة لحد بكرة.' }); }
      return false;
    }
  };

  const send = async (q = text) => {
    const v = q.trim();
    if (!v || typing) return;
    setText('');
    say({ who: 'me', text: v });
    setTyping(true);
    try {
      if (ai && !(await aiReply(v))) await reply(v);
      else if (!ai) { await new Promise((r) => setTimeout(r, 400)); await reply(v); }
    } catch { say({ who: 'bot', text: 'حصلت مشكلة، جرّب تاني.' }); } finally { setTyping(false); }
  };

  const act = async (mi, ci, ok) => {
    const c = msgs[mi].confirms[ci];
    const setState = (state) => setMsgs((xs) => xs.map((m, i) => (i !== mi ? m : { ...m, confirms: m.confirms.map((x, j) => (j === ci ? { ...x, state } : x)) })));
    if (!ok) return setState('declined');
    try {
      if (c.kind === 'budget') {
        await put('/api/coach/budget', { month: monthKey(), amount: String(c.amount) });
      } else if (c.kind === 'goal') {
        const accounts = await get('/api/accounts');
        const acc = accounts.find((a) => a.type === 'SAVINGS' && a.status === 'ACTIVE') || accounts.find((a) => a.status === 'ACTIVE');
        if (!acc) throw new Error('محتاج تفتح حساب الأول علشان تعمل هدف.');
        await post('/api/goals', { name: c.label, targetAmount: String(c.amount), targetDate: c.date || '', accountId: acc.id });
      } else {
        const res = await post('/api/coach/expenses', { categoryId: c.category.id, amount: String(c.amount), note: c.label || null, source: 'MANUAL', date: todayIso() });
        res.alerts?.forEach((a) => say({ who: 'bot', text: a }));
      }
      setState('done');
      changed();
    } catch (e) {
      say({ who: 'bot', text: e.message });
    }
  };

  const chips = ['صرفت كام الشهر ده؟', 'أقلل في إيه؟', 'شخصيتي المالية', 'حاسبلي زكاتي'];

  return (
    <main className="page" style={{ gap: 12 }}>
      <div className="row">
        <img src="/ershak-coin2.png" alt="" className="coin" />
        <div>
          <h1 style={{ fontSize: 17 }}>{t('chatTitle')}</h1>
          <div className="row" style={{ gap: 6 }}>
            {ov && <span className={`mood ${ov.mood}`}>{ov.moodLabel}</span>}
            {ai && <span className="badge accent"><Sparkles size={11} /> AI</span>}
          </div>
        </div>
      </div>

      <div className="chat" aria-live="polite" dir="rtl">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.who}`}>
            {m.text}
            {m.link && <div style={{ marginTop: 8 }}><Link className="btn sm primary" to={m.link.to}>{m.link.label}</Link></div>}
            {m.confirms?.map((c, j) => (
              <div key={j} className="card tight stack" style={{ marginTop: 8, gap: 8, boxShadow: 'none' }}>
                <div className="row">
                  {c.kind === 'budget' ? <span className="tx-icon" style={{ width: 32, height: 32 }}><Wallet size={17} color="var(--primary-text)" /></span>
                    : c.kind === 'goal' ? <span className="tx-icon" style={{ width: 32, height: 32 }}><Target size={17} color="var(--copper)" /></span>
                      : <CatIcon category={c.category} size={32} />}
                  <div className="tx-main">
                    <p className="small" style={{ fontWeight: 700 }}>{c.kind === 'budget' ? 'ميزانية الشهر' : c.kind === 'goal' ? `هدف: ${c.label}` : (c.label || catName(c.category))}</p>
                    <p className="tiny muted">{c.kind === 'budget' ? 'تغيير الميزانية' : c.kind === 'goal' ? (c.date ? `قبل ${c.date}` : 'من غير ميعاد') : catName(c.category)}</p>
                  </div>
                  <span className="num" style={{ fontWeight: 700 }}>{money(c.amount)}</span>
                </div>
                {c.state === 'pending' && (
                  <div className="grid-2">
                    <button type="button" className="btn sm" onClick={() => act(i, j, false)}><X size={15} />لأ</button>
                    <button type="button" className="btn sm primary" onClick={() => act(i, j, true)}><Check size={15} />تمام</button>
                  </div>
                )}
                {c.state === 'done' && <p className="tiny good">✓ اتسجل</p>}
                {c.state === 'declined' && <p className="tiny muted">اتلغى</p>}
              </div>
            ))}
          </div>
        ))}
        {typing && <div className="msg bot typing" aria-label="typing"><span /><span /><span /></div>}
        <div ref={endRef} />
      </div>

      <div className="composer stack" style={{ gap: 8 }}>
        <div className="chips scroll" dir="rtl">
          {chips.map((c) => <button key={c} type="button" className="chip" onClick={() => send(c)}>{c}</button>)}
        </div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input className="input" dir="auto" placeholder={t('chatPlaceholder')} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
          <button className="icon-btn" style={{ background: 'var(--primary)', color: 'var(--on-primary)', borderColor: 'var(--primary)', width: 50, height: 50 }} aria-label={t('send')}>
            <SendHorizontal size={20} className={ar ? 'flip' : ''} />
          </button>
        </form>
      </div>
    </main>
  );
}

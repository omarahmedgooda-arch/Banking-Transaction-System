import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, PenLine, PiggyBank } from 'lucide-react';
import { usePrefs } from '../../prefs';

const slides = {
  ar: [
    { icon: PenLine, title: 'سجّل في ثانية', body: 'بإيدك، أو من صورة الفاتورة، أو من رسالة البنك.' },
    { icon: BarChart3, title: 'افهم فلوسك', body: 'هتعرف فلوسك بتروح فين، وإيه الأساسي وإيه لأ، وشخصيتك المالية.' },
    { icon: PiggyBank, title: 'حوّش لهدفك', body: 'قرشك يعملك خطة: تقلل في إيه وكام، من غير قروض ولا فوايد.' },
  ],
  en: [
    { icon: PenLine, title: 'Log in a second', body: 'By hand, from a receipt photo, or from your bank SMS.' },
    { icon: BarChart3, title: 'Understand your money', body: 'See where it goes, what’s essential, and your money personality.' },
    { icon: PiggyBank, title: 'Save for your goal', body: 'Ershak builds you a plan: what to cut and by how much. No loans, no interest.' },
  ],
};

export default function Onboarding() {
  const { t, lang, update } = usePrefs();
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const s = slides[lang][i];
  const done = (to) => { update({ onboarded: true }); navigate(to, { replace: true }); };

  return (
    <div className="auth" style={{ justifyContent: 'space-between' }}>
      <div className="between">
        <div className="seg" style={{ width: 140 }}>
          <button type="button" className={lang === 'ar' ? 'on' : ''} onClick={() => update({ lang: 'ar' })}>عربي</button>
          <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => update({ lang: 'en' })}>EN</button>
        </div>
        <button type="button" className="link-btn" onClick={() => done('/login')}>{t('skip')}</button>
      </div>
      <div className="stack-lg" style={{ alignItems: 'center', textAlign: 'center' }}
        onTouchStart={(e) => { e.currentTarget.dataset.x = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - Number(e.currentTarget.dataset.x);
          const fwd = lang === 'ar' ? dx > 50 : dx < -50; const bwd = lang === 'ar' ? dx < -50 : dx > 50;
          if (fwd && i < 2) setI(i + 1); if (bwd && i > 0) setI(i - 1);
        }}>
        <img src={document.documentElement.dataset.theme === 'dark' ? '/ershak-logo2-dark.png' : '/ershak-logo2.png'} alt="قرشك Ershak" className="logo-img" />
        <div className="illus"><s.icon size={72} strokeWidth={1.4} color="var(--copper)" /></div>
        <h1>{s.title}</h1>
        <p className="muted">{s.body}</p>
        <div className="dots">{[0, 1, 2].map((k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
      </div>
      <div className="stack">
        {i < 2 ? <button type="button" className="btn primary block" onClick={() => setI(i + 1)}>{t('next')}</button>
          : <button type="button" className="btn primary block" onClick={() => done('/register')}>{t('start')}</button>}
        <button type="button" className="btn ghost block" onClick={() => done('/login')}>{t('haveAccount')}</button>
      </div>
    </div>
  );
}

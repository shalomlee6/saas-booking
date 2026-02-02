import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClientAuth } from '../../public/clientAuth/ClientAuthContext';
import { requestOtp, verifyOtp } from '../../api/publicClient';

export const ClientOtpAuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const { loginWithToken } = useClientAuth();
  
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 9) {
      setError('אנא הכניסי מספר טלפון תקין');
      return;
    }
    if (!businessSlug) {
      setError('שגיאה: businessSlug חסר');
      return;
    }

    setError(null);
    setLoading(true);
    
    try {
      await requestOtp(businessSlug, phone);
      setStep('code');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'שגיאה בשליחת קוד');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setError('אנא הכניסי קוד בן 6 ספרות');
      return;
    }
    if (!businessSlug) {
      setError('שגיאה: businessSlug חסר');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await verifyOtp(businessSlug, phone, code);
      loginWithToken(result.token, result.customerId, result.businessId);
      navigate(`/public/${businessSlug}/book`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'קוד שגוי, נסי שוב');
      setLoading(false);
    }
  };

  return (
    <div className="otpAuth">
      <div className="otpAuth__card">
        <h2 className="otpAuth__title">התחברות</h2>
        
        {step === 'phone' ? (
          <form onSubmit={handleSendCode} className="otpAuth__form">
            <div className="otpAuth__field">
              <label className="otpAuth__label">מספר טלפון</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-1234567"
                className="otpAuth__input"
                disabled={loading}
              />
            </div>
            {error && <div className="otpAuth__error">{error}</div>}
            <button type="submit" className="pill pill--primary" disabled={loading}>
              {loading ? 'שולח...' : 'שלחי קוד'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="otpAuth__form">
            <div className="otpAuth__field">
              <label className="otpAuth__label">קוד אימות</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="otpAuth__input otpAuth__input--code"
                maxLength={6}
                disabled={loading}
                autoFocus
              />
              <p className="otpAuth__hint">הקוד נשלח למספר {phone}</p>
            </div>
            {error && <div className="otpAuth__error">{error}</div>}
            <button type="submit" className="pill pill--primary" disabled={loading}>
              {loading ? 'מאמת...' : 'אמתי'}
            </button>
            <button
              type="button"
              className="otpAuth__back"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
            >
              חזרה
            </button>
          </form>
        )}
      </div>
    </div>
  );
};


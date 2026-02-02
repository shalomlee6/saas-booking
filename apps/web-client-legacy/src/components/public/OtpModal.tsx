import React, { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useClientAuth } from '../../public/clientAuth/ClientAuthContext';
import { requestOtp, verifyOtp } from '../../api/publicClient';
import { useNavigate, useParams } from 'react-router-dom';

interface OtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  selectedServiceId?: string | null;
}

export const OtpModal: React.FC<OtpModalProps> = ({ isOpen, onClose, onSuccess, selectedServiceId }) => {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const { loginWithToken } = useClientAuth();

  const [step, setStep] = useState<'info' | 'code'>('info');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setStep('info');
      setPhone('');
      setFirstName('');
      setLastName('');
      setCode('');
      setError(null);
      setTimer(0);
    }
  }, [isOpen]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 9) {
      setError('אנא הכניסי מספר טלפון תקין');
      return;
    }
    if (!firstName || !lastName) {
      setError('אנא הכניסי שם פרטי ושם משפחה');
      return;
    }
    if (!businessSlug) {
      setError('שגיאה: businessSlug חסר');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await requestOtp(businessSlug, phone, firstName, lastName);
      setStep('code');
      setTimer(60);
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
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
      onClose();
      if (onSuccess) {
        onSuccess();
      } else {
        // Navigate to booking page with selected service
        const state = selectedServiceId ? { serviceId: selectedServiceId } : undefined;
        navigate(`/public/${businessSlug}/book`, { state });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'קוד שגוי, נסי שוב');
      setLoading(false);
    }
  };

  const handleResend = () => {
    setStep('info');
    setCode('');
    setError(null);
    setTimer(0);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="התחברות">
      <div className="otpModal">
        {step === 'info' ? (
          <form onSubmit={handleSendCode} className="otpModal__form">
            <p className="otpModal__subtitle">הזיני את פרטייך כדי לקבל קוד אימות</p>
            <div className="otpModal__field">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="מספר טלפון (050-1234567)"
                className="otpModal__input"
                disabled={loading}
                required
              />
            </div>
            <div className="otpModal__field">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="שם פרטי"
                className="otpModal__input"
                disabled={loading}
                required
              />
            </div>
            <div className="otpModal__field">
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="שם משפחה"
                className="otpModal__input"
                disabled={loading}
                required
              />
            </div>
            {error && <div className="otpModal__error">{error}</div>}
            <button type="submit" className="pill pill--primary" disabled={loading}>
              {loading ? 'שולח...' : 'שלחי קוד'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="otpModal__form">
            <p className="otpModal__subtitle">הזיני את הקוד בן 6 הספרות שנשלח ל{phone}</p>
            <div className="otpModal__field">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="otpModal__input otpModal__input--code"
                maxLength={6}
                disabled={loading}
                autoFocus
                required
              />
            </div>
            {error && <div className="otpModal__error">{error}</div>}
            <button type="submit" className="pill pill--primary" disabled={loading}>
              {loading ? 'מאמת...' : 'אמתי'}
            </button>
            {timer > 0 ? (
              <p className="otpModal__timer">ניתן לשלוח שוב בעוד {timer} שניות</p>
            ) : (
              <button type="button" className="otpModal__resend" onClick={handleResend} disabled={loading}>
                שלחי קוד חדש
              </button>
            )}
          </form>
        )}
      </div>
    </BottomSheet>
  );
};


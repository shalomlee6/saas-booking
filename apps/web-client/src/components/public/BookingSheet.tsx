import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { HoldToConfirmButton } from './HoldToConfirmButton';
import { requestOtp, verifyOtp, createPublicAppointment } from '../../api/publicClient';
import { useClientAuth } from '../../public/clientAuth/ClientAuthContext';

interface Service {
  id: string;
  name: string;
  durationMin: number;
}

interface Slot {
  id: string;
  date: Date;
  time: string;
  start: string;
  end: string;
}

interface BookingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  service: Service;
  slot: Slot;
  businessSlug: string;
}

type SheetStep = 'form' | 'otp' | 'confirm';

export const BookingSheet: React.FC<BookingSheetProps> = ({
  isOpen,
  onClose,
  onSuccess,
  service,
  slot,
  businessSlug,
}) => {
  const { loginWithToken, customerId } = useClientAuth();
  const [step, setStep] = useState<SheetStep>('form');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpTimer, setOtpTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);

  // Reset form when sheet opens
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setPhone('');
      setFirstName('');
      setLastName('');
      setOtpCode('');
      setError(null);
      setOtpTimer(0);
      setCanResend(false);
    }
  }, [isOpen]);

  // OTP timer countdown
  useEffect(() => {
    if (otpTimer > 0) {
      const timer = setTimeout(() => {
        setOtpTimer(otpTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (otpTimer === 0 && step === 'otp') {
      setCanResend(true);
    }
  }, [otpTimer, step]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 9) {
      setError('אנא הכניסי מספר טלפון תקין');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await requestOtp(businessSlug, phone);
      setStep('otp');
      setOtpTimer(60); // 60 seconds
      setCanResend(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'שגיאה בשליחת קוד');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setError('אנא הכניסי קוד בן 6 ספרות');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await verifyOtp(businessSlug, phone, otpCode);
      loginWithToken(result.token, result.customerId, result.businessId);
      setStep('confirm');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'קוד שגוי, נסי שוב');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    setCanResend(false);
    setOtpTimer(60);
    setError(null);
    try {
      await requestOtp(businessSlug, phone);
    } catch (err: any) {
      setError('שגיאה בשליחת קוד מחדש');
    }
  };

  const handleConfirmBooking = async () => {
    if (!customerId) {
      setError('שגיאה: לא אותרה לקוחה');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createPublicAppointment(businessSlug, {
        serviceId: service.id,
        customerId,
        start: slot.start,
        end: slot.end,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'שגיאה בקביעת התור. נסי שוב.');
      setLoading(false);
    }
  };

  const formatSlotDate = () => {
    return slot.date.toLocaleDateString('he-IL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="אשרי תור">
      <div className="bookingSheet">
        {/* Appointment summary */}
        <div className="bookingSheet__summary">
          <div className="bookingSheet__summaryItem">
            <span className="bookingSheet__summaryLabel">שירות:</span>
            <span className="bookingSheet__summaryValue">{service.name}</span>
          </div>
          <div className="bookingSheet__summaryItem">
            <span className="bookingSheet__summaryLabel">תאריך:</span>
            <span className="bookingSheet__summaryValue">{formatSlotDate()}</span>
          </div>
          <div className="bookingSheet__summaryItem">
            <span className="bookingSheet__summaryLabel">שעה:</span>
            <span className="bookingSheet__summaryValue">{slot.time}</span>
          </div>
        </div>

        {error && <div className="bookingSheet__error">{error}</div>}

        {/* Step 1: Phone + Name Form */}
        {step === 'form' && (
          <form onSubmit={handleSendCode} className="bookingSheet__form">
            <div className="bookingSheet__field">
              <label className="bookingSheet__label">מספר טלפון *</label>
              <input
                type="tel"
                className="bookingSheet__input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-1234567"
                required
                disabled={loading}
              />
            </div>
            <div className="bookingSheet__field">
              <label className="bookingSheet__label">שם פרטי</label>
              <input
                type="text"
                className="bookingSheet__input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="שם פרטי"
                disabled={loading}
              />
            </div>
            <div className="bookingSheet__field">
              <label className="bookingSheet__label">שם משפחה</label>
              <input
                type="text"
                className="bookingSheet__input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="שם משפחה"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="pill pill--primary bookingSheet__submit"
              disabled={loading}
            >
              {loading ? 'שולח...' : 'שלחי קוד אימות'}
            </button>
          </form>
        )}

        {/* Step 2: OTP Input */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="bookingSheet__form">
            <div className="bookingSheet__field">
              <label className="bookingSheet__label">הכניסי את הקוד שנשלח ל{phone}</label>
              <input
                type="text"
                className="bookingSheet__input bookingSheet__input--otp"
                value={otpCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtpCode(value);
                }}
                placeholder="000000"
                maxLength={6}
                required
                disabled={loading}
                dir="ltr"
              />
            </div>
            {otpTimer > 0 && (
              <p className="bookingSheet__timer">ניתן לשלוח קוד חדש בעוד {otpTimer} שניות</p>
            )}
            {canResend && (
              <button
                type="button"
                className="bookingSheet__resend"
                onClick={handleResendCode}
                disabled={loading}
              >
                שלחי קוד מחדש
              </button>
            )}
            <button
              type="submit"
              className="pill pill--primary bookingSheet__submit"
              disabled={loading || otpCode.length !== 6}
            >
              {loading ? 'מאמתת...' : 'אמתי קוד'}
            </button>
          </form>
        )}

        {/* Step 3: Hold to Confirm */}
        {step === 'confirm' && (
          <div className="bookingSheet__confirm">
            <p className="bookingSheet__confirmText">לסיום, החזיקי כדי לאשר את התור</p>
            <HoldToConfirmButton onConfirm={handleConfirmBooking} disabled={loading} />
          </div>
        )}
      </div>
    </BottomSheet>
  );
};


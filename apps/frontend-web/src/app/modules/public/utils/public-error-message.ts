import { parseHttpClientError } from '../../../shared/utils/http-field-errors.util';

/** Stable public API codes → i18n keys. Unknown codes use the fallback key. */
const PUBLIC_ERROR_KEYS: Record<string, string> = {
  INVALID_PHONE: 'publicErrors.invalidPhone',
  BUSINESS_NOT_FOUND: 'publicErrors.businessNotFound',
  OTP_COOLDOWN: 'publicErrors.otpCooldown',
  OTP_UNAVAILABLE: 'publicErrors.otpUnavailable',
  INVALID_CODE: 'publicErrors.invalidCode',
  BIRTHDAY_REQUIRED: 'publicErrors.birthdayRequired',
  BIRTHDAY_INVALID: 'publicErrors.birthdayInvalid',
  BUSINESS_MISMATCH: 'publicErrors.businessMismatch',
  NAME_REQUIRED: 'publicErrors.nameRequired',
  AUTH_REQUIRED: 'publicErrors.authRequired',
  PROFILE_INCOMPLETE: 'publicErrors.profileIncomplete',
  CUSTOMER_NOT_FOUND: 'publicErrors.customerNotFound',
  BOOKING_DISABLED: 'publicErrors.bookingDisabled',
  SERVICE_NOT_FOUND: 'publicErrors.serviceNotFound',
  INVALID_DATE_TIME: 'publicErrors.invalidDateTime',
  APPOINTMENT_SPANS_DAYS: 'publicErrors.invalidDateTime',
  INVALID_RANGE: 'publicErrors.invalidDateTime',
  APPOINTMENT_NOT_FOUND: 'publicErrors.appointmentNotFound',
  APPOINTMENT_NOT_CANCELLABLE: 'publicErrors.appointmentNotCancellable',
  APPOINTMENT_NOT_CHANGEABLE: 'publicErrors.appointmentNotChangeable',
  OUTSIDE_CANCELLATION_WINDOW: 'publicErrors.outsideWindow',
  ONLINE_BOOKING_UNAVAILABLE: 'publicErrors.onlineBookingUnavailable',
  SLOT_TAKEN: 'publicErrors.slotTaken',
  CLOSED_DAY: 'publicErrors.closedDay',
  OUTSIDE_HOURS: 'publicErrors.outsideHours',
  START_IN_PAST: 'publicErrors.startInPast',
  VALIDATION_FAILED: 'publicErrors.validationFailed',
  MAX_ACTIVE_APPOINTMENTS: 'publicErrors.maxActiveAppointments',
  TOO_SOON: 'publicErrors.tooSoon',
  TOO_FAR: 'publicErrors.tooFar',
  ONLINE_BOOKING_DISABLED: 'publicErrors.onlineBookingDisabled',
  ONLINE_CANCEL_DISABLED: 'publicErrors.onlineCancelDisabled',
};

export function publicErrorTranslationKey(err: unknown): string {
  const code = parseHttpClientError(err).errorCode;
  if (code && PUBLIC_ERROR_KEYS[code]) return PUBLIC_ERROR_KEYS[code];
  return 'publicErrors.unknown';
}

import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import { resolveOnlineBookingRules, buildClientPolicyText, type OnlineBookingRules } from './bookingRules';
import { resolveReliabilityPolicy, type ReliabilityPolicy } from './customerNoShows';
import type { BookingRulesBody, ReliabilityBody } from '../validation/schemas/bookingSettings';

export async function readOwnerBookingSettings(businessId: string): Promise<{
  booking: OnlineBookingRules;
  reliability: ReliabilityPolicy;
  clientPolicy: { he: string; en: string };
  settingsId: string;
}> {
  const settings = await ensureBusinessSettings(businessId);
  const booking = resolveOnlineBookingRules(settings);
  const reliability = resolveReliabilityPolicy(settings);
  return {
    booking,
    reliability,
    clientPolicy: {
      he: buildClientPolicyText(booking, reliability, 'he'),
      en: buildClientPolicyText(booking, reliability, 'en'),
    },
    settingsId: settings._id.toString(),
  };
}

export async function saveOwnerBookingRules(
  businessId: string,
  next: BookingRulesBody
): Promise<{ changed: boolean; previous: OnlineBookingRules; current: OnlineBookingRules; settingsId: string }> {
  const settings = await ensureBusinessSettings(businessId);
  const previous = resolveOnlineBookingRules(settings);
  const current: OnlineBookingRules = {
    enabled: next.enabled,
    minLeadMinutes: next.minLeadMinutes,
    maxAdvanceDays: next.maxAdvanceDays,
    bufferMinutes: next.bufferMinutes,
    onlineDefaultStatus: next.onlineDefaultStatus,
    maxActiveAppointmentsPerClient: next.maxActiveAppointmentsPerClient,
    clientCanCancelOnline: next.clientCanCancelOnline,
    cancellationWindowHours: next.cancellationWindowHours,
  };
  const changed = JSON.stringify(previous) !== JSON.stringify(current);
  if (changed) {
    settings.onlineBooking = {
      enabled: current.enabled,
      minLeadMinutes: current.minLeadMinutes,
      maxAdvanceDays: current.maxAdvanceDays,
      bufferMinutes: current.bufferMinutes,
      onlineDefaultStatus: current.onlineDefaultStatus,
      maxActiveAppointmentsPerClient: current.maxActiveAppointmentsPerClient,
      clientCanCancelOnline: current.clientCanCancelOnline,
    };
    settings.cancellationWindowHours = current.cancellationWindowHours;
    await settings.save();
  }
  return { changed, previous, current, settingsId: settings._id.toString() };
}

export async function saveOwnerReliability(
  businessId: string,
  next: ReliabilityBody
): Promise<{ changed: boolean; previous: ReliabilityPolicy; current: ReliabilityPolicy; settingsId: string }> {
  const settings = await ensureBusinessSettings(businessId);
  const previous = resolveReliabilityPolicy(settings);
  const current: ReliabilityPolicy = {
    noShow: { enabled: next.noShow.enabled, threshold: next.noShow.threshold },
    lateCancellation: {
      enabled: next.lateCancellation.enabled,
      threshold: next.lateCancellation.threshold,
    },
    lateArrival: { enabled: next.lateArrival.enabled, threshold: next.lateArrival.threshold },
    lookback: next.lookback,
  };
  const changed = JSON.stringify(previous) !== JSON.stringify(current);
  if (changed) {
    settings.noShowPolicy = current.noShow;
    settings.reliability = {
      lateCancellation: current.lateCancellation,
      lateArrival: current.lateArrival,
      lookback: current.lookback,
    };
    await settings.save();
  }
  return { changed, previous, current, settingsId: settings._id.toString() };
}

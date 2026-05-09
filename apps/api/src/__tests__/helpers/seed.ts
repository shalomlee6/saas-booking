import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { User } from '../../models/User';
import { Business } from '../../models/Business';
import { Service } from '../../models/Service';
import { Customer } from '../../models/Customer';
import { BusinessSettings } from '../../models/BusinessSettings';

const JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long!';

export function signTestToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export async function seedOwner(overrides: { email?: string; password?: string } = {}) {
  const email = overrides.email ?? 'owner@test.com';
  const password = overrides.password ?? 'Password123!';
  const passwordHash = await bcrypt.hash(password, 4); // low cost for speed

  const user = await User.create({ email, passwordHash, role: 'owner', status: 'active' });

  const slug = `test-biz-${user._id.toString()}`;
  const business = await Business.create({
    ownerId: user._id,
    name: 'Test Business',
    slug,
  });

  user.businessId = business._id;
  await user.save();

  const token = signTestToken({
    userId: user._id.toString(),
    role: 'owner',
    email: user.email,
    businessId: user.businessId!.toString(),
  });

  return { user, business, token };
}

export async function seedSuperAdmin() {
  const passwordHash = await bcrypt.hash('Admin123!', 4);
  const user = await User.create({
    email: 'superadmin@test.com',
    passwordHash,
    role: 'super_admin',
    status: 'active',
  });

  const token = signTestToken({
    userId: user._id.toString(),
    role: 'super_admin',
    email: user.email,
  });

  return { user, token };
}

export async function seedService(businessId: Types.ObjectId | string) {
  return Service.create({
    businessId,
    name: 'Haircut',
    durationMinutes: 60,
    price: 100,
    isActive: true,
  });
}

export async function seedCustomer(businessId: Types.ObjectId | string) {
  return Customer.create({
    businessId,
    name: 'Test Customer',
    phone: '+972501234567',
  });
}

/**
 * Seeds BusinessSettings with all-day open hours (every day 00:00–23:59 UTC).
 * This avoids timezone-sensitive failures in appointment scheduling tests.
 */
export async function seedBusinessSettings(businessId: Types.ObjectId | string) {
  const allDay = { start: '00:00', end: '23:59' };
  return BusinessSettings.create({
    businessId,
    plan: 'free',
    theme: {
      colors: {
        primary: '#F35271',
        secondary: '#FF9DBC',
        accent: '#6CD6CD',
        background: '#FFFFFF',
        text: '#111827',
      },
      logoUrl: null,
      fontFamily: 'system-ui',
    },
    features: {
      bookingEnabled: true,
      paymentsEnabled: false,
      marketingModule: false,
      chatModule: false,
      waitlistEnabled: false,
      analyticsEnabled: false,
      customDomainEnabled: false,
    },
    localization: { language: 'he', timezone: 'UTC', currency: 'ILS' },
    openingHours: {
      slotStepMinutes: 30,
      days: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, isOpen: true, ranges: [allDay] })),
    },
  });
}

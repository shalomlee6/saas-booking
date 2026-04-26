import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { BusinessSettings } from '../models/BusinessSettings';
import { Service } from '../models/Service';
import { Appointment } from '../models/Appointment';
import { Customer } from '../models/Customer';
import { ensureBusinessSettings } from '../utils/ensureBusinessSettings';
import type { SettingsPlan } from '../dto/enums';
import { logger } from '../utils/logger';

/**
 * POST /api/admin/test-seed
 * Idempotent-ish fixture data for E2E against a real API.
 * Guarded by E2E_TEST_SEED_SECRET (header x-e2e-test-seed-secret).
 */
export async function postAdminTestSeed(req: Request, res: Response): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  try {
    const secret = process.env.E2E_TEST_SEED_SECRET;
    if (!secret || secret.length < 8) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    const header = req.header('x-e2e-test-seed-secret');
    if (header !== secret) {
      res.status(403).json({ message: 'Invalid seed secret' });
      return;
    }

    const email =
      (process.env.E2E_SEED_SUPER_ADMIN_EMAIL || 'superadmin@example.com').toLowerCase().trim();
    const password = process.env.E2E_SEED_SUPER_ADMIN_PASSWORD || 'password12345';
    const passwordHash = await bcrypt.hash(password, 10);

    let superAdmin = await User.findOne({ email });
    if (!superAdmin) {
      superAdmin = await User.create({
        email,
        passwordHash,
        role: 'super_admin',
        name: 'E2E Super Admin',
        status: 'active',
      });
    } else {
      superAdmin.passwordHash = passwordHash;
      superAdmin.role = 'super_admin';
      superAdmin.status = 'active';
      superAdmin.name = superAdmin.name || 'E2E Super Admin';
      await superAdmin.save();
    }

    async function ensureOwnerBusiness(
      ownerEmail: string,
      businessName: string,
      slug: string,
      plan: 'free' | 'normal' | 'premium'
    ): Promise<{ businessId: Types.ObjectId; ownerId: Types.ObjectId }> {
      const settingsPlan: SettingsPlan = plan === 'normal' ? 'pro' : plan;
      let owner = await User.findOne({ email: ownerEmail });
      if (!owner) {
        owner = await User.create({
          email: ownerEmail,
          passwordHash: await bcrypt.hash('password12345', 10),
          role: 'owner',
          name: businessName,
          status: 'active',
        });
      }
      let business = await Business.findOne({ slug });
      const businessPlan: 'free' | 'pro' | 'premium' =
        plan === 'premium' ? 'premium' : plan === 'normal' ? 'pro' : 'free';
      if (!business) {
        business = await Business.create({
          ownerId: owner._id,
          name: businessName,
          slug,
          plan: businessPlan,
        });
        owner.businessId = business._id;
        await owner.save();
      } else {
        business.ownerId = owner._id;
        business.plan = businessPlan;
        await business.save();
        owner.businessId = business._id;
        await owner.save();
      }
      const settings = await ensureBusinessSettings(business._id);
      settings.plan = settingsPlan;
      await settings.save();
      return { businessId: business._id as Types.ObjectId, ownerId: owner._id as Types.ObjectId };
    }

    const b1 = await ensureOwnerBusiness('e2e-owner-a@example.com', 'E2E Salon Alpha', 'e2e-salon-alpha', 'normal');
    const b2 = await ensureOwnerBusiness('e2e-owner-b@example.com', 'E2E Salon Beta', 'e2e-salon-beta', 'premium');

    async function ensureService(businessId: Types.ObjectId, name: string, price: number): Promise<Types.ObjectId> {
      let s = await Service.findOne({ businessId, name });
      if (!s) {
        s = await Service.create({
          businessId,
          name,
          durationMinutes: 45,
          price,
          isActive: true,
        });
      }
      return s._id as Types.ObjectId;
    }

    const svc1 = await ensureService(b1.businessId, 'Cut & Style', 120);
    await ensureService(b2.businessId, 'Premium Package', 200);

    let customer = await Customer.findOne({ businessId: b1.businessId, phone: '0500000001' });
    if (!customer) {
      customer = await Customer.create({
        businessId: b1.businessId,
        name: 'E2E Customer',
        phone: '0500000001',
        email: 'e2e-customer@example.com',
      });
    }

    const day = new Date();
    day.setUTCHours(12, 0, 0, 0);
    const start = new Date(day);
    const end = new Date(start.getTime() + 45 * 60 * 1000);
    const exists = await Appointment.findOne({
      businessId: b1.businessId,
      serviceId: svc1,
      start,
    });
    if (!exists) {
      await Appointment.create({
        businessId: b1.businessId,
        serviceId: svc1,
        customerId: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone,
        price: 120,
        durationMinutes: 45,
        start,
        end,
        status: 'confirmed',
        source: 'owner',
      });
    }

    res.json({
      ok: true,
      superAdminEmail: email,
      businessIds: [b1.businessId.toString(), b2.businessId.toString()],
    });
  } catch (err) {
    logger.error('admin_test_seed_failed', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ message: 'Internal server error' });
  }
}

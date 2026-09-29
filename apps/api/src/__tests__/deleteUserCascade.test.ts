import request from 'supertest';
import bcrypt from 'bcryptjs';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedSuperAdmin, seedService, seedCustomer } from './helpers/seed';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { Service } from '../models/Service';
import { Customer } from '../models/Customer';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

async function seedStaff(businessId: string) {
  const passwordHash = await bcrypt.hash('StaffPass123!', 4);
  return User.create({
    email: 'staff@test.com',
    passwordHash,
    role: 'staff',
    status: 'active',
    businessId,
  });
}

describe('DELETE /api/admin/users/:id — cascade scope', () => {
  it('deleting a staff member removes only that account — business, owner, and data survive', async () => {
    const { token: adminToken } = await seedSuperAdmin();
    const { user: owner, business } = await seedOwner();
    const staff = await seedStaff(business._id.toString());
    await seedService(business._id);
    await seedCustomer(business._id);

    // Impact preview must not claim any cascade for a staff account.
    const impact = await request(app)
      .get(`/api/admin/users/${staff._id.toString()}/delete-impact`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(impact.status).toBe(200);
    expect(impact.body.business).toBeNull();

    const del = await request(app)
      .delete(`/api/admin/users/${staff._id.toString()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);

    expect(await User.findById(staff._id)).toBeNull();
    expect(await User.findById(owner._id)).not.toBeNull();
    expect(await Business.findById(business._id)).not.toBeNull();
    expect(await Service.countDocuments({ businessId: business._id })).toBe(1);
    expect(await Customer.countDocuments({ businessId: business._id })).toBe(1);
  });

  it('deleting the owner still cascades the whole business, including its staff', async () => {
    const { token: adminToken } = await seedSuperAdmin();
    const { user: owner, business } = await seedOwner();
    const staff = await seedStaff(business._id.toString());
    await seedService(business._id);

    const impact = await request(app)
      .get(`/api/admin/users/${owner._id.toString()}/delete-impact`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(impact.status).toBe(200);
    expect(impact.body.business).not.toBeNull();
    expect(impact.body.counts.staffUsers).toBe(1);

    const del = await request(app)
      .delete(`/api/admin/users/${owner._id.toString()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);

    expect(await User.findById(owner._id)).toBeNull();
    expect(await User.findById(staff._id)).toBeNull();
    expect(await Business.findById(business._id)).toBeNull();
    expect(await Service.countDocuments({ businessId: business._id })).toBe(0);
  });
});

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { isOwnerAccess } from '../middleware/requireOwner';
import { Service } from '../models/Service';
import { recordAudit } from '../utils/recordAudit';
import {
  listServicesForExport,
  listServicesPage,
  servicesToCsv,
  setServicesActiveForTenant,
  type ServicesPagedQuery,
} from '../services/serviceListService';

export async function listServices(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  if ((req as AuthRequest & { serviceListPaged?: boolean }).serviceListPaged) {
    const page = await listServicesPage(
      businessId,
      req.query as unknown as ServicesPagedQuery,
      isOwnerAccess(req)
    );
    res.json(page);
    return;
  }
  const services = await Service.find({ businessId, isActive: true }).sort({ name: 1 });
  res.json(services);
}

export async function exportServices(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const rows = await listServicesForExport(businessId, req.query as unknown as ServicesPagedQuery);
  const csv = servicesToCsv(rows);
  await recordAudit({
    actorUserId: req.user?.userId,
    actorEmail: req.user?.email,
    action: 'service.exported',
    entity: 'Service',
    metadata: { businessId, rowCount: csv.rowCount },
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="services.csv"');
  res.send(csv.body);
}

export async function bulkSetServiceStatus(req: AuthRequest, res: Response): Promise<void> {
  const businessId = req.effectiveBusinessId!;
  const { ids, isActive } = req.body as { ids: string[]; isActive: boolean };
  const result = await setServicesActiveForTenant(businessId, ids, isActive);
  for (const id of result.ids) {
    await recordAudit({
      actorUserId: req.user?.userId,
      actorEmail: req.user?.email,
      action: isActive ? 'service.activated' : 'service.deactivated',
      entity: 'Service',
      entityId: id.toString(),
      metadata: { businessId },
    });
  }
  res.json({ updated: result.updated });
}

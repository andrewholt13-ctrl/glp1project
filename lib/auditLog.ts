type AuditWriteInput = {
  action: string
  entityType: string
  entityId: string
  actorRole: string
  actorId?: string | null
  orderId?: string | null
  reason?: string | null
  beforeValue?: string | null
  afterValue?: string | null
  metadata?: unknown
}

export async function writeAuditLog(tx: unknown, input: AuditWriteInput) {
  const auditDelegate = (tx as { auditLog?: { create?: (args: unknown) => Promise<unknown> } }).auditLog
  if (!auditDelegate?.create) return

  await auditDelegate.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorRole: input.actorRole,
      actorId: input.actorId ?? null,
      orderId: input.orderId ?? null,
      reason: input.reason ?? null,
      beforeValue: input.beforeValue ?? null,
      afterValue: input.afterValue ?? null,
      metadata:
        typeof input.metadata === 'string'
          ? input.metadata
          : input.metadata != null
            ? JSON.stringify(input.metadata)
            : null,
    },
  })
}

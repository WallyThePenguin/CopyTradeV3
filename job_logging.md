# Job Logging Design

## Purpose

Replace flat file logs with structured database records to track nightly background task health. Enables visibility, error review, and historical uptime metrics.

## New Table: `JobLog`

```prisma
model JobLog {
  id         String   @id @default(uuid())
  jobName    String   // e.g. 'calendar_update', 'llm_eval', 'data_quality'
  startedAt  DateTime @default(now())
  endedAt    DateTime?
  status     String   // 'SUCCESS' | 'FAILED' | 'IN_PROGRESS'
  errorText  String?
}
```

## Write Logic

At the beginning of each job:

```ts
const job = await prisma.jobLog.create({
  data: { jobName: 'llm_eval', status: 'IN_PROGRESS' }
});
```

After job finishes:

```ts
await prisma.jobLog.update({
  where: { id: job.id },
  data: { status: 'SUCCESS', endedAt: new Date() }
});
```

If job fails:

```ts
await prisma.jobLog.update({
  where: { id: job.id },
  data: { status: 'FAILED', endedAt: new Date(), errorText: error.message }
});
```

## API Endpoint (Optional)

**GET /api/job-logs**

- Returns latest `n` job entries
- Optional query: `jobName`, `status`, `dateRange`

## Notes

- Every scheduled task should insert a log row.
- Admin dashboard can surface these by job category.
- Can be used later to generate uptime charts or auto-alerts.
- No need for external logfiles once this is in place.


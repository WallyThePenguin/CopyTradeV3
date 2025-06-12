# ExecutionAuditLog Specification

## Purpose

The `ExecutionAuditLog` is designed to track all live or simulated trading interactions with brokers (initially Robinhood). This table provides:

- A full audit trail for order lifecycle events
- Troubleshooting context for failed orders
- Data to train future algorithmic trade simulators

## Prisma Schema

```prisma
model ExecutionAuditLog {
  id           String   @id @default(uuid())
  tradeId      String   @map("trade_id")
  channelId    String   @map("channel_id")
  type         String   // e.g. 'order_placed', 'order_filled', 'order_failed', 'retry_attempt'
  statusCode   Int?     // HTTP status or broker error code
  rawResponse  Json     // Full payload returned from broker
  durationMs   Int?     // Time between request and response
  timestamp    DateTime @default(now())
  Trade        Trade    @relation(fields: [tradeId], references: [id])
}
```

## Event Types

Codex should log an audit row for the following broker interactions:

- `order_placed`
- `order_filled`
- `order_failed`
- `cancel_requested`
- `retry_attempt`
- `quote_lookup`
- `position_snapshot`

## Insert Example (Node.js)

```ts
await prisma.executionAuditLog.create({
  data: {
    tradeId: trade.id,
    channelId: trade.channelId,
    type: 'order_placed',
    statusCode: 201,
    rawResponse: brokerResult,
    durationMs: Date.now() - startTime
  }
});
```

## Notes

- `rawResponse` must always be stored as full JSON.
- This table should be used **instead of logging to disk**.
- The `type` field is essential for filtering logs for a trade lifecycle view.
- Combine with `ExecutionStats` for aggregated performance summaries.


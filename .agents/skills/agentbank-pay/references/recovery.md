# Payment recovery

Always call `get_payment` before retrying, correcting, or cancelling.

## Review state

For `need_review`, wait for provider review and poll after
`next_action.poll_after_seconds`. Do not continue or correct the recipient.
This state does not by itself mean the saved recipient is invalid.

For `rail_not_ready`, follow the identity workflow. No payment was created.

## Recipient correction

Only for `recipient_correction_required`:

1. Read the failure and destination context.
2. Ask for corrected fields.
3. Show the change and obtain confirmation.
4. Call `correct_payment_recipient` with a new request ID and
   `confirmed_by_user=true`.
5. Resume polling.

## Cancellation

Call `cancel_payment` only after explicit confirmation and only before funds
move. A World ID challenge may remain visible until expiry, but cannot resume a
cancelled payment.

If `funds_moved=true`, do not promise cancellation, duplicate funding, or
automatically create a replacement.

## Failure

Read `failure.code`, `stage`, `message`, `retryable`, and `funds_moved`.

- If funds did not move and a route or approval expired, create a fresh
  estimate and obtain fresh confirmation before a new payment.
- If funds moved, explain the state and continue tracking or escalate. Do not
  invent partial two-hop recovery.
- Never convert failure to success from a wallet receipt alone.

Reuse the same request ID after an ambiguous submission of the same mutation.
Never create a replacement solely because a local MCP process restarted.

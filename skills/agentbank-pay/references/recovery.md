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
move. Cancellation also cancels a pending approval; never tell the human to
finish an approval for a cancelled payment.

For a draft or submitted plan, call `review_payment_plan` first. Use
`cancel_payment_plan` only after explicit confirmation; it cancels unstarted
items and releases unopened route locks but cannot interrupt moved funds.

If `funds_moved=true`, do not promise cancellation, duplicate funding, or
automatically create a replacement.

## Failure

Read `failure.code`, `stage`, `message`, `retryable`, and `funds_moved`.

- For terminal `status=expired` with `failure.code=payment_expired`, the locked
  pre-funding route expired before continuation. It is not retryable for that
  payment: obtain a fresh estimate and confirmation, then create a new payment
  with a new logical request ID.
- If funds did not move and a route or approval expired, create a fresh
  estimate and obtain fresh confirmation before a new payment.
- If funds moved, explain the state and continue tracking or escalate. Do not
  invent partial two-hop recovery.
- Never convert failure to success from a wallet receipt alone.

Reuse the same request ID after an ambiguous submission of the same mutation.
Never create a replacement solely because a local MCP process restarted.
An authorized sibling installation may inspect or cancel an owner-scoped
payment, but must apply the same confirmation and funds-moved rules.

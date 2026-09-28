## 10. Track the payment

Use `get_payment` as the authoritative state. Follow
`next_action.poll_after_seconds` when present.

On hosted MCP surfaces, `get_payment` itself is card-free. Before funds move,
urge the human to complete the existing funding instruction and call
`get_payment_instruction` only when the instruction card was missed or is
requested again. After funds move, call `show_payment_progress` to render the
payment lifecycle card. The funding card must not turn into the progress card.
On hosts without cards, every `get_payment` result carries `progress_steps`
and a `say_to_user` naming the current step; send it, and use
`track_payments` when more than one payment is in flight.

Current statuses are `approval_required`, `approval_ready`, `funding_required`,
`funding_detecting`, `processing`, `need_review`, `recipient_correction_required`,
`completed`, `cancelled`, `expired`, `funding_timeout`, and `failed`.

Do not report a two-hop payment complete until the aggregate is `completed`.
One completed hop is not complete payment delivery.

When a hop has `receipt.crypto_tx_hash`, report it as that hop's chain
reference. The receipt also contains the settled input/output assets and
amounts plus `completed_at`. A receipt is useful evidence, but `get_payment`
remains the authority for aggregate payment completion.

When status is `need_review`, the provider is still reviewing identity or another
temporary settlement condition. Do not call `continue_payment` or
`correct_payment_recipient`. Wait for `next_action.poll_after_seconds`, then
call `get_payment` again. This state does not mean the saved recipient is
invalid.

Use `list_payments` to find historical payments for the current installation or
hosted OAuth connection.
When the user refers to an earlier payment ambiguously, compare source,
destination, amount, status, and time, then ask which one they mean if multiple
records fit.

## 11. Recover safely

Always call `get_payment` before retrying a mutation.

### Recipient correction

When status is `recipient_correction_required`:

1. Read the failure and current destination context.
2. Ask for corrected fields.
3. Show the change and obtain confirmation.
4. Call `correct_payment_recipient` with a new request ID and
   `confirmed_by_user=true`.
5. Resume polling.

If Core rejects payment creation because a recipient is incompatible, no
payment or settlement exists and no funds moved. Return to the final quote,
choose a listed `recipient_requirement`, correct or create the recipient, then
obtain a fresh estimate and confirmation if the quote has expired.

### Cancellation

Call `cancel_payment` only after the human confirms and only before funds move.
Cancellation also closes a payment whose hops have not opened yet. There is no
separate approval-cancel tool, so an associated approval challenge may remain
visible until it expires, but completing it cannot resume the cancelled payment.

If `funds_moved=true`, do not promise cancellation, duplicate funding, or create
a replacement payment automatically.

### Failure

Read `failure.code`, `failure.stage`, `failure.message`, `retryable`, and
`funds_moved`.

- If funds did not move and the route/approval expired, create a fresh estimate
  and obtain fresh confirmation before a new payment.
- If funds moved, explain the state and continue tracking or escalate. Current
  Core has no automatic partial two-hop recovery action.
- Never convert a failed payment into success based on a wallet receipt alone.


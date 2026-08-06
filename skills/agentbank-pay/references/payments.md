# Payments and tracking

## Understand the request

For an estimate, collect the source asset and chain or fiat currency,
exact-source or exact-destination amount, destination asset/currency and
country, and optional routing preference. Do not request, create, or pass a
recipient merely to estimate a payment. Collect it only after the human elects
to create the reviewed route.

```text
balanced
lowest_total_cost
fastest
highest_success_rate
```

Use `balanced` by default. Do not silently split an amount, switch chains,
change exactness, or change recipients.

Use structured assets:

```json
{ "type": "crypto", "ticker": "USDC", "chain": "worldchain" }
```

```json
{ "type": "fiat", "symbol": "VND" }
```

Use `list_currencies` whenever a code, chain, address, or decimals need
verification.

## Find a live route

Call `list_quote_book_pairs` for live direct on/off-ramp corridors. Route
discovery and estimation do not require a recipient.

For fiat-to-fiat or source-token-to-fiat:

1. Join relevant live on-ramp and off-ramp pairs on one common crypto asset and
   chain.
2. Set `route.intermediate_asset` explicitly in `estimate_payment`.
3. Prefer the requested route; otherwise compare executable outcomes including
   all fees.

There is no automatic route planner. `browse_quote_book` is rough anonymous
discovery; read rate, percentage fee, flat fee, and fee currency together.
`get_ramp_quote` is direct on/off-ramp only.

## Estimate and confirm

Call `estimate_payment` for direct ramps, same-chain crypto swaps, and explicit
two-hop routes. For two hops, pass the intermediate asset. Do not provide
`recipient_id` or `recipient_fields`: estimates are recipient-free route
previews.

Require `status=estimate_ready`. The estimate is ephemeral, has no estimate ID,
and does not create a payment. Read the returned `source_amount`,
`destination_amount`, every leg's fee and currency, expiry, route,
`intermediate_amount`, and returned `hops`. Expect
`next_action.type=review_estimate`; `recipient_validation` is no longer part of
the estimate.

For a fiat destination, also read `recipient_requirements`. They are the
authoritative instrument choices and field contract. Do not create a recipient
or payment until the human chooses one listed `payment_instrument` and supplies
its required fields.

The returned hops contain route data only: `hop_index`, `intent_id`,
`direction`, `source`, and optional `client_quote_id`. Never add
`recipient_fields` or `recipient_ref` to these public hops.

Treat those returned effective amounts as the review truth. For an exact-source
two-hop route, the downstream locked quote may cause the exact-output upstream
leg to report a different `source_amount` from the initially requested
discovery amount. Surface that difference and obtain confirmation for the
returned amount; never silently reuse the original amount.

If the human wants to create the reviewed payment, collect or select the final
recipient now. A pure swap without a recipient uses the onboarding-bound wallet
internally; all other routes require the recipient once in
`create_payment.destination`.

If `estimate_payment` returns `QUOTE_UNAVAILABLE` or
`status=estimate_unavailable`:

1. Call `browse_quote_book` for each matching direct leg; inspect upstream and
   downstream legs separately for a two-hop route.
2. Compare the effective requested amount with each live band's `min_amount`,
   `max_amount`, expiry, `fee_pct`, `flat_fee`, and `fee_ccy`. Raw `rate` alone
   does not prove executability.
3. Explain whether no live band exists, the effective amount falls outside the
   band after fees, or the quote expired. Never invent a customer rate.
4. Call `check_verification_status` only when the response identifies KYC or
   rail readiness as a blocker, or when the human asks. Its `markets` output is
   not live quote readiness.
5. Ask whether to use an in-band amount or another route, then obtain a fresh
   estimate and confirmation after any change.

Show one confirmation:

```text
Recipient: [rail and sufficient destination details]
You send: [amount and asset]
Recipient receives: [amount and asset]
Fees: [each amount and currency]
Route: [direct, swap, or source -> intermediate -> destination]
Estimate expires: [time]
Expected duration: [when available]
Material warnings: [only relevant warnings]
Recipient instrument: [only when the estimate requires one]
```

After confirmation, call `create_payment` with a new stable request ID,
`confirmed_by_user=true`, the reviewed request, the final recipient once in
`destination.recipient_id` or `destination.recipient_fields` when required,
the top-level intermediate asset for two hops, and the exact current estimate
`hops` unchanged. Do not pass an estimate ID.

If Core returns `status=information_required` with
`reason=recipient_incompatible`, no payment, settlement, or funds movement
exists. Return to the current estimate's `recipient_requirements`, correct or
create the recipient with a listed instrument, and obtain a fresh estimate and
confirmation if it expired.

For a two-hop route, preserve hop order. The MCP internally injects
`recipient_ref:{"hop_index":1}` into hop 0 and the top-level destination
recipient into hop 1. Do not construct that plumbing yourself.

## Approval and continuation

For `approval_required`, show `approval.approval_url`, explain that the payment
owner signs in before World ID is shown, state expiry, and ask the human to
approve in World App. Never request or reconstruct a raw proof.

Core evaluates this installation's current World ID approval policy against the
locked route. Do not assume a fixed threshold. Non-USD-stable routes always
require World ID. Follow the returned status: for `approval_ready` with
`approval:null`, call `continue_payment` directly; for `approval_required`,
show the approval URL, wait for the human, and poll `get_payment` until ready.

## Follow the instruction exactly

Use `action_url` or `presentation_url` for human-executed fiat funding. Show the
exact amount and expiry, ask the human to pay, and poll `get_payment`. Do not
call `execute_payment_instruction` for fiat funding.

For a direct crypto deposit:

1. Show exact chain, asset, amount, full destination, memo/reference, and
   expiry.
2. Call `get_wallet_balances`.
3. Obtain explicit confirmation.
4. Call `execute_payment_instruction` with the current payment and instruction
   IDs, a stable request ID, and `confirmed_by_user=true`.
5. If pending, retry the identical call with the same request ID.

For `swap_execution`, show the confirmed source ceiling, destination amount,
asset, chain, and recipient, then execute the instruction as above. Never
construct calldata, token addresses, approval targets, or a call order; Core
owns and verifies the pinned plan.

For linked two-hop payments, act only on the first/source hop and then track the
aggregate. Never separately fund hop 1: that duplicates funding.

## Track

Poll `get_payment` according to `next_action.poll_after_seconds`. It is the
authoritative state.

Do not report a multi-hop payment complete until the aggregate is `completed`.
When complete, report each available `hops[].receipt.crypto_tx_hash` as that
hop's chain reference.

Use `list_payments` for history. If an earlier payment is ambiguous, compare
assets, amounts, state, and time, then ask which one the human means.

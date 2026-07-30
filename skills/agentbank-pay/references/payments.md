# Payments and tracking

## Understand the request

Collect the source asset and chain or fiat currency, exact-source or
exact-destination amount, destination asset/currency and country, concrete
recipient or wallet, and optional routing preference:

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

Resolve recipient data first. Then call `list_quote_book_pairs` for live direct
on/off-ramp corridors.

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
two-hop routes. For two hops, pass the intermediate asset and concrete final
recipient.

Require `status=estimate_ready`. The estimate is ephemeral, has no estimate ID,
and does not create a payment. Read exact source/destination amounts, every
leg's fee and currency, expiry, route, intermediate amount, recipient
validation, and returned `hops`.

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
```

After confirmation, call `create_payment` with a new stable request ID,
`confirmed_by_user=true`, the reviewed request, top-level intermediate asset
for two hops, and the exact current estimate `hops`. Do not pass an estimate ID.

For a two-hop route, preserve hop order and `recipient_ref`; the first hop
delivers directly to the downstream off-ramp destination.

## Approval and continuation

For `approval_required`, show `approval.approval_url`, explain that the payment
owner signs in before World ID is shown, state expiry, and ask the human to
approve in World App. Never request or reconstruct a raw proof.

If the payment returns `approval_ready` with no approval, call
`continue_payment` directly. Otherwise poll `get_payment` after approval and
continue when ready.

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

## 3. Understand the payment request

For an estimate, collect:

- source asset and chain, or source fiat currency;
- exact source or exact destination amount;
- destination asset/currency and country;
- optional routing preference.

Do not request, create, or pass a recipient merely to estimate a payment.
Collect the recipient or destination wallet only after the user elects to create
the reviewed route.

Routing preferences are:

```text
balanced
lowest_total_cost
fastest
highest_success_rate
```

Use `balanced` when the user gives no preference.

Do not silently split an amount, switch chains, change exactness, or choose a
different recipient.

## 5. Discover a supported route

Use `get_supported_payment_capabilities` only when explaining AgentBank's general
product capabilities. It does not decide whether a payment can proceed.

Call `list_quote_book_pairs` to inspect live direct add-money (`on_ramp`) and
send-money (`off_ramp`) corridors. Use a
matching live pair directly in `estimate_payment`; Core then validates the
amount-specific route and the user's rail readiness when creating the payment.

For fiat-to-fiat or source-token-to-fiat routing:

1. List relevant add-money (`on_ramp`) and send-money (`off_ramp`) pairs.
2. AgentBank composes supported two-leg routes through USDC on Worldchain automatically.
3. Call `estimate_payment` without an intermediate asset.
4. Prefer the requested route; otherwise compare executable outcomes including
   fees instead of comparing raw quote-book rates alone.

AgentBank's MCP plans supported two-hop routes through USDC on Worldchain. Do not
pass an intermediate asset or ask Core to select one.

Use `browse_quote_book` only for anonymous rough-rate or band discovery. Its
`rate` is raw. Read `fee_pct`, `flat_fee`, and `fee_ccy` together.
Respect `fee_calculation`: `additive` adds the percentage and flat components;
`max_percentage_or_flat` uses the larger component. Use the live estimate's
returned fees and effective amounts for confirmation, rather than inventing a
total from rough quote-book rates.

## 6. Estimate the complete payment

Call `estimate_payment` for every supported flow:

- direct add-money (`on_ramp`);
- direct send-money (`off_ramp`);
- pure same-chain crypto swap;
- fiat-to-fiat two-hop through USDC on Worldchain;
- Worldchain crypto-token-to-fiat two-hop through USDC on Worldchain.

For two hops, AgentBank uses USDC on Worldchain automatically. Do not provide a
recipient: estimates are recipient-free route previews.

When the payout instrument is already known, pass it as
`destination.payment_instrument` for instrument-specific terms. Omitting it
requests conservative terms across instruments. This does not require or
permit recipient details in the estimate. If the instrument changes after
review, obtain a fresh estimate and confirmation.

Treat the result as an ephemeral review preview:

- it has no estimate ID;
- it is not durable;
- it may create quote intents;
- it never creates approval, settlement, or execution calldata;
- `create_payment` live-validates the exact submitted quote references;
- its quote references can expire.

Reuse an `estimate_ready` result while the source, destination, amount, amount
mode, and route are unchanged and `expires_at` has not passed. After human
confirmation, attempt `create_payment` before any second estimate.
Do not call `estimate_payment` again merely because `create_payment` is next. The same rule
applies when `create_payment_plan` is next. Core's live validation during
creation does not require a second estimate call and never silently substitutes a replacement quote.
Re-estimate only when the estimate has expired, a material
payment input changes, or
`create_payment` returns `QUOTE_EXPIRED` or `PRICE_MISMATCH`; show the refreshed
summary and reconfirm before creation.

Require `status=estimate_ready`. Read:

- `source_amount`;
- `destination_amount`;
- fee and fee currency for every leg;
- effective request-specific amounts;
- expiry;
- route and intermediate amount;
- returned `hops`.

For a fiat destination, also read `recipient_requirements`. They are the
authoritative payoff-instrument choices and country-specific field contract.
Do not select a recipient or create a payment until the user chooses one of
them and supplies its required fields.

If the user wants to create the reviewed payment, collect or select the final
recipient now. A pure swap without a recipient uses the onboarding-bound wallet
internally; all other payment routes require a recipient in
`create_payment.destination`.

If no executable estimate is available, explain the blocking requirement and
stop or select another live route with the user's approval.

If `estimate_payment` returns `QUOTE_UNAVAILABLE` or
`status=estimate_unavailable`:

1. Call `browse_quote_book` for each matching direct leg. For a two-hop route,
   inspect the upstream and downstream legs separately.
2. Compare the requested effective amount with every live band's `min_amount`,
   `max_amount`, expiry, `fee_pct`, `flat_fee`, and `fee_ccy`. Raw `rate` alone
   does not establish that the requested amount is executable.
3. Explain whether there is no live band, the requested amount falls outside a
   band after fees, or the available quote expired. Do not invent a customer
   rate or imply that funds can be moved.
4. Call `check_verification_status` only when a response identifies KYC or rail
   readiness as a blocker, or when the human asks about it. Its `markets`
   result is not a live-corridor or quote-readiness result, so do not present it
   as the cause of `QUOTE_UNAVAILABLE`.
5. Ask the human whether to use an in-band amount or another supported route;
   obtain a fresh estimate after any change.

## 7. Confirm once

Show one complete summary before creating the payment:

```text
Recipient: [name/rail and sufficient destination details]
You send: [amount and asset]
Recipient receives: [amount and asset]
Fees: [each amount and its currency]
Route: [direct, swap, or source -> intermediate -> destination]
Estimate expires: [time]
Expected duration: [when available]
Material warnings: [only relevant warnings]
Recipient instrument: [qr, bank transfer, or mobile money]
```

Do not show a raw rate as the effective customer rate when fees change the
actual source/destination amounts.

Ask the human to confirm the complete payment. Reconfirm after any material
change to recipient, source amount, destination amount, fee, route, or expiry.

### Payment plan (multiple payments, one approval)

Use a payment plan only when the human wants to group several independently
settled payments under one approval. A plan does not combine funds,
recipients, or settlement instructions: every plan item remains a normal
payment and is continued independently.

1. Call `create_payment_plan` with a concise description of the intended
   batch and a new stable `request_id`.
2. Estimate every intended payment. Show one consolidated review containing
   each item's recipient, source/destination amount, fees, route, expiry, and
   material warnings. Obtain one explicit confirmation for the complete plan.
3. Call `create_payment` once per reviewed item with the returned `plan_id`, a
   unique `plan_position`, and a unique `request_id`. Plan-bound creates do
   not require `confirmed_by_user`; confirmation is supplied when submitting
   the complete plan.
4. Call `review_payment_plan` and ensure every intended item is present with
   the expected position and payment details. This reviews the durable plan;
   it does not replace an expired quote or revise a locked route.
5. Call `submit_payment_plan` with a new stable `request_id` and
   `confirmed_by_user=true`. It seals the plan permanently and, if required,
   returns the single approval URL for every item in the plan.
6. Show only that returned approval URL and expiry. After the human approves,
   use `get_payment` and then `continue_payment` for each ready payment using
   the normal individual-payment flow.

Never add, remove, or modify a plan item after submission. Cancel the plan
before funds move if the human abandons it. A plan can contain payments that
are continued concurrently, sequentially, or later; provider and wallet
capacity rules still apply to each actual payment.

## 8. Create and approve the durable payment

After confirmation, call `create_payment` with:

- a new stable `request_id`;
- `confirmed_by_user=true`;
- the reviewed source, destination, amount mode, and routing preference;
- the final recipient once in `destination.recipient_id` or
  `destination.recipient_fields`, when the route requires one;
- the recipient's `payment_instrument` inside its canonical `recipient_fields`
  when the selected quote exposed `recipient_requirements`;
- the exact `hops` returned by the current estimate.

Do not pass an estimate ID. None exists.

The returned hops contain route data only. For two-hop payments, the MCP
internally creates the linked Core structure:

- hop 0 is `on_ramp` or `on_chain_swap`;
- hop 1 is `off_ramp`;
- hop 0 receives `recipient_ref:{"hop_index":1}` internally;
- hop 1 receives the top-level destination recipient internally.

When the payment returns `approval_required`:

1. On a hosted MCP surface that exposes `show_payment_approval`, call it immediately with the returned
   `payment_id`; do not also print the approval link.
2. On clients without that tool, show `approval.approval_url`, the first-party action page.
3. State the approval expiry and ask the human to complete the approval on that
   page ("tap to approve").
4. Never request, print, reconstruct, or transmit a raw approval QR, verification
   URL, or proof.

Core requires human approval according to its payment rules and the calling
installation's threshold where applicable. Do not infer a fixed threshold: follow
the returned status.
When it returns `approval_ready` with `approval:null`, call
`continue_payment` with a new continuation request ID. When it returns
`approval_required`, wait for the human approval and call `get_payment` until
it returns `approval_ready`.

On hosted MCP surfaces, `continue_payment` renders a dedicated funding card.
That card owns the payment instruction and refreshes itself to funded, expired,
cancelled, or failed. Do not repeat its payment or action links in chat unless
the human asks for a link or reports that the card is unavailable. Fiat payment,
QR, mobile-money, and payment-link instructions must be funded through the
card; do not offer spending-limit funding. For `crypto_deposit` only, the result
carries `funding_options`: offer automatic spending-limit funding only when
`funding_options.spending_limit_available` is true, then stop and wait for a new
human response choosing the link or the spending limit. Earlier confirmation to
create, approve, or continue the payment does not authorize wallet funding. Do
not inspect spending limits, open their cards, set one, or fund in the same turn
as `continue_payment` or `get_payment_instruction`.

## 9. Follow the payment instruction

Read `payment_instruction` and `next_action` exactly.

### Two-hop funding invariant

For a linked two-hop payment, the agent acts only on the first/source hop and
then tracks the aggregate:

- API `hop_index:0` is the first upstream `on_ramp` or `on_chain_swap` hop.
- API `hop_index:1` is the downstream `off_ramp` hop.
- Core opens hop 1 first only to obtain its crypto deposit destination.
- Hop 0 is already bound to that destination through
  `recipient_ref:{"hop_index":1}`.
- Funding or executing hop 0 therefore delivers the intermediate crypto
  directly into hop 1. No second wallet transfer is required.

For fiat-to-fiat, ask the human to pay the source add-money instruction, then poll
`get_payment`. If a hosted user missed the funding card or asks to see the
instruction again, call `get_payment_instruction`; do not use `get_payment` to
reopen it. For crypto-token-to-fiat, execute the source swap instruction;
its output recipient is already the downstream send-money deposit, then poll
`get_payment`.

Never separately fund hop 1 after hop 0 is paid or executed. If a later payment
view exposes hop 1's crypto-deposit details while the linked payment is still
processing, treat them as internal routing/tracking context, not a new funding
request. A second manual transfer would duplicate funding. This rule overrides
the generic crypto-deposit instructions below for linked two-hop payments.

If `next_action.action_url` or `payment_instruction.presentation_url` exists,
use it for human-executed fiat funding such as bank transfer, QR, payment-link,
or mobile money. For `crypto_deposit` on local stdio, treat the page as optional
presentation; execute the exact instruction through the agent's local wallet
after confirmation.

### Fiat funding

For add-money bank, QR, payment-link, or mobile-money instructions:

1. Show the server-issued `presentation_url` or `next_action.action_url`, exact
   amount, currency, and expiry.
2. When `pay_to.qr_content` is present, treat it as the canonical QR payment
   payload. Never alter, reconstruct, or generate a replacement payment
   payload. `qr_url`, when present, is optional presentation metadata.
3. An image-capable app may render the unchanged `qr_content` as a QR for
   display only. A terminal client should print the action link and a copyable
   `qr_content`; it must not shell out to generate a QR image.
4. Ask the human to complete the fiat payment.
5. Do not call `execute_payment_instruction` for fiat funding.
6. Poll `get_payment` after the human pays.

### Crypto deposit funding

For a direct one-hop send-money crypto deposit:

1. **Local stdio:** show the exact chain, asset, amount, full destination,
   memo/reference, and expiry. **Hosted OAuth:** show `display.summary` (what
   the recipient gets, what the human pays in dollars, fee, validity) and the
   single "tap to approve" link; never the chain, asset or destination address.
2. **Local stdio:** do not ask the human to open a frontend page. Check
   `get_wallet_balances`, obtain confirmation, then call
   `execute_payment_instruction` with the current instruction ID and stable
   request ID. Reuse that same request ID while execution remains pending.
3. **Hosted OAuth:** read `funding_options` on the instruction result. When
   `spending_limit_available` is true, ask one question: pay within the
   spending limit, or approve via the link. Only after a new human response
   explicitly chooses the spending limit, call `pay_within_spending_limit` with
   the payment ID, the current instruction ID, `funding_options.account_id`, a
   stable request ID, and `confirmed_by_user=true` (its inputs are exactly
   `request_id`, `payment_id`, `instruction_id`, `account_id`,
   `confirmed_by_user`). Reuse the same request ID while execution remains
   pending. When `spending_limit_available` is false (`reason` is
   `no_spending_limit`, `spending_limit_pending_activation`,
   `spending_limit_scope_mismatch` or `spending_limit_lookup_failed`), do not
   offer automatic funding: send the human to the link, and do not call the
   payment blocked while manual funding remains available. If the reason is a
   pending activation, mention that activating the spending limit
   (`show_spending_limit`) lets future payments go through without a link;
   otherwise offer `set_spending_limit` after this payment completes. Do not
   call `list_spending_limits` or `get_spending_limit` to re-derive what
   `funding_options` already states.
4. In either surface, never construct ERC-20 calldata or submit a replacement
   wallet transaction. Continue polling `get_payment`; Core tracks the deposit
   independently.

Never send a rounded amount when the instruction requires an exact amount.

Core requests gas sponsorship only when the bound wallet is AgentKit verified.
Otherwise `execute_payment_instruction` automatically submits from the same
local wallet address without sponsorship. Check the native balance along with the payment
asset balance because the wallet must pay gas in that mode.

### Pure swap or swap hop

For `payment_instruction.type=swap_execution`:

1. Read only the fresh execution returned by `continue_payment`/`get_payment`.
2. Show the confirmed source ceiling, destination amount, asset, chain, and
   recipient. Do not expose or ask the human to validate raw calldata.
3. **Local stdio:** call `execute_payment_instruction` with the payment ID,
   current instruction ID, stable request ID, and `confirmed_by_user=true`.
4. **Hosted OAuth:** send `transaction_signing_url` as "tap to pay"; swap
   execution requires the owner to confirm on that first-party page. Do not request a
   spending limit or call `pay_within_spending_limit` for a swap.
5. Core checks the current allowance and submits an exact approval only when
   needed, immediately rechecks allowance before the swap, executes the pinned
   swap, and submits the final hash for verification.
6. For local stdio execution, if it is pending, call
   `execute_payment_instruction` again with the
   same request ID. Never rotate the request ID after an ambiguous submission.
7. Poll `get_payment` while Core verifies the transaction.

Do not invent calldata, allowance targets, token contracts, or amount ceilings.
For exact destination, never spend more than the confirmed source ceiling.


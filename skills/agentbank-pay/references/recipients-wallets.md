## 4. Resolve the recipient

For a saved destination:

1. Call `list_recipients`.
2. Reuse a record only when the user request clearly matches its rail and
   canonical fields.
3. Call `get_recipient` when full fields are needed.
4. Ask the human to choose when multiple records match.

Do not describe a recipient as invalid solely because `verified` is false.
That flag means verified holder metadata has not been established; route and
partner validation remain authoritative.

For a new fiat or crypto recipient, call `create_recipient` with one or more of:

- canonical `fields`;
- structured `bank_info`;
- labeled `pasted_text`;
- raw `qr_content`;
- a QR image.

For every fiat recipient, first read the final quote's
`recipient_requirements`, choose exactly one listed `payment_instrument`, and
pass it to `create_recipient`. Never infer the instrument from the presence of
a QR or bank fields. Follow the returned requirements; common field shapes are:

```text
qr:             country + qr_content
pix:            country + pix_key + holder_name (city when required)
bank_transfer:  country + bank_name + account_number + holder_name
ach:            country + bank_name + bank_code + account_number + account_type + holder_name + street1 + city + region + postal_code
mobile_money:   country + mobile_money_network_code + mobile_money_destination
venmo:          country=US + venmo_phone
paypal:         country=US + paypal_email + holder_name
```

For ACH, `account_type` is `checking` or `savings`; submit the human-provided
bank code and address fields required by the quote. For Pix, use `pix_key`
under the `pix` instrument, not an inferred bank-transfer or QR recipient.
Only offer instruments advertised by the current route. Pass Venmo/PayPal
canonical fields through `fields`; `bank_info` does not expose those keys.

`mobile_money_destination` is an opaque provider-validatable value. Do not
force E.164 and do not collect `holder_name` unless a future quote explicitly
requires it. If the chosen bank-transfer requirement sets
`holder_name_must_match_kyc=true`, explain that the submitted holder must equal
the user's verified KYC legal name; do not request or disclose that KYC name.

Before collecting or creating a `bank_transfer` recipient, call
`get_supported_bank_names` for the final fiat rail when that tool is available.
Use its matching canonical value as `bank_name`. If the lookup is unavailable
or the rail publishes no directory, submit the human-provided bank name to
`create_recipient`; Core remains the authority that validates or canonicalizes
it. Never refuse a bank transfer or demand a QR solely because canonical bank
lookup is unavailable.

For a curated fiat rail, collect a non-empty `holder_name` from the human in addition to the QR,
bank details, or payment key. This is an unverified payout detail. Do not infer it from an EMV QR
display label. For direct bank transfers, use the bank name returned by
`get_supported_bank_names` when available, otherwise let `create_recipient`
validate the human-provided name. QR-derived bank metadata is separate.

When the human sends recipient information through chat as an image, raw QR
payload, pasted bank text, account/holder details, or structured bank data,
call `create_recipient` before `create_payment`. Use the
returned `recipient_id` or canonical `recipient_fields`; do not manually copy
unvalidated image/QR fields directly into a payment request.

For local stdio, an image may use an absolute `image.path`. Remote clients use
`image.data_base64`. The image must contain a readable QR. If it is a text-only
screenshot, pass the visible details as `pasted_text` or `bank_info`; OCR is not
implemented.

If `create_recipient` returns `information_required`, ask only for the listed
missing or invalid fields and retry with the same request ID only if the payload
is unchanged. Use a new request ID after adding or changing fields.

On success, use either the returned `recipient_id` or canonical
`recipient_fields` only in `create_payment.destination`.

Use `update_recipient` only after the human confirms the replacement fields.
It creates a replacement record; it does not edit or revoke the old record.

For a top-up into the user's own AgentBank balance: on local stdio, call
`list_wallets` and use the active wallet address for the dollar balance as the
crypto recipient. On hosted OAuth, call `get_account_reference`; the top-up payment's
funding instruction returns the deposit details itself, so never ask the human
for an address. Never ask for a private key.


# Changelog

All notable user-visible changes are recorded here.

This project follows [Semantic Versioning](https://semver.org/).

## [1.4.0] - 2026-08-24

### Added

- Added the five-tool payment-plan workflow for grouping multiple independent
  payments under one reviewed World ID approval.
- Added terminal pre-funding expiry recovery and richer timeline guidance.

### Changed

- Updated the release contract to `agent-bank-mcp@0.1.25` and its exact
  43-tool production catalog.
- Replaced public fiat `bank_code` input guidance with quote-driven
  `payment_instrument` and human-confirmed `bank_name` handling.
- Updated onboarding recovery, Linux vault security, on-ramp-first World ID
  behavior, approval cancellation, and owner-scoped sibling recovery.

## [1.3.0] - 2026-08-06

### Changed

- Added quote-driven fiat recipient instruments and field requirements from the
  merged AgentBank MCP 0.1.19 contract.
- Updated the latest-package installation and release gate for the 0.1.19
  contract.

## [1.2.0] - 2026-08-06

### Changed

- Updated setup and smoke verification to the audited `agent-bank-mcp@0.1.17`
  credential-vault release.
- Added same-client post-restart onboarding verification and recovery guidance
  that prevents duplicate installations when local credential storage fails.
- Published the deterministic per-profile vault and managed-storage guidance in
  the canonical and single-file compatibility skill.

## [1.1.1] - 2026-08-06

### Changed

- Made the public single-file skill self-contained: it now uses inspect-first
  Codex and Claude Code setup commands rather than referring to an unavailable
  local bootstrap script.
- Removed duplicated setup content from the compatibility artifact and kept it
  within the Agent Skills progressive-disclosure size recommendation.
- Recorded public-skill releases as immutable version labels instead of a
  mutable branch name when the landing sync runs manually.

## [1.1.0] - 2026-08-04

### Added

- Per-installation World ID approval-policy guidance and tool-catalog checks.
- Quote-unavailable recovery using executable quote-book bands and fees.
- Protocol-core drift tracking and clean-install smoke tests.
- Support, security, and contributor documentation for public distribution.

### Changed

- Estimates are recipient-free; the selected recipient is supplied once to
  `create_payment.destination` after route review.
- Public payment hops contain route data only; MCP injects recipient plumbing.
- Recipient guidance covers bank-name canonicalization and the system-created
  human-owner-scoped default Privy wallet recipient.
- World ID behavior follows the current installation policy and returned
  payment status instead of assuming a universal threshold.
- The supported Node.js floor is 22.20 to match the current Skills CLI.
- Explicit compatible endpoint configurations now use
  `https://app.agentbank.world` instead of the retired staging app domain.

## [1.0.0] - 2026-07-30

### Added

- Initial `agentbank-pay` skill for Codex, Claude Code, and Hermes.
- Conflict-safe MCP bootstrap, modular workflow references, deterministic
  legacy export, and automated validation.

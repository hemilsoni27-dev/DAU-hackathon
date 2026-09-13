# Domain boundaries

## Energy

Owns generation, consumption, surplus, and allocation safety. Marketable
surplus is `max(generation - consumption, 0)` and is represented with scaled
integer arithmetic in the domain helper.

## Grid

Owns deterministic prototype thresholds and returns `APPROVED`, `ADJUSTED`, or
`RESTRICTED`. Thresholds belong in a dedicated service so they are not
duplicated across controllers.

## Marketplace and matching

Listings belong to a solar-system owner and must have a positive quantity and
valid availability window. Match ranking is multi-factor: price, quantity,
proximity, reliability, and grid suitability.

## Identity and policy

Clerk is the intended external identity provider. The application maps an
authenticated identity to one of the platform roles: PROSUMER, CONSUMER,
UTILITY, REGULATOR, or ADMIN. Role checks are centralized and ready for future
attribute-based policy evaluation.

## Persistence and events

PostgreSQL owns durable state. Redis and future Socket.IO events can accelerate
coordination, but the required sequence is persist → commit → emit.
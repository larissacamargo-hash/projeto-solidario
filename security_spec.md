# Security Specification — Projeto Solidário Tech

## 1. Data Invariants
1. Every document in `inventory`, `donations`, and `distributions` must belong to a verified authenticated user (`ownerId == request.auth.uid` and `request.auth.token.email_verified == true`).
2. `availableQty`, `totalReceived`, and `totalDistributed` on `InventoryItem` can never be negative, and `totalReceived >= totalDistributed`.
3. A `Donation` cannot exist without a valid `inventoryItemId` referencing an `InventoryItem` owned by the same user (`existsAfter` + `getAfter`).
4. A `Distribution` cannot exist without an existing `InventoryItem` owned by the same user (`exists` + `get`), and `quantity` must be `>= 1`.
5. `createdAt` and `updatedAt` must strictly match `request.time`. `ownerId` and `createdAt` are immutable after creation.
6. Document IDs must match `^[a-zA-Z0-9_-]+$` and be `<= 128` characters.

## 2. Adversarial Test Matrix (Dirty Dozen)
1. Unauthenticated read/write to `/inventory/item-1` -> `PERMISSION_DENIED`.
2. Unverified email write (`email_verified: false`) -> `PERMISSION_DENIED`.
3. Identity spoofing (`ownerId` != `request.auth.uid`) -> `PERMISSION_DENIED`.
4. Blanket list query without `ownerId == request.auth.uid` filter -> `PERMISSION_DENIED`.
5. Shadow field injection (`isAdmin: true`) on create or update -> `PERMISSION_DENIED`.
6. Negative `availableQty: -5` on inventory -> `PERMISSION_DENIED`.
7. Client-forged timestamp (`createdAt` != `request.time`) -> `PERMISSION_DENIED`.
8. Oversized string (`itemName` > 120 chars or `notes` > 500 chars) -> `PERMISSION_DENIED`.
9. Malformed ID injection (`1.5KB` path variable) -> `PERMISSION_DENIED`.
10. Orphaned `Distribution` referencing non-existent `inventoryItemId` -> `PERMISSION_DENIED`.
11. Cross-user `Distribution` referencing another user's `inventoryItemId` -> `PERMISSION_DENIED`.
12. Mutating immutable `ownerId` or `createdAt` during inventory update -> `PERMISSION_DENIED`.

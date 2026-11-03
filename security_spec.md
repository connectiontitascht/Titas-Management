# Security Specification: Transaction fortress rules

## Data Invariants
1. A transaction can only belong to a signed-in user (`request.auth.uid == incoming().userId`).
2. A user can only read, create, update, or delete their own transactions (`resource.data.userId == request.auth.uid`).
3. Transactions must have a valid non-empty title (size <= 100 characters), amount > 0, types strictly limited to 'income' or 'expense', and valid categories.
4. Document IDs must conform to alphanumeric characters and be bounded in size to prevent DDoS resource exhaustion (`isValidId(transactionId)`).
5. Immutable fields like `createdAt` and `userId` must remain constant during updates.
6. Timestamp fields must correspond directly to the official server context `request.time`.

## The "Dirty Dozen" Payloads (Anti-Vulnerabilities Test Suite)

1. **Anonymous Spoofing:** Create a transaction without being logged in.
2. **Identity Theft (Foreign Write):** Try to create a transaction with `userId` of another registered user.
3. **Identity Theft (Foreign Modification):** Try to read or update another user's existing transaction.
4. **Identity Theft (Foreign Deletion):** Try to delete another user's transaction.
5. **DDoSv2 ID Poisoning:** Try to write a document with an ID that is 2000 characters long.
6. **Negative Value / Overflow Injection:** Set `amount` to `-1` or `-1000`.
7. **Malformed Schema Injection (Ghost Fields):** Try to pass extra variables like `isApprovedByAdmin: true` into the payload.
8. **Invalid Category Type:** Pass a non-string or unlisted random category.
9. **Spoofed Creation Timestamp:** Supply a hardcoded client date as `createdAt` instead of using the server timestamp.
10. **Immutable Hijack:** Try to change the `userId` field to a different user's ID during update.
11. **Immortality Leak:** Try to change `createdAt` of a transaction during update.
12. **Blanket Query Scraping:** Attempt to query `/transactions` without a `where` filtering constraint matching the logged-in user's UID.

## Test Runner Design
The `firestore.rules` will be validated dynamically via ESLint rules configurations and tested rigorously through our UI flow. All test cases matching the payloads above will receive direct standard `PERMISSION_DENIED` errors on client-sdk bypasses.

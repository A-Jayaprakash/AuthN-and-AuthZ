# AuthN & AuthZ — Node + MongoDB E-Commerce Backend

A reference implementation of authentication and authorization in a Node.js + Express + MongoDB backend. This isn't a tutorial-grade auth demo — it's a full working e-commerce API (users, categories, products, cart, orders) built specifically to exercise every major AuthN/AuthZ concept end-to-end, with every design decision made deliberately and every hardening measure actually tested, not just written.

This README is written to double as interview prep: each section explains not just *what* was built, but *why*, and *what the tradeoff was against the alternative*.

## Tech Stack

- **Runtime:** Node.js, Express.js
- **Database:** MongoDB Atlas, Mongoose ODM
- **Auth:** JWT (access + refresh token pair), bcrypt for password hashing
- **Validation:** Joi
- **Email:** Nodemailer (Gmail SMTP)
- **Logging:** Winston
- **Error handling:** Centralized (`AppError` + `asyncHandler` + `errorHandler`)

## Project Structure

```
config/         # MongoDB connection, startup env validation
controllers/    # Business logic per resource
middleware/     # auth, admin, validate, rateLimiter, errorHandler
models/         # Mongoose schemas
routes/         # Express routers
validators/     # Joi schemas per resource
utils/          # AppError, asyncHandler, tokens, cookieOptions, email, logger
server.js       # Entry point
```

---

## Part 1 — Core Architecture

### 1. AuthN vs AuthZ are two separate concerns, two separate middleware

- `auth.js` — **authentication**. Verifies the JWT's signature and expiry, attaches `req.user = { id, role }`. Answers *"who is this?"*
- `admin.js` — **authorization**. Reads `req.user.role`, allows or blocks. Answers *"are they allowed to do this?"*

`admin.js` always runs *after* `auth.js`, since it depends on `req.user` already being set — authorization is meaningless without a prior identity check. The two also return different status codes on purpose: `401` when the request has no valid identity at all, `403` when the identity is known but not permitted. Conflating these is a common mistake — a client (or a person debugging) needs to know whether to re-authenticate or simply stop trying.

**Interview answer:** *"I split authentication and authorization into two middleware because they answer different questions and fail for different reasons — a 401 means try logging in again, a 403 means you're logged in but this isn't for you. Authorization also always runs after authentication in the chain, since you can't check permissions for an identity you haven't established yet."*

### 2. Ownership checks live in the controller, not the middleware

Some routes need "self OR admin" logic — a user viewing/editing their own profile, or their own orders — which a binary `admin` middleware can't express (it only knows *role*, not *whose resource this is*). The rule used throughout: role-based gating happens in route middleware (cheap, doesn't need the resource loaded yet); ownership gating happens inside the controller, once the specific document has been fetched from the DB:

```js
if (req.user.id !== resource.user.toString() && req.user.role !== 'admin') {
  throw new AppError('Not authorized...', 403);
}
```

**Tradeoff:** this means authorization logic is split across two layers instead of one. The alternative — a smarter, resource-aware middleware — was considered and rejected, since it would need to know how to load every different resource type, coupling middleware to domain models it shouldn't need to know about.

### 3. Soft delete over hard delete

`User`, `Product`, and `Category` all use an `isActive` flag instead of real deletion. `Order` documents reference `user`, `product`, and (via `product`) `category` — a hard delete would leave dangling references inside historical, financially-relevant records. "Deleting" something just deactivates it; listings filter on `isActive: true`, but past orders retain intact references to the original documents.

`Order` itself is never hard-deletable at all — "deleting" an order sets `status: 'cancelled'`, and only while the order hasn't already shipped (cancelling a physically shipped package makes no sense).

**Tradeoff:** soft delete means every read query needs to remember to filter on `isActive: true` — forgetting this filter anywhere is a latent bug (a deactivated product silently reappearing in listings). Hard delete would avoid that risk entirely, but at the cost of breaking referential integrity on every past order the moment a referenced document is removed.

### 4. Price snapshotting on orders

`Order.items` stores `priceAtPurchase` separately from the live `Product.price`. Product prices change over time; a receipt must reflect what was actually paid, not what the product costs today. Never trust a live foreign-key lookup for historical financial records — snapshot at the moment of the transaction.

### 5. Centralized error handling — `AppError` + `asyncHandler` + `errorHandler`

Three pieces that together eliminate repeated `try/catch` + `res.status().json()` boilerplate in every controller:

- **`AppError`** — a custom `Error` subclass carrying `message`, `statusCode`, and `isOperational: true`. Controllers `throw` this instead of building a response inline.
- **`asyncHandler`** — wraps every async controller. Express's built-in error handling only catches *synchronous* throws inside route handlers — a rejected Promise from an `async` function is invisible to Express unless something explicitly forwards it via `next(err)`. `asyncHandler` does exactly that: `Promise.resolve(fn(...)).catch(next)`.
- **`errorHandler`** — the single middleware (mounted last, after all routes) that receives every forwarded error, reads its `statusCode` (defaulting to `500` for anything unexpected), and sends one consistent JSON response shape for the entire app. It also translates Mongoose/MongoDB-native errors (`ValidationError`, duplicate key `11000`, `CastError`) into proper client-facing status codes instead of leaking raw `500`s for things that are really the client's fault (like a malformed ObjectId).

**Interview answer:** *"Express doesn't natively catch errors thrown inside async functions — a throw inside an async controller just becomes an unhandled promise rejection unless something calls next(err) for you. asyncHandler is a higher-order function that wraps every controller so any rejection gets forwarded automatically, which means no controller ever needs its own try/catch."*

### 6. Preventing user enumeration (message-level)

`login` returns the exact same message — `"Invalid email or password"` — whether the email doesn't exist or the password is simply wrong. Distinguishing the two in the response text would let an attacker silently build a list of every registered email before ever attempting to guess a password.

### 7. Atomic checkout via MongoDB transactions

`createOrder` validates stock availability across every cart item *before* mutating anything, then — inside a `mongoose.startSession()` transaction — decrements stock, creates the order, and clears the cart as one atomic unit. If any step fails partway through, the whole transaction rolls back rather than leaving stock silently decremented with no order to show for it.

**Tradeoff / real constraint:** transactions require MongoDB running as a replica set. Atlas clusters are replica sets by default, so this works out of the box on Atlas — but a plain local standalone `mongod` is not a replica set and would need `--replSet` explicitly enabled to support this at all. This is a genuine infrastructure dependency worth knowing, not just a code detail.

---

## Part 2 — Security Hardening (12 items, all implemented and manually tested)

Each item below states the vulnerability it closes, the fix, and the tradeoff accepted in exchange — the three things worth being able to explain about *any* security decision.

### 1. Hiding internal errors from unexpected failures

**Problem:** `errorHandler` originally sent `err.message` to the client unconditionally. For an `AppError` you threw deliberately, that's fine — but for a genuine unexpected bug, `err.message` might leak internal details (stack fragments, driver-specific wording).
**Fix:** check `err.isOperational` — if the error wasn't a deliberate `AppError` and the status is `500`, override the message with a generic one regardless of what the real error says.
**Tradeoff:** none, really — pure upside. The only cost is remembering that debugging now depends on logs rather than the client response, which is exactly what item #2 below solves.

### 2. Structured logging (Winston)

**Problem:** once real error messages are hidden from clients, *someone* still needs visibility into what actually broke.
**Fix:** Winston logger, split by severity — `warn` for operational/expected failures (`AppError` instances, like "wrong password"), `error` for genuine unexpected bugs — written to `logs/error.log` (errors only) and `logs/combined.log` (everything). `logs/` is gitignored; log files are runtime output, not source.
**Why not just `console.error`:** it disappears on every process restart and doesn't distinguish severity, making it useless for spotting real problems in a sea of routine client mistakes.
**Tradeoff:** file-based logging on a single machine doesn't scale to a multi-instance deployment — a real production system would ship these to a log aggregation service (Datadog, CloudWatch) instead. Noted as a known limitation, not solved here.

### 3. Startup environment validation

**Problem:** a missing or misspelled `.env` variable (e.g. `JWT_SECRET`) previously surfaced as a confusing, deep stack trace the first time something tried to use it — often far from where the actual problem was.
**Fix:** `config/validateEnv.js` checks every required variable exists before the server does anything else — including before connecting to the DB — and calls `process.exit(1)` with a clear message if anything is missing. Also warns (not fails) if `JWT_SECRET` is shorter than the recommended 32 characters.
**Interview answer:** *"Fail fast and loud at startup, rather than fail confusingly later at the exact moment some code path first touches the missing variable."*

### 4. Input validation (Joi)

**Problem:** nothing stopped a malformed email format, a negative price, an invalid ObjectId string, or a zero/negative quantity from reaching a controller — Mongoose's own type-casting caught some of this, but with unclear error messages and only after the request had already reached the database layer.
**Fix:** every route accepting a body is validated by a Joi schema (`middleware/validate.js` + one schema file per resource in `validators/`) *before* the controller runs at all.
**Tradeoff:** more files, more schema-maintenance overhead — a shared `addressSchema.js` was factored out for the nested address shape used in three different places, specifically to avoid three copies of the same rules drifting out of sync.

### 5. Password strength policy

**Fix:** `registerSchema`'s password field enforces a minimum of 8 characters plus at least one uppercase letter, one lowercase letter, one digit, and one special character, via a single regex using lookaheads.
**Worth knowing for an interview:** modern NIST guidance actually leans toward *length* over forced complexity — this project chose the more traditional complexity-enforced approach deliberately, as the more commonly-expected pattern, while being aware it's a debated tradeoff, not an uncontested best practice.

### 6. Rate limiting (`express-rate-limit`)

**Problem:** `/login` and `/register` had no limit on attempts — trivial to script thousands of password guesses per minute, or spam-register accounts.
**Fix:** IP-based limiter — 5 attempts per 15 minutes on `/login`, 5 per hour on `/register` — applied *before* Joi validation in the middleware chain (no point validating a request about to be rejected anyway).
**Tradeoff:** the default store is in-memory, tied to a single Node process. Behind a load balancer with multiple server instances, each instance tracks its own counter — meaning an attacker could get roughly `5 × instance_count` attempts by hitting different instances. A production deployment would need a shared store (Redis, via `rate-limit-redis`) for this to hold under horizontal scaling. Known, documented limitation.

### 7. Account lockout (distinct from rate limiting)

**Problem:** IP-based rate limiting doesn't stop a distributed attack — many different IPs (a botnet, rotating proxies) each independently under the per-IP threshold, all targeting the same account.
**Fix:** `User` tracks `failedLoginAttempts` and `lockUntil`. After 5 failed attempts *on that specific account*, regardless of source IP, the account locks for 15 minutes. Resets to zero on a successful login.
**Interview answer — the tradeoff worth stating out loud:** this introduces a denial-of-service angle of its own — anyone who merely knows a victim's email (not their password) can deliberately fail 5 logins and lock the real user out of their own account for 15 minutes, purely out of spite. This is a well-known, broadly accepted tradeoff: brute-forcing a password now costs an attacker real time for very few attempts, which is judged worth the mild inconvenience risk to legitimate users.

### 8. Timing-attack mitigation on login

**Problem:** `bcrypt.compare()` — deliberately slow by design — was previously only called when a user record existed. A request against a real, registered email therefore took measurably longer to respond than one against a nonexistent email, even though both returned an identical error message. Response-time measurement is a subtler version of user enumeration that message-text alone (item 6, Part 1) doesn't close.
**Fix:** `bcrypt.compare()` now runs unconditionally on every login attempt — comparing against a hardcoded dummy hash when no real user exists — so the expensive step always happens regardless of which branch the request will ultimately take.
**Non-obvious bug this created, worth mentioning as a war story:** merging this with the existing account-lockout logic initially broke lockout entirely — an early combined `if (!user || !match)` check caused the "wrong password" path to short-circuit before ever reaching the `failedLoginAttempts` increment, silently making the whole lockout feature dead code. The fix was splitting the early-exit back into two separate checks (`!user` alone, then the match check further down after the lockout/isActive checks) so both features could coexist. **Lesson:** layering multiple hardening features onto the same function requires explicitly re-verifying each new feature against the ones already in place — they don't compose for free.

### 9. `helmet` + restrictive CORS

**Fix:** `helmet()` sets a batch of hardening HTTP response headers (MIME-sniffing protection, clickjacking protection, etc.) with sensible defaults. CORS is restricted to a specific `CLIENT_URL` origin (read from env) rather than the wide-open default of allowing any origin, with `credentials: true` enabled since the refresh-token cookie requires it.

### 10. Refresh token rotation (access + refresh token pair)

**Problem:** the original design issued one JWT with a flat 7-day expiry, with no way to revoke it early — if it leaked (XSS, a shared machine), it stayed valid for up to a week regardless of anything the server could do.
**Fix:** two tokens now. An **access token** (`~15 min`, unchanged verification logic in `auth.js`) used for normal API calls, and a **refresh token** (`~7 days`, signed with a *separate* secret, `JWT_REFRESH_SECRET`) used only to obtain a new access token. The refresh token's **hash** (never the raw value) is stored on the `User` document; every refresh call re-hashes the incoming token and compares it against the stored hash.
**Rotation, specifically:** every successful `/refresh` call issues a *brand new* refresh token and immediately overwrites the stored hash. This means a previously-valid refresh token becomes provably worthless the instant the legitimate user refreshes once — even though the old token's JWT signature is still technically intact and would still pass `jwt.verify()` on its own; the hash comparison against the (now-different) stored value is what actually rejects it. **This was manually tested**: captured an old refresh token, rotated via a legitimate refresh, then replayed the old token — confirmed `401 Invalid refresh token`.
**Why a different hash algorithm than passwords:** refresh tokens use SHA-256, not bcrypt. Bcrypt's deliberate slowness exists to make brute-forcing a low-entropy *human* password expensive; a refresh token is already a long, cryptographically random string with nothing to "guess," so a fast hash is sufficient and avoids unnecessary CPU cost on every refresh call.

### 11. httpOnly cookies for the refresh token

**Problem:** returning any long-lived token in a JSON response body means the frontend has to store it somewhere itself — almost always `localStorage`, which any JavaScript running on the page (including an injected XSS payload) can read outright.
**Fix:** the refresh token is set as an `httpOnly`, `secure` (in production), `sameSite: 'strict'` cookie, scoped to `path: '/api/auth'` only — meaning it's attached automatically by the browser to auth-related requests, and is completely inaccessible to any JavaScript, including the site's own frontend code.
**Why the access token still goes in the JSON body:** its short 15-minute lifespan makes it low-value if intercepted, and the frontend needs to read it to attach it as an `Authorization: Bearer` header on regular API calls — an httpOnly cookie *can't* be read for that purpose, so it wouldn't work as the access-token delivery mechanism anyway. This is the correct division of labor between the two tokens, not an inconsistency.

### 12. Email verification, gating login

**Problem:** any email address, real or fake, previously got a fully active account instantly on registration.
**Fix:** registration generates a random verification token (`crypto.randomBytes`, not a JWT — this token carries no payload, it only needs to prove "whoever clicked this link controls this inbox"), stores its **hash** with a 24-hour expiry, and emails the **raw** token as a link via Nodemailer/Gmail SMTP. `login` is blocked with a `403` until `emailVerified` is `true`. A `resend-verification` endpoint re-issues a fresh token if the original expires or is lost — deliberately returning an identical, generic success message whether or not the submitted email actually exists in the system, for the same enumeration-prevention reason as login.
**Design decision explicitly made and worth defending in an interview:** if the verification email fails to send (SMTP outage, bad credentials), the *entire registration is rolled back* — the newly created user document is deleted, and the client gets a clean `500` telling them to retry, rather than silently leaving behind an account that can never be verified. The alternative (let registration succeed regardless, log the email failure, and let the user use "resend" later) is also legitimate and used by many real products — this project chose the stricter option deliberately, prioritizing "no unverifiable accounts ever exist" over "never lose a signup to a transient infrastructure hiccup."
**Tradeoff on the email provider itself:** Gmail SMTP is used here because it's free and requires no third-party signup for a personal project — but it has real sending-volume limits and isn't the standard choice for production (a dedicated transactional email service like Resend, SendGrid, or Postmark would be used instead in a real deployment).

---

## Environment Variables

See `.env.example` for the full list. Never commit `.env` — it's excluded via `.gitignore`.

```
PORT=
MONGO_URI=
JWT_SECRET=
JWT_EXPIRE=
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRE=
CLIENT_URL=
NODE_ENV=
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=
```

`JWT_SECRET` and `JWT_REFRESH_SECRET` must be different values — generate each with:
```bash
openssl rand -hex 32
```

`EMAIL_PASS` is a Gmail **App Password** (requires 2-Step Verification enabled on the account), never the actual account password.

## Running Locally

```bash
npm install
cp .env.example .env   # then fill in real values
npx nodemon server.js
```

## API Overview

| Resource | Base path | Notes |
|---|---|---|
| Auth | `/api/auth` | register, login, me, refresh, logout, verify-email, resend-verification |
| Users | `/api/users` | self-or-admin ownership rules |
| Categories | `/api/categories` | public read, admin write |
| Products | `/api/products` | public read w/ filtering & pagination, admin write |
| Cart | `/api/cart` | private, per-user |
| Orders | `/api/orders` | private + admin views, transactional checkout |

## Known Limitations (Deliberate, Not Oversights)

- **Rate limiting is in-memory** — doesn't hold correctly across multiple server instances behind a load balancer without a shared store like Redis.
- **Gmail SMTP for email** — fine for a personal project, not how a real production system would send transactional email at volume.
- **No multi-device session management** — a single `refreshTokenHash` per user means logging in on a new device invalidates the previous device's refresh token. A production system supporting multiple simultaneous sessions would need a separate `RefreshToken` collection (one document per device/session) rather than a single field on `User`.
- **No CSRF token beyond `sameSite: 'strict'`** — the cookie's `sameSite` setting handles the common case, but a defense-in-depth production setup would typically pair this with an explicit CSRF token for state-changing requests too.

Each item above is a genuine, understood scope boundary — not a gap that was missed.

# AuthN & AuthZ — Node + MongoDB E-Commerce Backend

A reference implementation of authentication and authorization patterns in a Node.js + Express + MongoDB backend, built as a hands-on companion to accompanying notes on AuthN/AuthZ concepts. This isn't just a working e-commerce API — it's a deliberate walkthrough of *why* each security and architecture decision was made, so it can be revisited later as a lookup reference.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (Atlas) with Mongoose ODM
- **Auth:** JWT (stateless) + bcrypt for password hashing
- **Error handling:** Centralized (`AppError` + `asyncHandler` + `errorHandler`)

## Project Structure

```
config/         # MongoDB connection
controllers/    # Business logic per resource
middleware/     # auth, admin, errorHandler
models/         # Mongoose schemas
routes/         # Express routers
utils/          # AppError, asyncHandler
server.js       # Entry point
```

## Core Design Decisions

### 1. Stateless JWT authentication — no DB lookup per request

`auth.js` verifies the JWT signature and expiry on every request using `jwt.verify()`, without querying the database to re-check the user. The tradeoff: fast, cheap auth on every request, but no way to instantly revoke a token before it naturally expires (e.g. if a user is banned mid-session).

**Where the DB *is* checked:** only once, at `login`, using `bcrypt.compare()` against the stored hash. That's the one moment identity is genuinely established — every request afterward just proves "I hold a validly signed token," not "I re-proved who I am."

### 2. AuthN vs AuthZ — two separate middleware

- `auth.js` — **authentication**. Verifies the JWT, attaches `req.user = { id, role }`. Answers "who is this?"
- `admin.js` — **authorization**. Reads `req.user.role`, allows or blocks. Answers "are they allowed to do this?"

`admin.js` always runs *after* `auth.js` in the middleware chain, since it depends on `req.user` already being set. Returns `401` (unauthenticated) vs `403` (authenticated but not permitted) — deliberately distinct, since they mean different things to a client.

### 3. Ownership checks live in the controller, not the middleware

Some routes (e.g. viewing/editing your own profile, your own orders) need "self OR admin" logic — something a binary `admin` middleware can't express. Rule of thumb used throughout: general role gating happens in route middleware; per-resource ownership gating happens inside the controller, once the specific document is loaded:

```js
if (req.user.id !== resource.user.toString() && req.user.role !== 'admin') {
  throw new AppError('Not authorized...', 403);
}
```

### 4. Soft delete over hard delete

`User`, `Product`, and `Category` all use an `isActive` flag instead of real deletion. Reasoning: `Order` documents reference `user`, `product`, and (via `product`) `category` — a hard delete would leave dangling references in historical, financially-relevant records. "Deleting" something just deactivates it; listings filter on `isActive: true`, but past orders keep intact references.

`Order` itself is never hard-deletable — "deleting" an order sets `status: 'cancelled'`, and only while the order hasn't already shipped.

### 5. Price snapshotting on orders

`Order.items` stores `priceAtPurchase` separately from the live `Product.price`. Product prices change over time; an order must reflect what was actually paid, not what the product costs today. Never trust the live product price for historical records.

### 6. Centralized error handling — `AppError` + `asyncHandler` + `errorHandler`

Three pieces working together to eliminate repeated `try/catch` + `res.status().json()` boilerplate in every controller:

- **`AppError`** — a custom `Error` subclass carrying `message` + `statusCode`. Controllers `throw` this instead of building a response inline.
- **`asyncHandler`** — wraps every async controller. Express's built-in error handling only catches *synchronous* throws; a rejected Promise from an `async` function is invisible to Express unless something explicitly forwards it via `next(err)`. `asyncHandler` does exactly that: `Promise.resolve(fn(...)).catch(next)`.
- **`errorHandler`** — the single middleware (mounted last, after all routes) that receives every forwarded error, reads its `statusCode` (defaulting to `500` for unexpected errors), and sends the one consistent JSON response shape for the whole app. Also translates Mongoose/MongoDB-native errors (`ValidationError`, duplicate key `11000`, `CastError`) into proper client-facing status codes instead of leaking raw `500`s.

Result: controllers just `throw`; they never touch `res` for a failure path.

### 7. Input validation and password strength policy

Every route accepting a request body validates it through Joi schemas (`middleware/validate.js` + `validators/`) before the controller ever runs — malformed emails, negative prices, invalid ObjectId strings, and out-of-range quantities are rejected with a clean `400` upstream of any database interaction.

`registerSchema` enforces a password policy beyond simple length: minimum 8 characters, plus at least one uppercase letter, one lowercase letter, one digit, and one special character, via a single regex with lookaheads.

### 8. Preventing user enumeration

`login` returns the exact same message ("Invalid email or password") whether the email doesn't exist or the password is wrong. Distinguishing the two lets an attacker build a list of valid registered emails before attempting brute force.

### 9. Atomic checkout via MongoDB transactions

`createOrder` validates stock across every cart item *before* mutating anything, then — inside a `mongoose.startSession()` transaction — decrements stock, creates the order, and clears the cart as one atomic unit. If any step fails, the whole transaction rolls back rather than leaving stock decremented with no corresponding order. Requires MongoDB running as a replica set (Atlas clusters are replica sets by default; a local standalone `mongod` is not, and would need `--replSet` enabled to support transactions).

## Environment Variables

See `.env.example`. Never commit `.env` — it's excluded via `.gitignore`.

```
PORT=
MONGO_URI=
JWT_SECRET=
JWT_EXPIRE=
```

Generate a strong `JWT_SECRET` with:
```bash
openssl rand -hex 32
```

## Running Locally

```bash
npm install
cp .env.example .env   # then fill in real values
npx nodemon server.js
```

## API Overview

| Resource | Base path | Notes |
|---|---|---|
| Auth | `/api/auth` | register, login, me |
| Users | `/api/users` | self-or-admin ownership rules |
| Categories | `/api/categories` | public read, admin write |
| Products | `/api/products` | public read w/ filtering & pagination, admin write |
| Cart | `/api/cart` | private, per-user |
| Orders | `/api/orders` | private + admin views, transactional checkout |

## Known Scope Cuts (Intentional)

This is a learning-focused reference, not a production deployment. Hardening implemented so far:

- ✅ Centralized error handling hides internal error details for non-operational (unexpected) errors
- ✅ Structured logging via Winston, split by severity (`warn` for expected/operational errors, `error` for genuine bugs), written to `logs/error.log` and `logs/combined.log`
- ✅ Required environment variables validated on startup; server fails fast if any are missing
- ✅ Input validation via Joi on every route accepting a request body
- ✅ Rate limiting on `/api/auth/login` and `/api/auth/register`
- ✅ Password strength policy (length + character-class requirements)

Still deliberately out of scope, tracked as the remaining hardening backlog:

- Refresh token rotation (currently one long-lived JWT)
- httpOnly cookie-based tokens (currently returned in response body)
- Email verification on registration
- `helmet` + restrictive CORS config
- Account lockout after repeated failed logins (rate limiting is IP-based, not account-based)
- Timing-attack mitigation on login (dummy bcrypt compare for non-existent users)

Each remaining item is a deliberate, known gap — not an oversight — and each maps to a real attack class worth understanding even if not yet implemented. Also worth noting: `express-rate-limit`'s default store is in-memory, meaning it wouldn't correctly enforce limits across multiple server instances behind a load balancer — a Redis-backed store would be needed for that scenario.

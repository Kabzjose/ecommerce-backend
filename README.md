# Ecommerce — Backend API

Backend API for **Ecommerce**, an online store  Built with Node.js, TypeScript, Express, and PostgreSQL (via Prisma).

## Overview

This backend powers two connected systems:

1. **Delivery/courier engine** — customers book parcel deliveries between zones, riders are assigned, and bookings move through a tracked delivery lifecycle with live GPS updates.
2. **E-commerce storefront (Duka)** — customers browse a product catalog, add items to a cart, and check out. A paid order automatically generates a delivery booking that flows through the same delivery engine.

## Tech Stack

- **Runtime**: Node.js (v22), TypeScript, ESM modules
- **Framework**: Express 5
- **Database**: PostgreSQL, via Prisma ORM
- **Auth**: JWT (access + refresh tokens), httpOnly refresh cookies, bcrypt password hashing
- **Real-time**: Socket.io (live rider location tracking)
- **Payments**: M-Pesa (Safaricom Daraja STK Push), Paystack (card payments)
- **Notifications**: SMS via Africa's Talking
- **Validation**: Zod
- **Logging**: Pino
- **Testing**: Vitest + Supertest
- **Package manager**: pnpm

## Core Features

- **Auth**: registration, login, JWT refresh rotation, role-based access (`CUSTOMER`, `RIDER`, `ADMIN`, `BUSINESS`)
- **Bookings**: zone-based pricing, full delivery state machine (`PENDING → CONFIRMED → PICKED_UP → IN_TRANSIT → DELIVERED`), rider assignment, status history log
- **Products, Cart, Checkout, Orders**: product catalog, per-user cart, atomic checkout with stock reservation, automatic booking creation on payment confirmation
- **Payments**: M-Pesa STK Push + webhook confirmation, Paystack card payments + webhook confirmation, idempotent webhook handling
- **Notifications**: SMS updates at key booking milestones (payment confirmed, rider assigned, picked up, delivered)
- **Live tracking**: Socket.io channel per booking, JWT-authenticated, rider broadcasts location during active delivery
- **Admin**: overview analytics, rider performance stats, revenue reporting, user/rider management, product management

## Project Structure

src/
├── config/ # env validation, Prisma client
├── lib/ # external integrations (mpesa, paystack, sms, socket, token, logger, phone)
├── middleware/ # auth, role, validation, error handling
├── modules/
│ ├── auth/
│ ├── users/
│ ├── bookings/
│ ├── pricing/
│ ├── payments/
│ ├── notifications/
│ ├── admin/
│ ├── products/
│ ├── cart/
│ ├── checkout/
│ └── orders/
├── types/ # Express type extensions
├── app.ts # Express app setup
└── server.ts # entrypoint (HTTP + WebSocket)
prisma/
├── schema.prisma
├── migrations/
└── seed.ts


Each module follows a consistent layered pattern: `*.routes.ts → *.controller.ts → *.service.ts → *.repository.ts`, with `*.schema.ts` for Zod validation.

## Getting Started

### Prerequisites
- Node.js 22+
- pnpm 9+
- PostgreSQL (local via Docker, or a hosted instance e.g. Neon)

### Setup

```bash
pnpm install
cp .env.example .env   # fill in real values, see below
docker compose up -d   # if using local Postgres
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev
```

Server runs at `http://localhost:4000` by default.

### Environment Variables

See `.env.example` for the full list. Required groups:

- **Server**: `NODE_ENV`, `PORT`
- **Database**: `DATABASE_URL`
- **Auth**: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, token expiry settings, `COOKIE_DOMAIN`
- **M-Pesa (Daraja)**: `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_ENV`, `MPESA_CALLBACK_URL`
- **Paystack**: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_CALLBACK_URL`
- **Africa's Talking**: `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID`
- **Store config**: `STORE_PICKUP_ZONE_ID`, `STORE_PICKUP_ADDRESS`

**Important — webhook URLs must be publicly reachable.** In local development, use [ngrok](https://ngrok.com) to expose your local server for M-Pesa and Paystack callbacks. Paystack's webhook URL is configured separately in the Paystack Dashboard (Settings → API Keys & Webhooks), not via an env var.

### Scripts

```bash
pnpm dev              # start dev server with hot reload
pnpm build            # compile TypeScript
pnpm start            # run compiled build (production)
pnpm test             # run test suite (requires a separate test database)
pnpm prisma studio    # visual DB browser
pnpm prisma migrate dev --name <name>   # create + apply a migration
pnpm prisma db seed   # run the seed script
```

## Database Schema Highlights

- `User` — role-based (`CUSTOMER`, `RIDER`, `ADMIN`, `BUSINESS`); customer registration is self-serve, rider/admin accounts are admin-created only
- `Booking` + `BookingStatusHistory` — every status transition is logged, enabling delivery-time analytics and full audit trail
- `Zone` + `ZoneRoute` — flat-rate delivery pricing between named zones
- `Product`, `Cart` / `CartItem`, `Order` / `OrderItem` — e-commerce layer; `OrderItem.unitPrice` snapshots price at time of purchase
- `Payment` — supports both M-Pesa and Paystack, linked to either a `Booking` or an `Order`

## Security Notes

- Passwords hashed with bcrypt (12 salt rounds)
- Refresh tokens stored server-side and rotated on every use; revocable
- Refresh token delivered via httpOnly, `SameSite=None; Secure` cookie (required for cross-origin frontend/backend deployment)
- Paystack webhook signatures verified via HMAC-SHA512 before processing
- All list endpoints validate/coerce pagination params via a shared `validate` middleware — note: Express 5 makes `req.query` effectively read-only, so validated values are attached to `req.validated`, not mutated in place on `req.query`

## Deployment

Deployed on [Render](https://render.com), with CI via GitHub Actions:
- Every push/PR runs install → Prisma generate → TypeScript build check
- On merge to `main`, a successful build triggers Render's deploy hook
- Database hosted on [Neon](https://neon.tech) (serverless Postgres)

See `.github/workflows/ci-cd.yml` for the full pipeline.

## Known Limitations / Not Yet Implemented

- No automated test coverage for payments, checkout, or notifications modules (bookings module has test coverage)
- No background job queue — notifications send synchronously
- Product discounts/deals pricing not yet modeled
- No file upload for product images (uses external URLs)
- Wishlist and saved addresses are currently frontend-only (localStorage), not backed by the API
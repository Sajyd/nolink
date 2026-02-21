# nolink.ai — AI Workflow Marketplace

Build, share, and monetize multi-step AI workflows. Chain text, image, audio, video, and document AI models together with a visual drag-and-drop builder.

## Features

- **Visual Workflow Builder** — Drag-and-drop whiteboard with React Flow for chaining AI steps
- **Multi-Model Support** — GPT-4, DALL·E 3, Whisper, Stable Diffusion, Runway, ElevenLabs, and more
- **Marketplace** — Publish workflows publicly and browse community creations
- **Pay-Per-Use Credits (Nolinks)** — Subscribe monthly or buy credit packs via Stripe
- **Creator Earnings** — 70% commission on paid workflow runs via Stripe Connect
- **Light/Dark Mode** — Minimalist UI with theme toggle
- **Workflow Execution** — Submit input, watch steps execute sequentially, see results

## Tech Stack

- **Frontend:** Next.js 14 + TailwindCSS + Framer Motion
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL via Prisma
- **Auth:** NextAuth.js (credentials)
- **Payments:** Stripe + Stripe Connect
- **AI:** OpenAI (GPT-4, DALL·E 3, Whisper) + pluggable model system
- **State:** Zustand
- **Workflow Builder:** @xyflow/react (React Flow)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Stripe account (for payments)
- OpenAI API key (for AI execution)

### Setup

1. **Clone and install:**

```bash
git clone <repo>
cd nolink-ai
npm install
```

2. **Configure environment:**

```bash
cp .env.local.example .env.local
# Edit .env.local with your credentials
```

3. **Set up database:**

```bash
npx prisma db push
npm run db:seed
```

4. **Start development server:**

```bash
npm run dev
```

5. **Open** http://localhost:3000

### Demo Accounts

After seeding:

| Account  | Email               | Password     | Balance   |
|----------|---------------------|--------------|-----------|
| Creator  | creator@nolink.ai   | demo123456   | 5,000 NL  |
| User     | demo@nolink.ai      | demo123456   | 500 NL    |

## Pages

| Route              | Description                        |
|--------------------|------------------------------------|
| `/`                | Landing page                       |
| `/marketplace`     | Browse public workflows            |
| `/create-workflow` | Drag-and-drop workflow builder     |
| `/workflow/[id]`   | View and execute a workflow        |
| `/dashboard`       | User dashboard, credits, history   |
| `/auth/signin`     | Sign in                            |
| `/auth/register`   | Create account                     |

## API Routes

| Route                           | Method | Description              |
|---------------------------------|--------|--------------------------|
| `/api/auth/[...nextauth]`       | *      | NextAuth.js endpoints    |
| `/api/auth/register`            | POST   | Register new user        |
| `/api/workflows`                | GET    | List public workflows    |
| `/api/workflows`                | POST   | Create workflow          |
| `/api/workflows/[id]`           | GET    | Get workflow details     |
| `/api/workflows/[id]`           | PUT    | Update workflow          |
| `/api/workflows/[id]`           | DELETE | Delete workflow          |
| `/api/workflows/[id]/execute`   | POST   | Execute workflow         |
| `/api/credits/balance`          | GET    | Get credit balance       |
| `/api/credits/purchase`         | POST   | Purchase credits         |
| `/api/stripe/webhook`           | POST   | Stripe webhook handler   |

## Currency System

- **Nolinks (NL)** — Platform credits used to run workflows
- New users start with **50 NL** free
- Credit packs: 100 NL ($4.99), 500 NL ($19.99), 1,200 NL ($39.99)
- Subscription tiers: Free, Starter, Pro, Power
- Creators earn **70%** commission on paid workflow runs

## License

MIT

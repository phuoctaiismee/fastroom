This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel & Multi-Instance Realtime Setup

Fastroom is optimized for Vercel Serverless Functions out of the box with client-side smart storage persistence and automatic cross-container polling.

### Optional: Enable Vercel KV / Upstash Redis (Recommended for 100% Realtime Multi-Lambda Sync)

Because Vercel Serverless Functions execute on isolated AWS Lambda containers, enabling Vercel KV / Upstash Redis provides shared persistent storage and cross-container pub/sub event stream distribution across all Vercel instances:

1. Go to your project dashboard on [Vercel](https://vercel.com).
2. Click **Storage** -> **Create Database** -> Select **Vercel KV** or **Upstash Redis**.
3. Connect the KV database to your project. Vercel automatically sets the environment variables:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   (or `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`)
4. Redeploy your project on Vercel. Fastroom will automatically detect Vercel KV and enable cross-instance realtime SSE event distribution and 5-minute persistent storage across all serverless containers!


This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Facebook Authentication Setup

1. **Create a Facebook App:**
   - Go to [Facebook Developers](https://developers.facebook.com/apps/)
   - Click "Create App" and select "Consumer" or "Business"
   - Fill in your app details

2. **Configure Facebook Login:**
   - In your app dashboard, go to "Add Product" → "Facebook Login"
   - Set up Facebook Login
   - Add `http://localhost:3000/api/auth/callback/facebook` as a Valid OAuth Redirect URI

3. **Get Your Credentials:**
   - Go to Settings → Basic
   - Copy your App ID and App Secret

4. **Set Environment Variables:**
   - Create a `.env.local` file in the root directory
   - Add the following:
   ```
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key-here
   FACEBOOK_CLIENT_ID=your-facebook-app-id
   FACEBOOK_CLIENT_SECRET=your-facebook-app-secret
   ```
   - Generate a secret: `openssl rand -base64 32`

5. **For Production:**
   - Update `NEXTAUTH_URL` to your production domain
   - Add your production callback URL to Facebook App settings

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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

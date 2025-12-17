# Environment Variables Setup Guide

This guide explains how to configure the required environment variables for Protocol Banks.

## Required Environment Variables

Add these variables in the **Vars** section of your v0 project or in your deployment platform (Vercel):

### 1. reCAPTCHA Configuration

**Get your keys from:** https://www.google.com/recaptcha/admin

```env
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6Lcy2S4sAAAAAPvp87hb-Fd6Ilt5JKOEtDCP_Jdk
RECAPTCHA_SECRET_KEY=6Lcy2S4sAAAAAH06AlrmdD_mCEK5Q8xM_L09GOv6
```

- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`: Site key for reCAPTCHA (fetched via server action)
- `RECAPTCHA_SECRET_KEY`: Private key used for server-side verification (keep secure)

### 2. Email Service (Resend)

**Get your key from:** https://resend.com/api-keys

```env
RESEND_API_KEY=re_7BVLS4Jr_FMx1W2TVUgX7dCskj1dnkm3s
```

This enables the contact form to send emails to `everest9812@gmail.com`.

### 3. Supabase (Already Configured)

These should already be set up in your project:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Ethereum Configuration (Already Configured)

```env
NEXT_PUBLIC_ETHERSCAN_API_KEY=your_etherscan_api_key
NEXT_PUBLIC_ALLOW_DEMO_MODE=true
```

## How to Add Variables in v0

1. Open your project in v0
2. Click the **sidebar** on the left
3. Navigate to **Vars** section
4. Add each variable with its name and value
5. Save changes

## How to Add Variables in Vercel

1. Go to your project settings in Vercel
2. Navigate to **Environment Variables**
3. Add each variable for Production, Preview, and Development
4. Redeploy your project

## Verify Setup

After adding the variables:

1. **Test Contact Form**: Visit `/contact` and submit a test message
2. **Check Email**: You should receive an email at `everest9812@gmail.com`
3. **Verify reCAPTCHA**: The form should show "Send Message" (not "Loading verification...")

## Troubleshooting

- **reCAPTCHA not loading**: Check that `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is set correctly
- **Email not sending**: Verify `RESEND_API_KEY` is valid and active
- **"Verification failed" error**: Check that `RECAPTCHA_SECRET_KEY` matches your reCAPTCHA configuration

## Security Notes

- Never commit `.env` files to version control
- reCAPTCHA site key is fetched via server action for enhanced security
- Secret keys (`RECAPTCHA_SECRET_KEY`, `RESEND_API_KEY`) are only accessible server-side
- All sensitive operations are handled through secure API routes

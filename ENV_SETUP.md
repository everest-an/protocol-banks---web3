# Environment Variables Setup Guide

This guide explains how to configure the required environment variables for Protocol Banks.

## Required Environment Variables

Add these variables in the **Vars** section of your v0 project or in your deployment platform (Vercel):

### 1. Reown AppKit (Email/Social Login & Fiat On-Ramp)

**Get your Project ID from:** https://cloud.reown.com

\`\`\`env
NEXT_PUBLIC_REOWN_PROJECT_ID=your_reown_project_id
\`\`\`

This enables:
- Email login (passwordless authentication)
- Social logins (Google, X, GitHub, Discord, Apple, Facebook)
- Fiat on-ramp (buy crypto with credit card/bank transfer)
- Multi-wallet support (MetaMask, Rainbow, Coinbase Wallet, etc.)

#### Setting Up Reown Project

1. **Create Account**:
   - Go to https://cloud.reown.com
   - Sign up or log in

2. **Create New Project**:
   - Click "Create Project"
   - Name: "Protocol Banks"
   - Select "Web"

3. **Configure Project**:
   - Add your website URL: `https://protocolbanks.com`
   - Add development URL: `http://localhost:3000`
   
4. **Enable Features** (via Dashboard):
   - Go to https://dashboard.reown.com
   - Select your project
   - Navigate to "Features" section
   - Enable email authentication
   - Enable social logins (Google, X, GitHub, Discord, Apple, Facebook)
   - Enable on-ramp providers (Coinbase Pay, MoonPay, Transak)

5. **Copy Project ID**:
   - Find your Project ID in the dashboard
   - Add it to environment variables as `NEXT_PUBLIC_REOWN_PROJECT_ID`

**Features**:
- Users can create wallets with just their email (no browser extension needed)
- Social login support (Google, X, GitHub, Discord, Apple, Facebook)
- Built-in fiat on-ramp (users can buy crypto with credit cards)
- Mobile-friendly (works on iOS/Android)

**Note**: Features are controlled via the Reown dashboard, not in code. You may see a console notice saying "local configuration was ignored" - this is expected and normal behavior.

### 2. reCAPTCHA Configuration

**Get your keys from:** https://www.google.com/recaptcha/admin

\`\`\`env
RECAPTCHA_SITE_KEY=6Lcy2S4sAAAAAPvp87hb-Fd6Ilt5JKOEtDCP_Jdk
RECAPTCHA_SECRET_KEY=6Lcy2S4sAAAAAH06AlrmdD_mCEK5Q8xM_L09GOv6
\`\`\`

- `RECAPTCHA_SITE_KEY`: Site key for reCAPTCHA (fetched via server action)
- `RECAPTCHA_SECRET_KEY`: Private key used for server-side verification (keep secure)

### 3. Email Service (Resend)

**Get your key from:** https://resend.com/api-keys

\`\`\`env
RESEND_API_KEY=re_7BVLS4Jr_FMx1W2TVUgX7dCskj1dnkm3s
\`\`\`

This enables the contact form to send emails to `everest9812@gmail.com`.

#### Setting Up Custom Domain (e.protocolbanks.com)

To use `contact@e.protocolbanks.com` as the sender address:

1. **Add Domain in Resend**:
   - Go to https://resend.com/domains
   - Click "Add Domain"
   - Enter `e.protocolbanks.com`

2. **Configure DNS Records**:
   Add these records to your DNS provider (Cloudflare, GoDaddy, etc.):
   
   \`\`\`
   Type: TXT
   Name: e.protocolbanks.com
   Value: [Resend will provide this value]
   
   Type: TXT  
   Name: resend._domainkey.e.protocolbanks.com
   Value: [DKIM key from Resend]
   
   Type: MX
   Name: e.protocolbanks.com
   Priority: 10
   Value: feedback-smtp.us-east-1.amazonses.com
   \`\`\`

3. **Verify Domain**:
   - Wait 24-48 hours for DNS propagation
   - Click "Verify" in Resend dashboard
   - Status should change to "Verified"

4. **Test Email**:
   - Submit a test message via `/contact` page
   - Check if email arrives at `everest9812@gmail.com`

**Note**: Until domain verification is complete, emails will be sent from `onboarding@resend.dev` (default Resend address).

### 4. Supabase (Already Configured)

These should already be set up in your project:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
\`\`\`

### 5. Ethereum Configuration (Already Configured)

\`\`\`env
ETHERSCAN_API_KEY=your_etherscan_api_key
NEXT_PUBLIC_ALLOW_DEMO_MODE=true
\`\`\`

**Note:** `ETHERSCAN_API_KEY` is used server-side only in API routes, so it does not need the `NEXT_PUBLIC_` prefix.

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

1. **Test Email/Social Login**: 
   - Visit homepage and click "Email / Social Login"
   - Try logging in with email or social account
   - Wallet should be created automatically

2. **Test Fiat On-Ramp**:
   - Connect wallet via Reown
   - Click account menu → "Buy Crypto (Fiat On-Ramp)"
   - Should open credit card/bank purchase flow

3. **Test Contact Form**: Visit `/contact` and submit a test message
4. **Check Email**: You should receive an email at `everest9812@gmail.com`
5. **Verify reCAPTCHA**: The form should show "Send Message" (not "Loading verification...")
6. **Check Sender**: Email should be from `contact@e.protocolbanks.com` (after domain verification)

## Troubleshooting

- **Reown not loading**: Check that `NEXT_PUBLIC_REOWN_PROJECT_ID` is set correctly
- **Email login fails**: Verify your domain is whitelisted in Reown dashboard
- **On-ramp not working**: Ensure on-ramp providers are enabled in Reown project settings
- **reCAPTCHA not loading**: Check that `RECAPTCHA_SITE_KEY` is set correctly
- **Email not sending**: Verify `RESEND_API_KEY` is valid and active
- **"Verification failed" error**: Check that `RECAPTCHA_SECRET_KEY` matches your reCAPTCHA configuration
- **Wrong sender address**: Domain `e.protocolbanks.com` may not be verified in Resend yet
- **Email goes to spam**: Ensure SPF/DKIM records are properly configured
- **"Configuration was ignored" notice**: This is normal. Features are managed via https://dashboard.reown.com, not local code. Check your dashboard settings to enable/disable features.

## Security Notes

- Never commit `.env` files to version control
- reCAPTCHA site key is fetched via server action for enhanced security
- Secret keys (`RECAPTCHA_SECRET_KEY`, `RESEND_API_KEY`) are only accessible server-side
- All sensitive operations are handled through secure API routes

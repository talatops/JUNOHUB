# Gmail Integration Setup Guide

This guide explains how to set up Gmail integration so that **every vendor can connect their own Gmail account** to receive and send customer emails.

## How It Works

- **One OAuth App**: You create ONE Google OAuth application in Google Cloud Console
- **Shared Credentials**: All vendors use the same `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- **Individual Authorization**: Each vendor authorizes their own Gmail account when connecting
- **Separate Tokens**: Each vendor's Gmail tokens are stored separately in the database

## Login Method vs Gmail Integration

**IMPORTANT**: These are TWO separate things:

1. **Login Method** (How vendor logs into YOUR app):
   - Email/Password login ✅
   - Google OAuth login ✅
   - Both work independently

2. **Gmail Integration** (Authorizing Gmail API access):
   - Separate OAuth flow
   - Works regardless of login method
   - Vendor can connect ANY Gmail account (doesn't need to match login email)

### Example Scenarios:

**Scenario 1**: Vendor logs in with email/password (`talatfaheem2@gmail.com`)
- ✅ Can connect Gmail integration
- When clicking "Connect Gmail", they'll be redirected to Google OAuth
- Can authorize the same Gmail (`talatfaheem2@gmail.com`) OR a different one (`business@gmail.com`)

**Scenario 2**: Vendor logs in with Google OAuth (`talatfaheem2@gmail.com`)
- ✅ Can connect Gmail integration
- When clicking "Connect Gmail", they'll be redirected to Google OAuth again
- Can authorize the same Gmail (`talatfaheem2@gmail.com`) OR a different one (`business@gmail.com`)

**Key Point**: The Gmail account they authorize doesn't need to match their login email!

## Step-by-Step Setup

### 1. Create Google Cloud Project (One Time Setup)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Gmail API**:
   - Go to [APIs & Services > Library](https://console.cloud.google.com/apis/library)
   - Search for "Gmail API"
   - Click "Enable"

### 2. Create OAuth 2.0 Credentials

1. Go to [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" > "OAuth client ID"
3. **If prompted**, configure OAuth consent screen (Google will prompt you the first time):
   - Choose "External" (unless you have Google Workspace)
   - Fill in app name, support email, developer contact
   - **Note**: You don't need to manually add scopes here - they're automatically requested when vendors connect
   - **IMPORTANT**: Add test users - Add ALL Gmail addresses that will connect (e.g., `krypttech4@gmail.com`, `talatfaheem2@gmail.com`, etc.)
   - Click "Save and Continue" through the steps
   
   **OR if consent screen is already configured:**
   - Go to [APIs & Services > OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
   - Scroll down to "Test users" section
   - Click "+ ADD USERS"
   - Add the Gmail addresses that will connect (one per line or comma-separated)
   - Click "Add"
4. Create OAuth client:
   - Application type: "Web application"
   - Name: "JunoHub Gmail Integration" (or your choice)
   - **Authorized redirect URIs** (CRITICAL - must match exactly):
     ```
     http://localhost:3000/api/integrations/gmail/callback
     https://your-production-domain.com/api/integrations/gmail/callback
     ```
     - If using ngrok: `https://your-ngrok-url.ngrok-free.dev/api/integrations/gmail/callback`
     - **Important**: Add ALL environments you'll use (dev, staging, production, ngrok URLs)

### 3. Configure Environment Variables

Add to your `.env` file:

```env
# Your Google Cloud OAuth credentials (shared for all vendors)
GOOGLE_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret-here"

# Your app URL (used for OAuth redirects)
NEXTAUTH_URL="http://localhost:3000"  # or your production URL
```

### 4. Test the Integration

1. Start your application
2. Log in as a vendor
3. Go to Juno Engine > Gmail Connect
4. Click "Connect Gmail Account"
5. Sign in with **any Gmail account** (doesn't need to match the OAuth app owner)
6. Authorize the requested permissions
7. You should be redirected back and see "Gmail Connected"

## Troubleshooting

### Error: `redirect_uri_mismatch`

**Problem**: The redirect URI in your code doesn't match what's configured in Google Cloud Console.

**Solution**:
1. Check the error message - it will show the redirect URI being used
2. Go to Google Cloud Console > Credentials > Your OAuth Client
3. Add the exact redirect URI shown in the error to "Authorized redirect URIs"
4. Wait a few minutes for changes to propagate
5. Try again

### Error: `invalid_client`

**Problem**: The `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is incorrect.

**Solution**:
1. Double-check your `.env` file
2. Make sure there are no extra spaces or quotes
3. Restart your application after changing `.env`

### Error: `access_denied` or "Access blocked: has not completed the Google verification process"

**Problem**: The OAuth app is in "Testing" mode and the user's Gmail address is not added as a test user.

**Solution**:
1. Go to [APIs & Services > OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Scroll down to "Test users" section
3. Click "+ ADD USERS"
4. Add the Gmail address that's trying to connect (e.g., `krypttech4@gmail.com`)
5. Click "Add"
6. Wait a few minutes for changes to propagate
7. Try connecting again

**Note**: In testing mode, you must add each Gmail address as a test user. For production, you'll need to publish your app (requires Google verification).

## Important Notes

- **OAuth Consent Screen**: Google will prompt you to configure this the FIRST time you create OAuth credentials. After that, you can skip it. The scopes are automatically requested in the OAuth flow - you don't need to manually add them in the consent screen.
- **OAuth App Owner**: The email that created the OAuth app (`i221735@nu.edu.pk`) doesn't matter. Any Gmail account can authorize access.
- **Vendor Gmail**: Each vendor connects their own Gmail account (`talatfaheem2@gmail.com`, etc.). They don't need their own OAuth credentials.
- **Redirect URI**: Must match EXACTLY (including protocol, domain, port, path). No trailing slashes.
- **Multiple Environments**: Add redirect URIs for all environments (localhost, staging, production, ngrok).

## Security Considerations

- OAuth tokens are stored securely in the database
- Each vendor's tokens are isolated (can't access each other's emails)
- Tokens are automatically refreshed when expired
- Vendors can disconnect their Gmail at any time

## Production Checklist

- [ ] Gmail API enabled in Google Cloud Console
- [ ] OAuth consent screen configured
- [ ] **Test users added** (for testing mode) - Add all Gmail addresses that will connect
- [ ] OAuth client created with correct redirect URIs
- [ ] Environment variables set (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL`)
- [ ] Database migration run (`prisma db push`)
- [ ] Tested with at least one vendor account
- [ ] Production redirect URI added to Google Cloud Console
- [ ] **For production**: Publish your app (requires Google verification) OR keep adding test users as needed

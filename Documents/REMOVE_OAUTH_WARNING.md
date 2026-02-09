# How to Remove "Google hasn't verified this app" Warning

## Quick Answer

The warning appears because your app requests **Gmail scopes** which are sensitive/restricted and require Google verification. You have 3 options:

## Option 1: Keep in Testing Mode (Easiest - For Development)

**Best for**: Development, testing, or apps with fewer than 100 users

### Steps:
1. Go to [Google Cloud Console > OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Click **"Back to testing"** button (if your app is currently "In production")
3. Add all Gmail addresses as **test users**:
   - Scroll to "Test users" section
   - Click "+ ADD USERS"
   - Add each Gmail address (one per line)
   - Click "Add"
4. Save changes

### Result:
- ✅ Test users won't see the warning
- ✅ Can connect Gmail without verification
- ❌ Limited to 100 test users
- ❌ Must manually add each user

---

## Option 2: Get Google Verification (For Production)

**Best for**: Production apps that need to scale beyond 100 users

### Prerequisites:
Before starting verification, you need:

1. **Privacy Policy** (Required)
   - Must be publicly accessible URL
   - Must explain how you use Gmail data
   - Example: `https://yourdomain.com/privacy-policy`

2. **Terms of Service** (Required)
   - Must be publicly accessible URL
   - Example: `https://yourdomain.com/terms`

3. **App Homepage** (Required)
   - Your app's main website URL
   - Example: `https://yourdomain.com`

4. **Authorized Domains**
   - Add your production domain
   - Example: `yourdomain.com`

### Verification Steps:

1. **Go to Verification Center**:
   - [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
   - Click "Verification Center" in left sidebar
   - Or go directly: [Verification Center](https://console.cloud.google.com/apis/credentials/consent/verification)

2. **Start Verification**:
   - Click "Start Verification" or "Submit for verification"
   - Fill out the verification form

3. **Complete Verification Form**:
   - **App name**: Your app name (e.g., "JunoHub")
   - **Support email**: Your support email address
   - **App domain**: Your production domain
   - **Authorized domains**: Add your domain
   - **Scopes**: Gmail scopes will be automatically listed
   - **Privacy Policy URL**: Your privacy policy URL
   - **Terms of Service URL**: Your terms of service URL
   - **App homepage**: Your app's homepage URL
   - **App logo**: Optional but recommended

4. **Additional Information** (may be requested):
   - **Video demonstration**: Show how your app uses Gmail
   - **Use case explanation**: Why you need Gmail access
   - **Data handling**: How you store/process Gmail data

5. **Submit for Review**:
   - Review all information
   - Submit the form
   - Google will review (typically 4-6 weeks)

### After Verification:
- ✅ Warning disappears for ALL users
- ✅ No user limit
- ✅ Can request sensitive/restricted scopes
- ✅ Professional appearance

---

## Option 3: Use Domain-Wide Delegation (Advanced - For Google Workspace)

**Best for**: Google Workspace organizations only

If you're using Google Workspace, you can use domain-wide delegation instead of OAuth, but this requires admin access and is more complex.

---

## Current Status Check

Based on your Google Cloud Console screenshot:
- ✅ App is "In production"
- ✅ User type is "External"
- ⚠️ OAuth user cap: 0/100 users
- ⚠️ Warning appears because Gmail scopes are unapproved

## Recommended Action

**For now (Development/Testing)**:
1. Click "Back to testing" in OAuth consent screen
2. Add test users (your vendors' Gmail addresses)
3. Test users won't see the warning

**For later (Production)**:
1. Create Privacy Policy and Terms of Service pages
2. Submit app for Google verification
3. Wait for approval (4-6 weeks)
4. Warning will disappear automatically

---

## Privacy Policy Template (Gmail Data Usage)

Your Privacy Policy must mention Gmail data usage. Example section:

```markdown
## Gmail Integration

When you connect your Gmail account to [Your App Name], we access:
- Read emails: To sync customer emails and create support tickets
- Send emails: To send automated responses and notifications
- Modify emails: To manage email threads and mark emails as read

We store:
- OAuth tokens (encrypted) for Gmail API access
- Email addresses for account identification

We do NOT:
- Store email content permanently
- Share your emails with third parties
- Access emails outside of the app's functionality

You can revoke access at any time by disconnecting Gmail in your account settings.
```

---

## Need Help?

- [Google OAuth Verification Guide](https://support.google.com/cloud/answer/9110914)
- [OAuth Consent Screen Documentation](https://developers.google.com/identity/protocols/oauth2/policy)
- [Gmail API Scopes Documentation](https://developers.google.com/gmail/api/auth/scopes)

# Meta (Facebook & Instagram) Integration Setup Guide

This guide will help you configure your Meta Developer App to enable Facebook and Instagram publishing through your Social Media Scheduler.

---

## Prerequisites

- A Meta Developer account (https://developers.facebook.com/)
- A Facebook Page you manage
- An Instagram Business or Creator account linked to that Facebook Page

---

## Step 1: Meta App Configuration

### 1.1 Access Your Meta App

1. Go to https://developers.facebook.com/apps/
2. Select your app (App ID: Check your `.env` file for `META_APP_ID`)

### 1.2 Add Required Products

In your Meta App dashboard, add these products:

#### Facebook Login
- Already configured ✓
- Configuration ID: `META_CONFIG_ID` (in your `.env`)

#### Instagram Basic Display
1. Click "Add Product"
2. Find "Instagram Basic Display"
3. Click "Set Up"
4. Complete the setup wizard

#### Instagram Graph API
1. Click "Add Product"
2. Find "Instagram Graph API"  
3. Click "Set Up"
4. Complete the setup wizard

---

## Step 2: Configure OAuth Redirect URIs

### 2.1 Facebook Login Settings

1. Go to **Facebook Login** → **Settings**
2. Under **Valid OAuth Redirect URIs**, add:
   ```
   https://your-ngrok-url.ngrok-free.app/api/facebook/callback
   http://localhost:3000/api/facebook/callback
   ```

### 2.2 Instagram Basic Display Settings

1. Go to **Instagram Basic Display** → **Basic Display**
2. Under **Valid OAuth Redirect URIs**, add:
   ```
   https://your-ngrok-url.ngrok-free.app/api/instagram/callback
   http://localhost:3000/api/instagram/callback
   ```

### 2.3 Instagram Graph API Settings

1. Go to **Instagram Graph API** → **Settings**
2. Add the same redirect URIs as above

**Important**: Replace `your-ngrok-url.ngrok-free.app` with your actual ngrok domain from your `.env` file (`BACKEND_URL`)

---

## Step 3: Instagram Business Account Setup

### 3.1 Convert to Business Account

1. Open Instagram app
2. Go to **Settings** → **Account**
3. Tap **Switch to Professional Account**
4. Choose **Business** or **Creator**
5. Complete the setup

### 3.2 Link to Facebook Page

1. In Instagram app: **Settings** → **Account** → **Linked Accounts**
2. Select **Facebook**
3. Log in and link your Facebook Page
4. Grant all requested permissions

### 3.3 Verify in Facebook

1. Go to your Facebook Page
2. **Settings** → **Instagram**
3. Confirm your Instagram account is connected

---

## Step 4: App Permissions & Review

### 4.1 Required Permissions

Make sure your app has these permissions:

**Facebook**:
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

**Instagram**:
- `instagram_basic`
- `instagram_content_publish`

### 4.2 App Review (For Production)

For development and testing, you can use your own accounts without app review.

For production (publishing on behalf of other users):
1. Submit your app for **App Review**
2. Request the permissions listed above
3. Provide screencast demonstrations
4. Wait for Meta approval (typically 3-7 days)

---

## Step 5: Environment Variables

Verify your `.env` file contains:

```env
# Meta Configuration
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
META_GRAPH_API_VERSION=v23.0
META_CONFIG_ID=your_config_id_here

# Redirect URIs
FACEBOOK_REDIRECT_URI=https://your-ngrok-url.ngrok-free.app/api/facebook/callback
INSTAGRAM_REDIRECT_URI=https://your-ngrok-url.ngrok-free.app/api/instagram/callback

# Backend URL (for Instagram media hosting)
BACKEND_URL=https://your-ngrok-url.ngrok-free.app
```

**Security Note**: Never commit your `.env` file to version control!

---

## Step 6: Testing the Integration

### 6.1 Test Facebook Connection

1. Start your server: `cd server && npm run dev`
2. Start your frontend: `cd client && npm run dev`
3. Navigate to **Accounts** page
4. Click **Connect Account** → **Facebook**
5. Complete the OAuth flow
6. Select a Facebook Page
7. Verify "Connected" status appears

### 6.2 Test Instagram Connection

1. Navigate to **Accounts** page
2. Click **Connect Account** → **Instagram**
3. Complete the OAuth flow
4. Application will find Instagram Business accounts linked to your Facebook Pages
5. Verify "Connected" status appears

### 6.3 Test Publishing

1. Navigate to **Scheduler** page
2. Create a test post with an image (required for Instagram)
3. Select Facebook and/or Instagram
4. Schedule for immediate publishing or a future time
5. Monitor the post status in the UI

---

## Troubleshooting

### "Invalid platform app" Error

**Cause**: Instagram products not configured in Meta Developer Dashboard

**Solution**: 
1. Add Instagram Basic Display product
2. Add Instagram Graph API product
3. Configure redirect URIs in both products
4. Wait 5-10 minutes for changes to propagate

### "No Instagram Business accounts found"

**Cause**: Instagram account not linked to Facebook Page, or not a Business account

**Solution**:
1. Convert Instagram to Business/Creator account
2. Link Instagram to Facebook Page in Instagram app settings
3. Verify connection in Facebook Page settings
4. Try OAuth flow again

### "Invalid redirect URI"

**Cause**: Redirect URI in request doesn't match configured URIs

**Solution**:
1. Check your `.env` file for `INSTAGRAM_REDIRECT_URI` and `FACEBOOK_REDIRECT_URI`
2. Ensure they match exactly in Meta App settings (including https vs http)
3. For ngrok, update redirect URIs when your ngrok URL changes
4. Save changes in Meta Dashboard and wait a few minutes

### Publishing Fails

**Cause**: Token expired or insufficient permissions

**Solution**:
1. Disconnect the account in your app
2. Reconnect to get fresh tokens
3. Ensure all required permissions are granted during OAuth
4. Check server logs for specific API error messages

---

## API Documentation

- **Facebook Graph API**: https://developers.facebook.com/docs/graph-api
- **Instagram Graph API**: https://developers.facebook.com/docs/instagram-api
- **Facebook Login**: https://developers.facebook.com/docs/facebook-login

---

## Support

If you continue to experience issues:

1. Check server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure Meta App is in "Development" mode (or "Live" if app reviewed)
4. Check Meta Developer Dashboard for app alerts or issues
5. Review Meta API changelog for breaking changes

---

Last Updated: 2026

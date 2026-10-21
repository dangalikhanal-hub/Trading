# Google OAuth Setup for TradeVision Pro

## Prerequisites
- A Google Cloud account.
- The TradeVision Pro app running locally (`npm run dev`).
- Environment variables file (`.env.local`) in the project root.

## Step‑by‑Step Instructions
1. **Create a Google Cloud Project**
   - Go to the [Google Cloud Console](https://console.cloud.google.com/).
   - Click **Select a project** → **New Project**. Give it a name (e.g., `tradevision-pro`).
   - Wait for the project to be created and ensure it is selected.

2. **Configure OAuth consent screen**
   - In the left navigation, choose **APIs & Services** → **OAuth consent screen**.
   - Select **External** user type.
   - Fill out the required fields (App name, Support email, Developer contact email).
   - Add the scopes you need – the default `email`, `profile`, and `openid` are sufficient for Auth.js.
   - Save the consent screen configuration.

3. **Create OAuth 2.0 Client ID**
   - Navigate to **APIs & Services** → **Credentials**.
   - Click **Create Credentials** → **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `TradeVision Pro Local`.
   - **Authorized JavaScript origins**: `http://localhost:3000`.
   - **Authorized redirect URIs**: `http://localhost:3000/api/auth/callback/google`.
   - Click **Create**.
   - Copy the **Client ID** and **Client secret**.

4. **Add credentials to the project**
   - Open `.env.local` (or create it if missing) in the project root.
   - Set the following variables (replace placeholders with the values you copied):
     ```
     GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
     GOOGLE_CLIENT_SECRET=your-client-secret
     ```
   - Ensure `NEXTAUTH_URL` is set to `http://localhost:3000` (already in `.env.example`).

5. **Restart the development server**
   ```
   npm run dev
   ```
   The server picks up the new environment variables.

6. **Test the login flow**
   - Open `http://localhost:3000/auth/login` in a browser.
   - Click **Continue with Google**.
   - Complete the Google sign‑in prompt.
   - You should be redirected to `/dashboard` and see the header with a **Sign Out** button.

7. **Verify user record**
   - Open your PostgreSQL client and run:
     ```sql
     SELECT * FROM "User" WHERE email = '<your-google-email>';
     ```
   - The user row should contain the Google `name`, `email`, and `image` fields populated.

## Troubleshooting
- **Redirect URI mismatch**: Ensure the redirect URI exactly matches `http://localhost:3000/api/auth/callback/google`.
- **Missing environment variables**: Double‑check that the variables are defined without quotes in `.env.local` and that the dev server was restarted.
- **Session not persisting**: Verify `AUTH_SECRET` is defined and long enough (at least 32 characters).

Once these steps are completed, Google OAuth is fully integrated and all dashboard pages are protected.

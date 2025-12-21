# TestFlight Publishing Guide for WorkoutTracker

This guide will walk you through publishing your app to TestFlight using Expo Application Services (EAS).

## Prerequisites

Before you begin, make sure you have:

1. **Apple Developer Account** ($99/year)
   - Sign up at: https://developer.apple.com
   - You need to be enrolled in the Apple Developer Program

2. **App Store Connect Access**
   - Your Apple ID should have access to App Store Connect
   - Visit: https://appstoreconnect.apple.com

3. **Expo Account**
   - Create a free account at: https://expo.dev

## Step 1: Install EAS CLI

Run this command in your terminal:

```bash
npm install -g eas-cli
```

Then log in to your Expo account:

```bash
eas login
```

## Step 2: Configure Your Project

Link your project to Expo:

```bash
eas build:configure
```

This command will:
- Create or update `eas.json` (already created for you)
- Link your project to your Expo account
- Set up your app for building

## Step 3: Update Bundle Identifier (If Needed)

Your current bundle identifier is: `com.workouttracker.app`

If you want to change it:
1. Open `app.json`
2. Update the `ios.bundleIdentifier` field
3. Make sure it's unique and follows reverse domain notation (e.g., `com.yourname.workouttracker`)

## Step 4: Create App in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Click on "My Apps"
3. Click the "+" button and select "New App"
4. Fill in:
   - **Platform**: iOS
   - **Name**: WorkoutTracker (or your preferred name)
   - **Primary Language**: English
   - **Bundle ID**: Select `com.workouttracker.app` (or your custom one)
   - **SKU**: workouttracker (or any unique identifier)
5. Click "Create"
6. **Note the App ID** from the URL or App Information page (you'll need this)

## Step 5: Update EAS Configuration

Open `eas.json` and update the submit section:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your-apple-id@email.com",
      "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
      "appleTeamId": "YOUR_TEAM_ID"
    }
  }
}
```

To find your Team ID:
1. Go to https://developer.apple.com/account
2. Click on "Membership"
3. Your Team ID is listed there

## Step 6: Build Your App

Run the production build command:

```bash
eas build --platform ios
```

This will:
- Upload your code to Expo's servers
- Build your iOS app in the cloud
- Generate an IPA file (iOS App Package)
- This usually takes 10-20 minutes

**Note**: The first time you run this, EAS will:
- Ask if you want to create an Apple Distribution Certificate and Provisioning Profile
- Answer **Yes** to let EAS handle this automatically
- You'll need to authenticate with your Apple Developer account

## Step 7: Submit to App Store Connect

Once the build completes, submit it to App Store Connect:

```bash
eas submit --platform ios
```

Or, if you want to submit a specific build:

```bash
eas submit --platform ios --latest
```

This will:
- Upload your IPA to App Store Connect
- Make it available for TestFlight

## Step 8: Configure TestFlight

1. Go to https://appstoreconnect.apple.com
2. Select your app
3. Go to the "TestFlight" tab
4. Wait for the build to finish processing (usually 5-10 minutes)
5. Once "Ready to Test" appears:
   - Fill in "What to Test" notes
   - Add internal testers (up to 100)
   - Or create an external test group

### Internal Testing (Immediate)
- Add testers from your team
- They receive an email invitation instantly
- No App Review required

### External Testing (Requires Review)
- Create a public link or add specific testers
- Requires beta app review from Apple (1-2 days)
- Can have up to 10,000 testers

## Step 9: Add Testers

### Internal Testers:
1. In TestFlight tab, go to "Internal Testing"
2. Click "Add Internal Testers"
3. Enter email addresses
4. They'll receive an invitation

### External Testers:
1. Create a group under "External Testing"
2. Add the build to the group
3. Add tester emails or create a public link
4. Submit for beta review

## Step 10: Testers Install the App

1. Testers receive an email invitation
2. They install the TestFlight app from the App Store
3. They open the invitation link
4. They can install and test your app

## Updating Your App

When you make changes and want to release a new version:

1. Update the version in `app.json`:
   ```json
   "version": "1.0.1"
   ```

2. Build again:
   ```bash
   eas build --platform ios
   ```

3. Submit again:
   ```bash
   eas submit --platform ios --latest
   ```

4. The new build will appear in TestFlight automatically

## Troubleshooting

### Build Fails
- Check the build logs in the Expo dashboard
- Ensure all assets exist (icon, splash screen)
- Make sure bundle identifier is unique

### Submission Fails
- Verify your Apple Developer account is active
- Check that your Team ID and App ID are correct
- Ensure you have a valid Distribution Certificate

### TestFlight Not Showing Build
- Wait 5-10 minutes for processing
- Check for compliance or export regulation questions
- Verify you answered all required questions in App Store Connect

## Quick Reference Commands

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure project
eas build:configure

# Build for iOS
eas build --platform ios

# Submit to App Store Connect
eas submit --platform ios --latest

# Check build status
eas build:list

# View build logs
eas build:view [build-id]
```

## Useful Links

- EAS Build Documentation: https://docs.expo.dev/build/introduction/
- EAS Submit Documentation: https://docs.expo.dev/submit/introduction/
- TestFlight Guide: https://developer.apple.com/testflight/
- App Store Connect: https://appstoreconnect.apple.com

## Need Help?

If you encounter issues:
1. Check the EAS build logs
2. Visit Expo Forums: https://forums.expo.dev
3. Check Apple Developer Forums: https://developer.apple.com/forums

---

Good luck with your TestFlight release! 🚀


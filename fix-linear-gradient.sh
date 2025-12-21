#!/bin/bash

# Fix ExpoLinearGradient compatibility with New Architecture

echo "🔧 Fixing ExpoLinearGradient for TestFlight..."

# Navigate to project root
cd "$(dirname "$0")"

# Clean and reinstall
echo "📦 Cleaning node_modules and reinstalling..."
rm -rf node_modules
npm install

# Clean and reinstall iOS pods
echo "🍎 Cleaning iOS pods and reinstalling..."
cd ios
rm -rf Pods Podfile.lock
pod install --repo-update

echo "✅ Done! Now rebuild your app for TestFlight."
echo ""
echo "To rebuild for TestFlight, run:"
echo "  npx eas build --platform ios --profile production"


#!/bin/bash
echo "🔥 Nuclear clean starting..."

# Kill everything
echo "1. Killing all Node processes..."
killall node 2>/dev/null || true
killall -9 node 2>/dev/null || true

# Kill port 8081
echo "2. Killing port 8081..."
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

# Clean Metro cache
echo "3. Cleaning Metro cache..."
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/haste-map-* 2>/dev/null || true

# Clean Expo cache
echo "4. Cleaning Expo cache..."
rm -rf .expo 2>/dev/null || true
rm -rf ~/.expo/metro-cache 2>/dev/null || true

# Clean Watchman
echo "5. Cleaning Watchman..."
watchman watch-del-all 2>/dev/null || true

# Clean node_modules cache
echo "6. Cleaning node_modules cache..."
rm -rf node_modules/.cache 2>/dev/null || true

echo "✅ Clean complete! Now run: npm start"

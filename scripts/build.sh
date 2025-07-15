#!/bin/bash

echo "🔨 Building Token Indexer..."
echo "============================"

# Build the application
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "📋 Build Summary:"
    echo "- TypeScript compiled successfully"
    echo "- Output directory: dist/"
    echo ""
    echo "🚀 Ready to run!"
    echo "   npm run start:prod"
else
    echo "❌ Build failed!"
    echo "Check the errors above and fix them before proceeding."
    exit 1
fi

#!/bin/bash
set -e

echo "Building frontend..."
vite build

echo "Building backend..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "Copying attached_assets to dist..."
cp -r attached_assets dist/

echo "Build complete!"

#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/web"
npm install
npm run build
npm run dev

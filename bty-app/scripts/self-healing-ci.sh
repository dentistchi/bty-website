#!/usr/bin/env bash

set -e

MAX_ATTEMPTS=5
ATTEMPT=1

echo "BTY SELF HEALING CI"

while [ $ATTEMPT -le $MAX_ATTEMPTS ]
do
  echo ""
  echo "Attempt $ATTEMPT / $MAX_ATTEMPTS"

  echo "Running lint..."
  if ! npm run lint; then
    echo "Lint failed"
    exit 1
  fi

  echo "Running tests..."
  if ! npm test; then
    echo "Tests failed"
    exit 1
  fi

  echo "Running build..."
  if npm run build; then
    echo "Build successful"
    exit 0
  fi

  echo "Build failed"
  ATTEMPT=$((ATTEMPT+1))
done

echo "CI failed after retries"
exit 1

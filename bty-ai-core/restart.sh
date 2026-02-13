#!/bin/bash

# Kill existing processes
echo "🛑 Stopping existing processes..."

# Kill bty-ai-core (port 4000)
lsof -i :4000 -t | xargs kill 2>/dev/null && echo "✓ Stopped bty-ai-core (4000)" || echo "⊘ No process on 4000"

# Kill bty-bot (port 3978)
lsof -i :3978 -t | xargs kill 2>/dev/null && echo "✓ Stopped bty-bot (3978)" || echo "⊘ No process on 3978"

sleep 1

echo ""
echo "🚀 Starting services..."
echo ""

# Start bty-ai-core
echo "Starting bty-ai-core..."
cd "$(dirname "$0")"
npm run dev &
CORE_PID=$!
echo "bty-ai-core PID: $CORE_PID"

# Wait a bit for core to start
sleep 3

# Start bty-bot
echo "Starting bty-bot..."
cd ../bty-bot
npm start &
BOT_PID=$!
echo "bty-bot PID: $BOT_PID"

echo ""
echo "✅ Services started!"
echo ""
echo "bty-ai-core: http://localhost:4000"
echo "bty-bot:     http://localhost:3978"
echo ""
echo "To stop: kill $CORE_PID $BOT_PID"

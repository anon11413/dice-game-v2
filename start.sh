#!/bin/bash
# DiceStock — One Command Launcher
# Usage: ./start.sh [--speed 50] [--port 3001] [--seed 42]

set -e

SPEED="${ENGINE_SPEED_PCT:-25}"
PORT="${PORT:-3001}"
SEED="${SEED:-42}"

# Parse command-line flags
while [[ $# -gt 0 ]]; do
  case $1 in
    --speed)  SPEED="$2";  shift 2 ;;
    --port)   PORT="$2";   shift 2 ;;
    --seed)   SEED="$2";   shift 2 ;;
    --help|-h)
      echo "DiceStock Launcher"
      echo ""
      echo "Usage: ./start.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --speed N   Engine speed 1-100 (default: 25, where 100 = 25 ticks/sec)"
      echo "  --port  N   HTTP port (default: 3001)"
      echo "  --seed  N   PRNG seed for simulation (default: 42)"
      echo "  --help      Show this help"
      echo ""
      echo "Examples:"
      echo "  ./start.sh                        # defaults"
      echo "  ./start.sh --speed 100            # full speed"
      echo "  ./start.sh --speed 10 --seed 999  # slow, custom seed"
      exit 0
      ;;
    *) echo "Unknown option: $1 (use --help)"; exit 1 ;;
  esac
done

echo "============================================"
echo "  DiceStock Simulator"
echo "  Speed: ${SPEED}%  |  Port: ${PORT}  |  Seed: ${SEED}"
echo "============================================"

# Check Node.js
if ! command -v node &>/dev/null; then
  echo ""
  echo "ERROR: Node.js is not installed."
  echo ""
  echo "Install on Chromebook Linux (Debian):"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  echo ""
  echo "Or install via nvm:"
  echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  echo "  nvm install 20"
  exit 1
fi

echo "Node $(node --version) detected"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build frontend if needed
if [ ! -d "dist" ]; then
  echo "Building frontend..."
  npm run build
fi

echo ""
echo "Starting DiceStock on http://localhost:${PORT}"
echo "Press Ctrl+C to stop (state will be saved)"
echo ""

# Run forever
export ENGINE_SPEED_PCT="$SPEED"
export PORT="$PORT"
export SEED="$SEED"
export NODE_ENV=production

exec npx tsx server/index.ts

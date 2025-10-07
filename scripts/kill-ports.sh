#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# Kill Processes on Specific Ports
# ═══════════════════════════════════════════════════════════════
# Usage: bash scripts/kill-ports.sh
# Ports: 6060, 6061 (Frontend), 7075 (Backend)
# ═══════════════════════════════════════════════════════════════

echo "🧹 Cleaning up existing processes..."

# Ports to clean
FRONTEND_PORTS=(6060 6061)
BACKEND_PORT=7075

# Function to kill process on a specific port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)

    if [ -n "$pids" ]; then
        echo "  ❌ Found process on port $port (PID: $pids)"
        kill -9 $pids 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "  ✅ Killed process on port $port"
        else
            echo "  ⚠️  Failed to kill process on port $port (may require sudo)"
        fi
    else
        echo "  ✓  Port $port is free"
    fi
}

# Clean frontend ports
echo ""
echo "Frontend Ports (6060, 6061):"
for port in "${FRONTEND_PORTS[@]}"; do
    kill_port $port
done

# Clean backend port
echo ""
echo "Backend Port (7075):"
kill_port $BACKEND_PORT

echo ""
echo "✨ Port cleanup complete!"
echo ""

#!/bin/bash
# Create a new account for the Telegram Event Reservation Bot

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Creating account...${NC}"

# SSH to telegram-bot.local and run the create-account script
ssh telegram-bot.local 'cd ~/apps/telegram-event-reservation-bot && docker compose exec app npm run create-account'

echo -e "${GREEN}Done!${NC}"

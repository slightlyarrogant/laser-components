#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Laser Components Setup Script ===${NC}"
echo "This script will set up your development environment."
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js v18 or higher.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Node.js version $NODE_VERSION detected. Please upgrade to v18 or higher.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js v$(node -v) is installed.${NC}"

# Install dependencies
echo
echo -e "${BLUE}Installing project dependencies...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install dependencies.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Dependencies installed successfully.${NC}"

# Set up frontend environment
echo
echo -e "${BLUE}Setting up frontend environment...${NC}"
if [ ! -f frontend/.env ]; then
    echo "Creating frontend/.env file from example..."
    cp frontend/.env.example frontend/.env
    echo -e "${GREEN}✓ Created frontend/.env file.${NC}"
fi

# Set up frontend dependencies
echo "Installing frontend dependencies..."
cd frontend && npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install frontend dependencies.${NC}"
    exit 1
fi
cd ..
echo -e "${GREEN}✓ Frontend dependencies installed successfully.${NC}"

# Set up backend environment
echo
echo -e "${BLUE}Setting up backend environment...${NC}"
if [ ! -f backend/.env ]; then
    echo "Creating backend/.env file from example..."
    if [ -f backend/.env.example ]; then
        cp backend/.env.example backend/.env
        echo -e "${GREEN}✓ Created backend/.env file.${NC}"
    else
        echo "WARNING: backend/.env.example file not found. You'll need to create backend/.env manually."
    fi
fi

# Run database migrations
echo
echo -e "${BLUE}Running database migrations...${NC}"
npx prisma migrate dev
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to run database migrations.${NC}"
    echo "You may need to configure your database connection in backend/.env first."
    echo "Then run 'npx prisma migrate dev' manually."
else
    echo -e "${GREEN}✓ Database migrations applied successfully.${NC}"
fi

# Make setup.sh executable
chmod +x setup.sh

echo
echo -e "${GREEN}=== Setup complete! ===${NC}"
echo "You can now start the application with one of these commands:"
echo "  • npm run start - Start both frontend and backend"
echo "  • npm run start:frontend - Start only the frontend"
echo "  • npm run start:backend - Start only the backend"
echo
echo "Happy coding!" 
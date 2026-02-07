FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (needed for build)
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Start the application
CMD ["npm", "start"]

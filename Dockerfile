FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Generate Prisma client
RUN npm run prisma:generate

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cedipay -u 1001

# Change ownership of the app directory
RUN chown -R cedipay:nodejs /app
USER cedipay

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["npm", "start"]
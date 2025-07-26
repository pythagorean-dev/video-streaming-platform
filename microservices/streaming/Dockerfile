FROM node:18-alpine

# Install dependencies for HLS/DASH streaming
RUN apk add --no-cache \
    ffmpeg \
    nginx \
    supervisor \
    openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/
COPY nginx/ ./nginx/
COPY supervisord.conf ./
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Create directories
RUN mkdir -p /var/log/supervisor \
    /var/log/nginx \
    /app/hls \
    /app/dash \
    /app/recordings

# Set up nginx
RUN rm -f /etc/nginx/nginx.conf
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Set permissions
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app /var/log/nginx /var/lib/nginx
USER nodejs

EXPOSE 1935 8080 3004

CMD ["supervisord", "-c", "/app/supervisord.conf"]
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    pkg-config \
    libvips-dev \
    build-essential \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g npm@latest

RUN npm config set registry https://registry.npmjs.org/

COPY package.json ./

RUN npm install --omit=dev --no-audit --no-fund \
    --fetch-retries=5 \
    --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=120000

COPY . .

CMD ["npm", "start"]

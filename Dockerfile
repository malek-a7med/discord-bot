FROM node:22-slim

RUN apt-get update && apt-get install -y \
    ffmpeg python3 pkg-config libvips-dev build-essential \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare yarn@stable --activate

WORKDIR /app

COPY package*.json ./

RUN yarn install --non-interactive

COPY . .

CMD ["npm", "start"]

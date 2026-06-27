FROM node:22-slim

RUN apt-get update && apt-get install -y \
    ffmpeg python3 pkg-config libvips-dev build-essential \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare yarn@stable --activate

WORKDIR /app

ENV NODE_ENV=development

COPY package*.json ./

RUN yarn install

COPY . .

ENV NODE_ENV=production

CMD ["npm", "start"]

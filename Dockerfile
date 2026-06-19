FROM node:22-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    pkg-config \
    libvips-dev \
    build-essential \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "start"]

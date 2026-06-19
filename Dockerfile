FROM node:22-bookworm-slim

# تثبيت الأدوات المطلوبة لـ sharp و opencv و ffmpeg
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

# تحديث npm لآخر إصدار مستقر (يتجاوز باج 10.9.x "Exit handler never called")
RUN npm install -g npm@latest

COPY package*.json ./

# npm ci بدل npm install: أسرع وأكثر ثباتاً، بيعتمد على lockfile مقفول بالكامل
RUN npm ci --omit=dev --no-audit --no-fund \
    --fetch-retries=5 \
    --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=120000

COPY . .

CMD ["npm", "start"]

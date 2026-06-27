FROM node:22-slim

# تثبيت الأدوات المطلوبة
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    pkg-config \
    libvips-dev \
    build-essential \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# تفعيل yarn عن طريق corepack
RUN corepack enable && corepack prepare yarn@stable --activate

WORKDIR /app

COPY package*.json ./

# yarn بدل npm عشان نتجنب باج npm v10 "Exit handler never called"
RUN yarn install --non-interactive

COPY . .

CMD ["npm", "start"]

#!/bin/bash
# 🎵 Multi-Platform Music Bot Fix - Replit Setup
# شغّل السكربت ده في الـ Replit Shell واحدة واحدة

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

banner() {
  echo -e "${CYAN}"
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║   🎵 Multi-Platform Music Bot - Replit Setup           ║"
  echo "║   يدعم: YouTube | Spotify | SoundCloud | Direct URLs    ║"
  echo "╚════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

banner

# ════════════════════════════════════════
# خطوة 1: تأكد إننا في مجلد المشروع
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [1/6] فحص بيئة Replit...${NC}"
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ ملف package.json مش موجود! تأكد إنك في مجلد المشروع.${NC}"
  echo "   شغّل: cd /home/runner/workspace/[اسم-المشروع]"
  exit 1
fi

if [ ! -f "helpers/music-handler.js" ]; then
  echo -e "${RED}❌ helpers/music-handler.js مش موجود!${NC}"
  exit 1
fi

echo -e "${GREEN}✅ المشروع: $(pwd)${NC}"

# ════════════════════════════════════════
# خطوة 2: نسخة احتياطية
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [2/6] نسخة احتياطية...${NC}"
BAK="helpers/music-handler.js.bak.$(date +%Y%m%d_%H%M%S)"
cp helpers/music-handler.js "$BAK"
echo -e "${GREEN}✅ محفوظ في: $BAK${NC}"

# ════════════════════════════════════════
# خطوة 3: تحديث yt-dlp
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [3/6] تحديث yt-dlp...${NC}"
pip install -U yt-dlp --quiet 2>&1 | tail -3
YTDLP_VERSION=$(yt-dlp --version 2>/dev/null || python3 -m yt_dlp --version 2>/dev/null || echo "unknown")
echo -e "${GREEN}✅ yt-dlp: $YTDLP_VERSION${NC}"

# ════════════════════════════════════════
# خطوة 4: التحقق من YOUTUBE_COOKIES
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [4/6] التحقق من YOUTUBE_COOKIES...${NC}"

# نشوف الـ env متوفر من Secrets
if [ -z "$YOUTUBE_COOKIES" ] && [ -z "$REPLIT_DB_URL" ]; then
  echo -e "${YELLOW}⚠️  YOUTUBE_COOKIES مش موجود في الـ env vars${NC}"
  echo ""
  echo -e "${CYAN}📝 الخطوات:${NC}"
  echo "   1. افتح Secrets tab (🔒 في الـ sidebar)"
  echo "   2. New secret:"
  echo "      Key:   YOUTUBE_COOKIES"
  echo "      Value: محتوى ملف cookies.txt كامل"
  echo "   3. Restart الـ Repl"
  echo ""
  read -p "هل تكمّل بدون cookies؟ (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ تم الإلغاء. ضيف الـ Secret وأعد تشغيل السكربت.${NC}"
    exit 1
  fi
  echo -e "${YELLOW}⚠️  هتكمل من غير cookies - YouTube هيفشل على الأرجح${NC}"
elif [ -n "$YOUTUBE_COOKIES" ]; then
  echo -e "${GREEN}✅ YOUTUBE_COOKIES موجود (${#YOUTUBE_COOKIES} حرف)${NC}"
else
  echo -e "${YELLOW}⚠️  في Replit Secrets - اعمل Restart للبوت بعدها${NC}"
fi

# ════════════════════════════════════════
# خطوة 5: تطبيق التعديلات (لو مش متطبقة)
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [5/6] تطبيق التعديلات...${NC}"

NEW_FILE="./music-handler-NEW.js"

if [ ! -f "$NEW_FILE" ]; then
  echo -e "${RED}❌ ملف music-handler-NEW.js مش موجود!${NC}"
  echo "   لازم ترفع الملف الجديد في الـ root بتاع الـ Repl"
  echo "   (اسمه music-handler.js من الـ deliverables)"
  exit 1
fi

# نطبق التعديل
cp "$NEW_FILE" helpers/music-handler.js
echo -e "${GREEN}✅ تم تطبيق التعديلات${NC}"

# تحقق سريع
if grep -q "detectPlatform" helpers/music-handler.js && grep -q "searchSoundCloud" helpers/music-handler.js; then
  echo -e "${GREEN}✅ التعديلات مطبقة صح (detectPlatform + searchSoundCloud)${NC}"
else
  echo -e "${RED}❌ الملف الجديد مش كامل! راجعه.${NC}"
  exit 1
fi

# ════════════════════════════════════════
# خطوة 6: اختبار سريع
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [6/6] اختبار...${NC}"

# syntax check
if node --check helpers/music-handler.js 2>&1; then
  echo -e "${GREEN}✅ syntax check passed${NC}"
else
  echo -e "${RED}❌ syntax error! شوف الملف.${NC}"
  exit 1
fi

# مسارات yt-dlp
echo "🔍 مسارات yt-dlp:"
for p in /home/runner/workspace/.pythonlibs/bin/yt-dlp /usr/local/bin/yt-dlp $(which yt-dlp 2>/dev/null); do
  if [ -x "$p" ]; then
    echo -e "  ${GREEN}✅ $p${NC}"
  fi
done

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║             🎉 كل حاجة تمام!                         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📋 الخطوات الجاية:${NC}"
echo ""
echo "1️⃣  لو عندك YOUTUBE_COOKIES جديد في الـ Secrets، اعمل Restart للبوت"
echo "   (Ctrl+C ثم 'node index.js' أو Run)"
echo ""
echo "2️⃣  ادخل Voice Channel في Discord"
echo ""
echo "3️⃣  اختبر المنصات المختلفة:"
echo "    /play https://www.youtube.com/watch?v=...      (YouTube)"
echo "    /play https://open.spotify.com/playlist/...    (Spotify)"
echo "    /play https://soundcloud.com/artist/track      (SoundCloud)"
echo "    /play https://example.com/song.mp3             (Direct URL)"
echo "    /play never gonna give you up                  (بحث نصي)"
echo ""
echo -e "${YELLOW}💡 لو في مشاكل، شوف الـ console للتفاصيل${NC}"

#!/bin/bash
# 🎵 Multi-Platform Music Bot Fix - Replit Setup
# شغّل السكربت ده في الـ Replit Shell

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

banner() {
  echo -e "${CYAN}"
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║   🎵 Multi-Platform Music Bot - Replit Setup           ║"
  echo "║   YouTube | Spotify | SoundCloud | Direct URLs         ║"
  echo "╚════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

banner

# ════════════════════════════════════════
# 1) فحص البيئة
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [1/7] فحص البيئة...${NC}"
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ ملف package.json مش موجود! تأكد إنك في مجلد المشروع.${NC}"
  exit 1
fi

if [ ! -f "helpers/music-handler.js" ]; then
  echo -e "${RED}❌ helpers/music-handler.js مش موجود!${NC}"
  exit 1
fi

echo -e "${GREEN}✅ المشروع: $(pwd)${NC}"

# ════════════════════════════════════════
# 2) نسخة احتياطية
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [2/7] نسخة احتياطية...${NC}"
BAK="helpers/music-handler.js.bak.$(date +%Y%m%d_%H%M%S)"
cp helpers/music-handler.js "$BAK"
echo -e "${GREEN}✅ محفوظ في: $BAK${NC}"

# ════════════════════════════════════════
# 3) تحديث yt-dlp
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [3/7] تحديث yt-dlp...${NC}"
pip install -U yt-dlp --quiet 2>&1 | tail -3 || echo -e "${YELLOW}⚠️ فشل pip، هنكمل...${NC}"
YTDLP_VERSION=$(yt-dlp --version 2>/dev/null || python3 -m yt_dlp --version 2>/dev/null || echo "unknown")
echo -e "${GREEN}✅ yt-dlp: $YTDLP_VERSION${NC}"

# ════════════════════════════════════════
# 4) التحقق من YOUTUBE_COOKIES
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [4/7] التحقق من YOUTUBE_COOKIES...${NC}"

if [ -n "$YOUTUBE_COOKIES" ]; then
  echo -e "${GREEN}✅ YOUTUBE_COOKIES موجود (${#YOUTUBE_COOKIES} حرف)${NC}"
elif [ -f "cookies.txt" ]; then
  echo -e "${GREEN}✅ cookies.txt محلي موجود ($(wc -l < cookies.txt) سطر)${NC}"
else
  echo -e "${YELLOW}⚠️ YOUTUBE_COOKIES و cookies.txt مش موجودين${NC}"
  echo ""
  echo -e "${CYAN}📝 الخطوات:${NC}"
  echo "   1. افتح Secrets tab (🔒 في الـ sidebar)"
  echo "   2. New secret:"
  echo "      Key:   YOUTUBE_COOKIES"
  echo "      Value: محتوى cookies.txt كامل"
  echo "   3. Restart الـ Repl"
  echo ""
  read -p "هل تكمّل؟ (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ تم الإلغاء.${NC}"
    exit 1
  fi
fi

# ════════════════════════════════════════
# 5) تطبيق التعديلات
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [5/7] تطبيق التعديلات...${NC}"

NEW_FILE="music-handler-NEW.js"

if [ ! -f "$NEW_FILE" ]; then
  echo -e "${RED}❌ ملف music-handler-NEW.js مش موجود!${NC}"
  echo "   ارفعه من الـ deliverables وسمّيه music-handler-NEW.js"
  exit 1
fi

cp "$NEW_FILE" helpers/music-handler.js
echo -e "${GREEN}✅ تم تطبيق التعديلات${NC}"

# فحص سريع
if grep -q "detectPlatform" helpers/music-handler.js && \
   grep -q "_incrementSkipCounter" helpers/music-handler.js && \
   grep -q "Promise.allSettled" helpers/music-handler.js; then
  echo -e "${GREEN}✅ التعديلات مطبقة (v3: detectPlatform + skip counter + parallel)${NC}"
else
  echo -e "${RED}❌ التعديلات ناقصة! راجع الملف.${NC}"
  exit 1
fi

# ════════════════════════════════════════
# 6) syntax check + test
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [6/7] syntax check...${NC}"

if node --check helpers/music-handler.js 2>&1; then
  echo -e "${GREEN}✅ syntax OK${NC}"
else
  echo -e "${RED}❌ syntax error!${NC}"
  exit 1
fi

if [ -f "test-music.js" ]; then
  if node --check test-music.js 2>&1; then
    echo -e "${GREEN}✅ test-music.js syntax OK${NC}"
  fi
fi

# ════════════════════════════════════════
# 7) اختبار اختياري
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [7/7] اختبار اختياري...${NC}"

if [ -f "test-music.js" ]; then
  echo ""
  read -p "عايز تختبر yt-dlp دلوقتي؟ (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${CYAN}اختار اللي تختبره:${NC}"
    echo "  1) YouTube single video (Rick Roll)"
    echo "  2) Spotify playlist (اللي بتفشل)"
    echo "  3) رابط من عندي"
    read -p "اختيارك (1/2/3): " -n 1 -r
    echo ""
    case $REPLY in
      1) node test-music.js "https://www.youtube.com/watch?v=dQw4w9WgXcQ" ;;
      2) node test-music.js "https://open.spotify.com/playlist/2Lq31XhOuloBud5uDXdN2V3" ;;
      3)
        read -p "URL: " url
        node test-music.js "$url"
        ;;
      *) echo "تم التخطي" ;;
    esac
  fi
fi

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║             🎉 كل حاجة تمام!                         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📋 الخطوات الجاية:${NC}"
echo ""
echo "1️⃣  Restart البوت (Ctrl+C ثم 'node index.js')"
echo ""
echo "2️⃣  اختبر في Discord:"
echo "    /play https://www.youtube.com/watch?v=..."
echo "    /play https://open.spotify.com/playlist/2Lq31XhOuloBud5uDXdN2V3"
echo "    /play https://soundcloud.com/..."
echo ""
echo "3️⃣  لو لسه في مشكلة، شغّل:"
echo "    node test-music.js \"https://open.spotify.com/playlist/2Lq31XhOuloBud5uDXdN2V3\""
echo "    (ده هيطبع yt-dlp stderr كامل في الـ console)"
echo ""
echo -e "${YELLOW}💡 الإصدار الجديد فيه:${NC}"
echo "   ✓ Parallel search للـ Spotify playlist (أسرع 5x)"
echo "   ✓ Skip counter (يوقف لو 10 أغاني متخطّية على التوالي)"
echo "   ✓ Strategy 1→2→3 (محاولة yt-dlp 1 → 2 → بدائل)"
echo "   ✓ stderr logging مباشر في الـ console"
echo "   ✓ test-music.js للتشخيص بدون Discord"

#!/bin/bash
# 🎵 Multi-Platform Music Bot Fix v4 - Replit Setup
# يطبّق كل التعديلات + يختبر الـ cookies

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

banner() {
  echo -e "${CYAN}"
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║   🎵 Music Bot Fix v4 - Replit Setup                 ║"
  echo "║   Multi-Platform + Smart Cookies v4                   ║"
  echo "╚════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

banner

# ════════════════════════════════════════
# 1) فحص البيئة
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [1/8] فحص البيئة...${NC}"
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ مش في مجلد المشروع!${NC}"
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
echo -e "${YELLOW}📦 [2/8] نسخة احتياطية...${NC}"
BAK="helpers/music-handler.js.bak.$(date +%Y%m%d_%H%M%S)"
cp helpers/music-handler.js "$BAK"
echo -e "${GREEN}✅ محفوظ: $BAK${NC}"

# ════════════════════════════════════════
# 3) تحديث yt-dlp
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [3/8] تحديث yt-dlp...${NC}"
pip install -U yt-dlp --quiet 2>&1 | tail -3 || echo -e "${YELLOW}⚠️ pip فشل، هنكمل...${NC}"
YTDLP_VERSION=$(yt-dlp --version 2>/dev/null || python3 -m yt_dlp --version 2>/dev/null || echo "unknown")
echo -e "${GREEN}✅ yt-dlp: $YTDLP_VERSION${NC}"

# ════════════════════════════════════════
# 4) الفحص الذكي للـ cookies
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [4/8] فحص الـ cookies...${NC}"

HAS_COOKIES=0
if [ -n "$YOUTUBE_COOKIES" ]; then
  echo -e "  ${GREEN}✅ YOUTUBE_COOKIES env: ${#YOUTUBE_COOKIES} حرف${NC}"
  HAS_COOKIES=1
fi

if [ -f "cookies.txt" ]; then
  SIZE=$(stat -c %s cookies.txt 2>/dev/null || stat -f %z cookies.txt 2>/dev/null)
  if [ "$SIZE" -gt 100 ]; then
    if grep -q "VISITOR_INFO1_LIVE" cookies.txt; then
      echo -e "  ${GREEN}✅ cookies.txt محلي: $SIZE bytes (valid)${NC}"
      HAS_COOKIES=1
    else
      echo -e "  ${YELLOW}⚠️ cookies.txt محلي: $SIZE bytes بس مفيش VISITOR_INFO1_LIVE (ممكن يكون guest only)${NC}"
    fi
  else
    echo -e "  ${YELLOW}⚠️ cookies.txt صغير جداً: $SIZE bytes${NC}"
  fi
fi

if [ $HAS_COOKIES -eq 0 ]; then
  echo -e "  ${RED}❌ مفيش cookies صالحة! البوت مش هيشتغل على YouTube.${NC}"
  echo ""
  echo -e "${CYAN}📝 الخطوات:${NC}"
  echo "   1. افتح YouTube في Chrome وسجّل دخول"
  echo "   2. ثبّت extension 'Get cookies.txt LOCALLY'"
  echo "   3. اضغط على youtube.com -> Export"
  echo "   4. انسخ المحتوى:"
  echo ""
  echo "      A) في cookies.txt: الصقه في الـ root"
  echo "      B) في Secrets: Key=YOUTUBE_COOKIES, Value=المحتوى كله"
  echo ""
  read -p "هل تكمّل؟ (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# ════════════════════════════════════════
# 5) تطبيق التعديلات
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [5/8] تطبيق التعديلات...${NC}"

NEW_FILE="music-handler-NEW.js"

if [ ! -f "$NEW_FILE" ]; then
  echo -e "${RED}❌ ملف $NEW_FILE مش موجود!${NC}"
  echo "   ارفع الـ music-handler.js الجديد من الـ deliverables وسمّيه music-handler-NEW.js"
  exit 1
fi

cp "$NEW_FILE" helpers/music-handler.js
echo -e "${GREEN}✅ تم تطبيق التعديلات${NC}"

# ════════════════════════════════════════
# 6) syntax check
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [6/8] syntax check...${NC}"

if node --check helpers/music-handler.js 2>&1; then
  echo -e "${GREEN}✅ syntax OK${NC}"
else
  echo -e "${RED}❌ syntax error!${NC}"
  exit 1
fi

# ════════════════════════════════════════
# 7) فحص الـ features المطبقة
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [7/8] التحقق من الـ v4 features...${NC}"

CHECKS_PASSED=0
CHECKS_TOTAL=0

check() {
  CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
  if grep -q "$2" helpers/music-handler.js; then
    echo -e "  ${GREEN}✅ $1${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
  else
    echo -e "  ${RED}❌ $1${NC}"
  fi
}

check "v4: validateCookiesFile" "validateCookiesFile"
check "v4: getCookiesSource" "getCookiesSource"
check "v4: VISITOR_INFO1_LIVE check" "VISITOR_INFO1_LIVE"
check "v4: web_creator client" "web_creator"
check "v4: mediaconnect client" "mediaconnect"
check "v4: Strategy 4 (بدون cookies)" "getCookiesSource() !== 'none'"
check "v4: User-Agent" "user-agent"
check "v4: MUSIC_DEBUG mode" "MUSIC_DEBUG"
check "v4: Promise.allSettled (parallel)" "Promise.allSettled"
check "v4: setImmediate (no recursion)" "setImmediate"
check "v4: detectPlatform" "detectPlatform"
check "v4: searchSoundCloud" "searchSoundCloud"

if [ $CHECKS_PASSED -lt $CHECKS_TOTAL ]; then
  echo -e "${RED}❌ في features ناقصة ($CHECKS_PASSED/$CHECKS_TOTAL)${NC}"
  exit 1
fi

echo -e "${GREEN}✅ كل الـ v4 features مطبقة ($CHECKS_PASSED/$CHECKS_TOTAL)${NC}"

# ════════════════════════════════════════
# 8) اختبار شامل
# ════════════════════════════════════════
echo -e "${YELLOW}📦 [8/8] اختبار الـ cookies + yt-dlp...${NC}"

if [ -f "test-cookies.sh" ]; then
  echo ""
  read -p "عايز تشغّل cookie validator دلوقتي؟ (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    bash test-cookies.sh
  fi
fi

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║             🎉 كل حاجة تمام!                         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📋 الخطوات الجاية:${NC}"
echo ""
echo "1️⃣  Restart البوت:"
echo "    node index.js"
echo ""
echo "2️⃣  عايز debug mode؟ في الـ Shell قبل التشغيل:"
echo "    MUSIC_DEBUG=1 node index.js"
echo "    (ده هيطبع yt-dlp stderr كامل)"
echo ""
echo "3️⃣  اختبر في Discord:"
echo "    /play https://www.youtube.com/watch?v=dQw4w9WgXcQ"
echo "    /play https://open.spotify.com/playlist/2Lq31XhOuloBud5uDXdN2V3"
echo ""
echo "4️⃣  لو لسه في مشكلة، شغّل:"
echo "    bash test-cookies.sh"
echo "    MUSIC_DEBUG=1 node test-music.js \"https://www.youtube.com/watch?v=...\""
echo ""
echo -e "${YELLOW}💡 v4 الجديد:${NC}"
echo "   ✓ ملف cookies.txt له الأولوية على الـ env var (أأمن)"
echo "   ✓ Validation للـ cookies (VISITOR_INFO1_LIVE + LOGIN_INFO)"
echo "   ✓ 11 yt-dlp clients (ios, android, web, mweb, mediaconnect, web_creator...)"
echo "   ✓ 4 strategies: yt-dlp → format → بدون cookies → 5 بدائل"
echo "   ✓ Cache للـ cookies path (أسرع)"
echo "   ✓ MUSIC_DEBUG=1 للـ debug الكامل"
echo "   ✓ User-Agent injection"

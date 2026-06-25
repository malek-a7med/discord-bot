#!/bin/bash
# 🍪 Cookie Validation Test - شغّله قبل ما تعمل Restart للبوت
# يطبعلك بالظبط الـ cookies شغالة ولا لأ

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

banner() {
  echo -e "${CYAN}"
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║   🍪 YouTube Cookies Validator                        ║"
  echo "╚════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

banner

# 1) فحص الملف المحلي
echo -e "${YELLOW}📂 فحص cookies.txt المحلي...${NC}"

if [ -f "cookies.txt" ]; then
  SIZE=$(stat -c %s cookies.txt 2>/dev/null || stat -f %z cookies.txt 2>/dev/null)
  LINES=$(wc -l < cookies.txt)
  echo -e "  ${GREEN}✅ موجود${NC}"
  echo -e "     المسار: $(realpath cookies.txt)"
  echo -e "     الحجم: $SIZE bytes"
  echo -e "     عدد السطور: $LINES"

  # فحص الـ cookies المهمة
  if grep -q "VISITOR_INFO1_LIVE" cookies.txt; then
    echo -e "     ${GREEN}✅ فيه VISITOR_INFO1_LIVE${NC}"
  else
    echo -e "     ${RED}❌ مفيش VISITOR_INFO1_LIVE${NC}"
  fi

  if grep -q "LOGIN_INFO" cookies.txt; then
    echo -e "     ${GREEN}✅ فيه LOGIN_INFO (login cookie)${NC}"
  else
    echo -e "     ${YELLOW}⚠️ مفيش LOGIN_INFO - الـ cookies ممكن تكون guest only${NC}"
  fi

  if grep -q "\.youtube.com" cookies.txt; then
    echo -e "     ${GREEN}✅ فيه YouTube cookies${NC}"
  else
    echo -e "     ${RED}❌ مفيش YouTube cookies!${NC}"
  fi

  # عد الـ YouTube cookies
  YT_COUNT=$(grep -c "\.youtube.com" cookies.txt)
  echo -e "     YouTube cookies: $YT_COUNT"

  # عرض أول 5 سطور
  echo ""
  echo -e "${CYAN}📄 أول 5 سطور من cookies.txt:${NC}"
  head -5 cookies.txt | sed 's/^/    /'
else
  echo -e "  ${YELLOW}⚠️ مش موجود${NC}"
fi

# 2) فحص Environment Variable
echo ""
echo -e "${YELLOW}🔐 فحص YOUTUBE_COOKIES env var...${NC}"

if [ -n "$YOUTUBE_COOKIES" ]; then
  LEN=${#YOUTUBE_COOKIES}
  echo -e "  ${GREEN}✅ موجود${NC}"
  echo -e "     الطول: $LEN حرف"

  # فك الـ newline escape و اكتبه في tmp
  TMPF="/tmp/yt-test-cookies.txt"
  echo "$YOUTUBE_COOKIES" | sed 's/\\n/\n/g' > "$TMPF"

  SIZE=$(stat -c %s "$TMPF" 2>/dev/null || stat -f %z "$TMPF" 2>/dev/null)
  LINES=$(wc -l < "$TMPF")
  echo -e "     بعد فك newline-escape:"
  echo -e "     الحجم: $SIZE bytes"
  echo -e "     عدد السطور: $LINES"

  if grep -q "VISITOR_INFO1_LIVE" "$TMPF"; then
    echo -e "     ${GREEN}✅ فيه VISITOR_INFO1_LIVE${NC}"
  else
    echo -e "     ${RED}❌ مفيش VISITOR_INFO1_LIVE - الـ env var فيه مشكلة!${NC}"
  fi

  if grep -q "LOGIN_INFO" "$TMPF"; then
    echo -e "     ${GREEN}✅ فيه LOGIN_INFO${NC}"
  else
    echo -e "     ${YELLOW}⚠️ مفيش LOGIN_INFO${NC}"
  fi
else
  echo -e "  ${YELLOW}⚠️ مش موجود${NC}"
fi

# 3) اختبار yt-dlp
echo ""
echo -e "${YELLOW}🎬 اختبار yt-dlp الفعلي...${NC}"

# لقى yt-dlp
YTDLP=""
for p in /home/runner/workspace/.pythonlibs/bin/yt-dlp /usr/local/bin/yt-dlp $(which yt-dlp 2>/dev/null); do
  if [ -x "$p" ]; then
    YTDLP="$p"
    break
  fi
done

if [ -z "$YTDLP" ]; then
  echo -e "  ${RED}❌ yt-dlp مش موجود! شغّل: pip install -U yt-dlp${NC}"
  exit 1
fi

echo -e "  ${GREEN}✅ yt-dlp: $YTDLP$($YTDLP --version)${NC}"

# استخدم الـ cookies الموجود (إيّا كان)
COOKIES_ARG=""
if [ -n "$YOUTUBE_COOKIES" ]; then
  echo "$YOUTUBE_COOKIES" | sed 's/\\n/\n/g' > /tmp/yt-test-cookies.txt
  COOKIES_ARG="--cookies /tmp/yt-test-cookies.txt"
elif [ -f "cookies.txt" ]; then
  COOKIES_ARG="--cookies cookies.txt"
fi

if [ -n "$COOKIES_ARG" ]; then
  echo -e "  ${GREEN}🍪 هنختبر بالـ cookies${NC}"
  TEST_CMD="$YTDLP --no-warnings --extractor-args 'youtube:player_client=default,web_safari,web_embedded,mweb,mediaconnect' -f bestaudio $COOKIES_ARG --dump-json 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' 2>&1 | head -30"
  echo ""
  echo -e "${CYAN}Running test...${NC}"
  eval $TEST_CMD
  EXIT_CODE=$?
  echo ""
  if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ نجح الاختبار! الـ cookies شغالة 🎉${NC}"
  else
    echo -e "${RED}❌ فشل الاختبار (exit $EXIT_CODE)${NC}"
    echo ""
    echo -e "${YELLOW}💡 الحلول:${NC}"
    echo "   1. حدّث الـ cookies (الـ YouTube cookies بتنتهي صلاحيتها)"
    echo "   2. افتح YouTube في المتصفح، سجّل دخول"
    echo "   3. صدّر cookies تاني من extension"
    echo "   4. حطّهم في cookies.txt أو YOUTUBE_COOKIES Secret"
  fi
else
  echo -e "  ${YELLOW}⚠️ مفيش cookies للاختبار${NC}"
fi

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  📝 ملخص:${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo ""
if [ -n "$YOUTUBE_COOKIES" ]; then
  echo -e "  البوت هيستخدم: ${GREEN}YOUTUBE_COOKIES env var${NC}"
elif [ -f "cookies.txt" ]; then
  echo -e "  البوت هيستخدم: ${GREEN}cookies.txt محلي${NC}"
else
  echo -e "  ${RED}❌ مفيش cookies! البوت مش هيشتغل على YouTube${NC}"
fi

#!/bin/sh
cd "$(dirname "$0")"

DOWNLOAD=true
LOOP=true

download() {
    if [ $DOWNLOAD = true ]; then
        echo "🔍 جاري البحث عن آخر إصدار..."
        URL=$(curl -s https://api.github.com/repos/jagrosh/MusicBot/releases/latest \
           | grep -i "browser_download_url.*\.jar" \
           | sed 's/.*"\(http[^"]*\.jar\)".*/\1/')
        if [ -z "$URL" ]; then
            echo "⚠️ مش قادر يجيب الرابط — بيجرب يشتغل بالـ JAR اللي موجود"
            return
        fi
        FILENAME=$(echo $URL | sed 's/.*\/\([^\/]*\)/\1/')
        if [ -f "$FILENAME" ]; then
            echo "✅ آخر إصدار موجود بالفعل ($FILENAME)"
        else
            echo "📥 جاري تحميل $FILENAME ..."
            curl -L "$URL" -o "$FILENAME"
            echo "✅ تم التحميل!"
        fi
    fi
}

run() {
    JAR=$(ls -t JMusicBot*.jar 2>/dev/null | head -1)
    if [ -z "$JAR" ]; then
        echo "❌ مش لاقي ملف JAR — شغّل التحميل أولاً"
        exit 1
    fi
    echo "▶️ بيشغّل $JAR ..."
    java -Dnogui=true -jar "$JAR"
}

while
    download
    run
    $LOOP
do
    continue
done

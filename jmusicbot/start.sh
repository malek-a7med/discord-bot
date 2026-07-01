#!/bin/sh
cd "$(dirname "$0")"

LOOP=true

build() {
    if [ ! -f "target/JMusicBot-Snapshot.jar" ]; then
        echo "🔨 بيبني المشروع من السورس..."
        mvn package -q -DskipTests 2>&1
        if [ $? -ne 0 ]; then
            echo "❌ البناء فشل — بيجرب يحمل JAR جاهز..."
            URL=$(curl -s https://api.github.com/repos/jagrosh/MusicBot/releases/latest \
               | grep -i "browser_download_url.*\.jar" \
               | sed 's/.*"\(http[^"]*\.jar\)".*/\1/')
            if [ -n "$URL" ]; then
                FILENAME=$(echo $URL | sed 's/.*\/\([^\/]*\)/\1/')
                curl -L "$URL" -o "$FILENAME"
                echo "✅ تم التحميل: $FILENAME"
            fi
        else
            echo "✅ تم البناء بنجاح!"
        fi
    else
        echo "✅ الـ JAR موجود — مش محتاج يبني تاني"
    fi
}

run() {
    JAR=$(ls -t target/JMusicBot*.jar 2>/dev/null | head -1)
    if [ -z "$JAR" ]; then
        JAR=$(ls -t JMusicBot*.jar 2>/dev/null | head -1)
    fi
    if [ -z "$JAR" ]; then
        echo "❌ مش لاقي ملف JAR"
        exit 1
    fi
    echo "▶️ بيشغّل $JAR ..."
    java -Dnogui=true -jar "$JAR"
}

while
    build
    run
    $LOOP
do
    continue
done

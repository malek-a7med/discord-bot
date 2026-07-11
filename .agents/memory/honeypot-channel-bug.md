---
name: Honeypot channel ID collision bug (fixed)
description: Why the bot used to kick innocent members with reason "بوت أو هاكر" and where to check if it recurs.
---

كان في bug: قناة `1517362832063074324` (مستخدمة أصلاً كقناة سجلات الأوتومود/تحديثات الأوامر — 3 متغيرات مختلفة في index.js بترجع لنفس الـ ID) كانت متسجلة غلط جوه `HONEYPOT_CHANNEL_IDS` في helpers/auto-mod.js.
النتيجة: أي رسالة عادية في القناة دي كانت بتتحسب "🍯 Honeypot — بوت أو هاكر" بثقة 100% وتاخد إجراء طرد فوري بدون سبب حقيقي.
الحل: مسحنا الـ ID الثابت من `HONEYPOT_CHANNEL_IDS`؛ فضل بس `process.env.HONEYPOT_CHANNEL` (لو محدد). قناة المصيدة الحقيقية شغالة بمنطق منفصل تمامًا في index.js (`TRAP_CHANNEL_ID`) وده لسه شغال زي ما هو.

**لو الموضوع رجع تاني:** ابحث عن أي ID قناة متكرر في أكتر من متغير/ملف (زي ده) قبل ما تضيفه لأي قايمة "trap/honeypot/blacklist" — التكرار غالبًا معناه القناة دي أصلها لوظيفة تانية شرعية.

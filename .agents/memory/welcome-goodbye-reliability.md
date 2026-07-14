---
name: Welcome/goodbye message reliability
description: Why welcome/goodbye embeds used to fail silently for a fraction of members, the fix pattern, and current user decisions about welcome/goodbye + join-leave activity log.
---

المشكلة: رسايل الترحيب/الوداع كانت شغالة بس مش 100% من الوقت.
السبب الرئيسي: في حدث `guildMemberRemove`، الـ `member` ممكن يكون "partial" (مش متخزن في كاش الديسكورد) فـ `member.user` بيبقى `undefined`. أي كود بيستخدم `member.user.displayAvatarURL()` مباشرة (من غير `?.`) كان بيرمي exception تتبلع في الـ try/catch الخارجي، فالرسالة كلها ما كانتش بتتبعت من غير أي أثر واضح في اللوج.
سبب ثانوي: البحث عن قناة الترحيب كان بس عن طريق `guild.channels.cache.get(id)` بدون fallback لـ `fetch` — لو القناة مش في الكاش وقت الحدث، الإرسال كان بيتجاهل بصمت.

**الحل المتبع:** أي كود بيتعامل مع `member.user` في `guildMemberRemove`/أي حدث مشابه لازم يعمل fallback بـ `client.users.fetch(member.id)` لو `member.user` مش موجود. وأي بحث عن قناة بمعرف ثابت لازم يكون `cache.get(id) || await guild.channels.fetch(id).catch(() => null)` مش cache بس. كمان لازم نتأكد إن صلاحيات البوت في القناة (ViewChannel/SendMessages/EmbedLinks) موجودة قبل الإرسال ونسجل خطأ واضح في اللوج لو ناقصة، عشان أي فشل مستقبلي يبقى قابل للتشخيص بدل ما يختفي بصمت.

**قرارات المستخدم (يوليو 2026):**
- المستخدم عايز نص رسايل الترحيب/الوداع القديم (ثيم "الفراعنة" — إيموجي 🦅🏛️⚜️، لون embed `#A020F0`) يفضل هو الـ default (`DEFAULT_WELCOME_MSG`/`DEFAULT_GOODBYE_MSG` في index.js)، لكن الميزة نفسها تفضل **متقفلة** (توجل `welcome`/`goodbye` في db.getToggle الافتراضي `false`) — يعني الرسايل موجودة بس مش بتتبعت لحد ما تتفعّل يدوي.
- **Why:** طلب صريح من المستخدم إنه ما يحبش الرسايل دي تتفعّل فعليًا دلوقتي، بس عايز النص القديم جاهز لو فعّلها بعدين.
- لوج انضمام/خروج/تغيير رتب الأعضاء (`sendServerActivityLog` في index.js) اتقفل خالص بطلب المستخدم — الدالة بقت no-op (بترجع فورًا) بدل ما تبعت embeds لقناة `COMMANDS_UPDATE_LOG_CHANNEL_ID`.
- **Why:** المستخدم قال صريح "اقفلي برضو اللوج خلاص انا مش عايزه" — مش عايز تسجيل انضمام/خروج/تغييرات الأعضاء في أي قناة.
- **How to apply:** لو حد طلب رجّع اللوج ده تاني، لازم يفضل الحل نفسه (fetch fallback بدل cache-only) شغال، ومتشيلش الـ no-op غير لو المستخدم صريح طلب تفعيله تاني.

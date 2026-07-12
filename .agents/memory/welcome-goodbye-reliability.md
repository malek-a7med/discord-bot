---
name: Welcome/goodbye message reliability
description: Why welcome/goodbye embeds used to fail silently for a fraction of members, and the fix pattern.
---

المشكلة: رسايل الترحيب/الوداع كانت شغالة بس مش 100% من الوقت.
السبب الرئيسي: في حدث `guildMemberRemove`، الـ `member` ممكن يكون "partial" (مش متخزن في كاش الديسكورد) فـ `member.user` بيبقى `undefined`. أي كود بيستخدم `member.user.displayAvatarURL()` مباشرة (من غير `?.`) كان بيرمي exception تتبلع في الـ try/catch الخارجي، فالرسالة كلها ما كانتش بتتبعت من غير أي أثر واضح في اللوج.
سبب ثانوي: البحث عن قناة الترحيب كان بس عن طريق `guild.channels.cache.get(id)` بدون fallback لـ `fetch` — لو القناة مش في الكاش وقت الحدث، الإرسال كان بيتجاهل بصمت.

**الحل المتبع:** أي كود بيتعامل مع `member.user` في `guildMemberRemove`/أي حدث مشابه لازم يعمل fallback بـ `client.users.fetch(member.id)` لو `member.user` مش موجود. وأي بحث عن قناة بمعرف ثابت لازم يكون `cache.get(id) || await guild.channels.fetch(id).catch(() => null)` مش cache بس. كمان لازم نتأكد إن صلاحيات البوت في القناة (ViewChannel/SendMessages/EmbedLinks) موجودة قبل الإرسال ونسجل خطأ واضح في اللوج لو ناقصة، عشان أي فشل مستقبلي يبقى قابل للتشخيص بدل ما يختفي بصمت.

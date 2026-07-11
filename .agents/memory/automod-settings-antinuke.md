---
name: Auto-mod settings command + anti-nuke system
description: How /اعدادات-الاوتومود and the anti-nuke protection are structured, and what's still a stub.
---

`/اعدادات-الاوتومود` (commands/automod-settings.js) هو أمر واحد بقايمة اختيار (customId prefix `amset_`) بيتحكم في:
عتبات التحذيرات (timeout/kick/ban)، الحماية ضد التخريب (anti-nuke: تفعيل/حد/نافذة زمنية/عقوبة)، رتب إشراف إضافية (RoleSelectMenu)، قناة سجلات الأمان (ChannelSelectMenu).
الإعدادات محفوظة عبر `db.getAutoModSettings(guildId)` / `updateAutoModSettings` / `updateAntiNukeSettings` في database.js.

نظام anti-nuke (helpers/anti-nuke.js) بيراقب channelDelete/roleDelete/guildBanAdd/guildMemberRemove(kick) عن طريق audit log، وبياخد إجراء (kick/ban/timeout) لو حد عدّى الحد المسموح في نافذة زمنية. الأونر وصاحب السيرفر والبوت مستثنيين دايمًا.

**ملحوظة مهمة:** `extraModRoles` دلوقتي بيتسجل بس في الإعدادات — لسه مش مستخدم فعليًا في أي منطق صلاحيات (زي تجاوز حدود الأوتو مود أو الاستثناء من anti-nuke). لو حد سأل ليه رتب الإشراف الإضافية مش بتأثر، ده السبب — محتاج ربط لاحقًا لو المستخدم عايز يفعّلها فعليًا.

**قرار تصميم مهم:** المستخدم طلب إن "أي أوامر متشابهة" تتحط في قايمة اختيار واحدة بدل أوامر سلاش منفصلة. طبقناه على أوامر التحذير اليدوي (تحذير-يدوي/مسح-تحذير/مسح-كل-التحذيرات من commands/moderation.js — كانت أصلاً مش متوصلة في index.js، دي ماتت كود) بدمجها كفئة "التحذيرات اليدوية" داخل /اعدادات-الاوتومود (UserSelectMenu لاختيار العضو + أزرار/مودالز للتحذير الجديد والمسح). أمر `تحذيرات` (عرض فقط، بدون صلاحيات) فضل مستقل لأنه استخدام عادي للأعضاء مش إعداد إداري.
القاعدة العامة: أوامر **الإعدادات/الإدارة** المتشابهة تتجمع في قايمة اختيار واحدة (زي automod-settings و central-bank)؛ أوامر الألعاب/الاقتصاد المميزة عن بعض بتفضل أوامر سلاش مستقلة لأنها ميزات منفصلة يستخدمها الأعضاء مباشرة، مش إعدادات.

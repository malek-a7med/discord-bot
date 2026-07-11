---
name: Deploy target for this Discord bot project
description: Where this project actually runs and how that affects secrets/workflow expectations on Replit.
---

هذا المشروع بيتشغّل فعليًا عن طريق GitHub متربط بـ Railway (مش على Replit).
لذلك الـ workflow المحلي هنا ممكن يفضل فاشل بسبب غياب DISCORD_TOKEN وده متوقع وطبيعي.

**ليه:** المستخدم أكد إن الربط بـ GitHub + Railway هو مصدر التشغيل الحقيقي، ومش محتاج توكنات أو سيكرتس جوه Replit.

**إزاي تتعامل:** متسألش عن توكنات التشغيل (DISCORD_TOKEN وغيرها) ومتحاولش تشغّل/تتأكد إن الـ workflow شغال هنا كدليل على نجاح التعديل — التحقق يكون بفحص الكود (node --check) وقراءة المنطق بس، مش بتشغيل فعلي.

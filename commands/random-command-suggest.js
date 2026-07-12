// ═══════════════════════════════════════════════════════════════
//  🎲 اقتراح أمر عشوائي — بديل الفعاليات الأسطورية
//  كل شوية يبعت في الروم اسم أمر عشوائي من قايمة معينة
// ═══════════════════════════════════════════════════════════════
export const RANDOM_SUGGEST_CHANNEL_ID = "1523688813132644532";

const EVENT_INTERVAL_MIN_MS = 3 * 60 * 60 * 1000;  // كل 3 ساعات كحد أدنى
const EVENT_INTERVAL_MAX_MS = 6 * 60 * 60 * 1000;  // كل 6 ساعات كحد أقصى

// أوامر فازبو (من غير نقطة) + أوامر كلوفر (بنقطة) — بالظبط زي ما هي
const COMMAND_TEXTS = [
  "روليت", "xo", "مافيا", "كراسي", "حجرة", "نرد", "عجلة",
  "hotxo", "غميضة", "ريبلكا", "خمن",
  ".تصويت", ".فعالية", ".روليت", ".مافيا", ".كراسي", ".غميضة", ".xo", ".حجره", ".سباق", ".لغم",
];

function pickRandomCommand() {
  return COMMAND_TEXTS[Math.floor(Math.random() * COMMAND_TEXTS.length)];
}

export async function postRandomCommandSuggestion(client) {
  const channel = await client.channels.fetch(RANDOM_SUGGEST_CHANNEL_ID).catch(() => null);
  if (!channel) return console.error("❌ [RandomSuggest] مش لاقي الروم:", RANDOM_SUGGEST_CHANNEL_ID);

  const text = pickRandomCommand();
  await channel.send(text).catch(() => {});
}

export function scheduleRandomCommandSuggestion(client) {
  function scheduleNext() {
    const delay = EVENT_INTERVAL_MIN_MS + Math.floor(Math.random() * (EVENT_INTERVAL_MAX_MS - EVENT_INTERVAL_MIN_MS));
    setTimeout(() => {
      postRandomCommandSuggestion(client).catch(console.error);
      scheduleNext();
    }, delay);
  }
  // أول اقتراح بعد 10 دقايق من تشغيل البوت
  setTimeout(() => {
    postRandomCommandSuggestion(client).catch(console.error);
    scheduleNext();
  }, 10 * 60 * 1000);

  console.log("✅ [RandomSuggest] نظام اقتراح الأوامر العشوائية جاهز — أول اقتراح بعد 10 دقايق");
}

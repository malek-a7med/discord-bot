import dotenv from 'dotenv';

// تعديل المسار ليعمل من الفولدر الرئيسي مباشرة حيث يوجد ملف الـ .env
dotenv.config({ path: './.env' });

class Config {
  constructor() {
    this.validateEnv();
  }

  validateEnv() {
    const required = [
      'DISCORD_TOKEN',
      'GOOGLE_API_KEY'
    ];

    const optional = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REFRESH_TOKEN',
      'YOUTUBE_API_KEY'
    ];

    for (const key of required) {
      if (!process.env[key]) {
        console.error(`❌ متوجود! المتغير ${key} مفقود في .env`);
        process.exit(1);
      }
    }

    for (const key of optional) {
      if (!process.env[key]) {
        console.warn(`⚠️ تنبيه! المتغير ${key} مفقود - بعض الميزات ما تشتغل`);
      }
    }
  }

  get DISCORD_TOKEN() {
    return process.env.DISCORD_TOKEN;
  }

  get GOOGLE_API_KEY() {
    return process.env.GOOGLE_API_KEY;
  }

  get GOOGLE_CLIENT_ID() {
    return process.env.GOOGLE_CLIENT_ID || null;
  }

  get GOOGLE_CLIENT_SECRET() {
    return process.env.GOOGLE_CLIENT_SECRET || null;
  }

  get GOOGLE_REFRESH_TOKEN() {
    return process.env.GOOGLE_REFRESH_TOKEN || null;
  }

  get YOUTUBE_API_KEY() {
    return process.env.YOUTUBE_API_KEY || null;
  }

  get OWNER_IDS() {
    return [
      '954816748140503090',
      '1448840687763325018',
      '844490366614110218',
      '594250288282730551',
    ];
  }

  get OWNER_NAMES() {
    return {
      '954816748140503090':  'مالك',
      '1448840687763325018': 'مصطفى',
      '844490366614110218':  'عمر',
      '594250288282730551':  'أوفيكس',
    };
  }

  isOwner(userId) {
    return this.OWNER_IDS.includes(userId);
  }

  getOwnerName(userId) {
    return this.OWNER_NAMES[userId] || null;
  }

  get ANTI_SPAM_THRESHOLD() {
    return parseInt(process.env.ANTI_SPAM_THRESHOLD || '5', 10);
  }

  get ANTI_SPAM_WINDOW() {
    return parseInt(process.env.ANTI_SPAM_WINDOW || '10000', 10);
  }

  get ANTI_RAID_THRESHOLD() {
    return parseInt(process.env.ANTI_RAID_THRESHOLD || '10', 10);
  }

  get ANTI_RAID_WINDOW() {
    return parseInt(process.env.ANTI_RAID_WINDOW || '30000', 10);
  }

  hasGoogleAuth() {
    return !!(this.GOOGLE_CLIENT_ID && this.GOOGLE_CLIENT_SECRET && this.GOOGLE_REFRESH_TOKEN);
  }
}

const config = new Config();
export default config;
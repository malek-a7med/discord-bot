// ═══════════════════════════════════════════════════════════════
//  أوامر التنظيف السريع: رفع صورة مباشر / لينك / استخراج نص (OCR)
//  مُنقولة ومحسّنة من بوت صاحبك (discord.py) لتعمل على نفس
//  Flask server الخاص بـ /clean_chapter (app.py)
// ═══════════════════════════════════════════════════════════════
import axios from 'axios';
import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import ImageCleanerHelper from '../helpers/image-cleaner-api.js';
import {
  extractFileId,
  isDriveLink,
  downloadPublicDriveFile
} from '../helpers/drive-utilities.js';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // حد ديسكورد العادي

// ─────────────────────────────────────────────────────────────────
//  Tesseract OCR — Worker واحد بيُعاد استخدامه (lazy init)
// ─────────────────────────────────────────────────────────────────
let ocrWorkerPromise = null;

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    const { createWorker } = await import('tesseract.js');
    ocrWorkerPromise = createWorker('ara+eng');
  }
  return ocrWorkerPromise;
}

// ─────────────────────────────────────────────────────────────────
//  تسجيل الأوامر
// ─────────────────────────────────────────────────────────────────
async function registerWhitenCommands(client) {
  const { SlashCommandBuilder } = await import('@discordjs/builders');

  const whitenUploadCommand = new SlashCommandBuilder()
    .setName('تنظيف_صورة')
    .setDescription('رفع صورة مانجا وتنظيفها فوراً من النصوص (بدون Drive)')
    .addAttachmentOption((option) =>
      option.setName('صورة').setDescription('الصورة المطلوب تنظيفها').setRequired(true)
    );

  const whitenLinkCommand = new SlashCommandBuilder()
    .setName('تنظيف_رابط')
    .setDescription('تنظيف صورة من لينك مباشر أو لينك Google Drive')
    .addStringOption((option) =>
      option.setName('رابط').setDescription('رابط الصورة (مباشر أو Drive)').setRequired(true)
    );

  const ocrCommand = new SlashCommandBuilder()
    .setName('استخراج_نص')
    .setDescription('استخراج النص من صورة (OCR) — عربي وإنجليزي')
    .addAttachmentOption((option) =>
      option.setName('صورة').setDescription('الصورة المطلوب استخراج النص منها').setRequired(true)
    );

  return [
    { data: whitenUploadCommand, execute: handleWhitenUpload },
    { data: whitenLinkCommand, execute: handleWhitenLink },
    { data: ocrCommand, execute: handleOcrUpload }
  ];
}

// ─────────────────────────────────────────────────────────────────
//  /تنظيف_صورة — رفع مباشر
// ─────────────────────────────────────────────────────────────────
async function handleWhitenUpload(interaction) {
  try {
    await interaction.deferReply();

    const attachment = interaction.options.getAttachment('صورة');

    if (!attachment.contentType?.startsWith('image/')) {
      return await interaction.editReply({ content: '❌ الملف ده مش صورة!' });
    }
    if (attachment.size > MAX_IMAGE_BYTES) {
      return await interaction.editReply({ content: '❌ الصورة كبيرة جداً (الحد الأقصى 25MB)!' });
    }

    const cleanerHelper = new ImageCleanerHelper();
    const serverOnline = await cleanerHelper.checkServerStatus();
    if (!serverOnline) {
      return await interaction.editReply({
        content: '❌ سيرفر التنظيف المحلي مش شغال!\n\nشغّل الأمر ده في terminal منفصل:\n```\npython app.py\n```'
      });
    }

    await interaction.editReply({ content: '⏳ جاري تحميل الصورة...' });
    const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);

    await interaction.editReply({ content: '✨ جاري التنظيف...' });
    const cleanedBuffer = await cleanerHelper.cleanImage(imageBuffer, attachment.contentType);

    const outName = `cleaned_${attachment.name}`;
    const cleanedAttachment = new AttachmentBuilder(cleanedBuffer, { name: outName });

    const embed = new EmbedBuilder()
      .setTitle('✅ تم التنظيف!')
      .setColor('#2ecc71')
      .setImage(`attachment://${outName}`)
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed], files: [cleanedAttachment] });
  } catch (err) {
    console.error('❌ خطأ في تنظيف_صورة:', err);
    await interaction
      .editReply({ content: `❌ حصل خطأ: ${err.message}` })
      .catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────
//  /تنظيف_رابط — لينك مباشر أو Google Drive
// ─────────────────────────────────────────────────────────────────
async function handleWhitenLink(interaction) {
  try {
    await interaction.deferReply();

    const link = interaction.options.getString('رابط').trim();

    const cleanerHelper = new ImageCleanerHelper();
    const serverOnline = await cleanerHelper.checkServerStatus();
    if (!serverOnline) {
      return await interaction.editReply({
        content: '❌ سيرفر التنظيف المحلي مش شغال!\n\nشغّل الأمر ده في terminal منفصل:\n```\npython app.py\n```'
      });
    }

    await interaction.editReply({ content: '⏳ جاري تحميل الصورة...' });

    let imageBuffer;
    let mimeType = 'image/jpeg';
    let fileName;

    if (isDriveLink(link)) {
      const fileId = extractFileId(link);
      if (!fileId) {
        return await interaction.editReply({ content: '❌ مش قادر أستخرج ID من لينك Drive ده!' });
      }
      imageBuffer = await downloadPublicDriveFile(fileId);
      fileName = `drive_${fileId}.jpg`;
    } else {
      const response = await axios.get(link, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        maxRedirects: 5
      });

      const contentType = response.headers['content-type'] || '';
      if (!contentType.startsWith('image/')) {
        return await interaction.editReply({ content: '❌ اللينك ده مش صورة!' });
      }
      mimeType = contentType;
      imageBuffer = Buffer.from(response.data);
      fileName = link.split('/').pop().split('?')[0] || `image_${Date.now()}.jpg`;
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return await interaction.editReply({ content: '❌ فشل تحميل الصورة من اللينك!' });
    }
    if (imageBuffer.length > MAX_IMAGE_BYTES) {
      return await interaction.editReply({ content: '❌ الصورة كبيرة جداً (الحد الأقصى 25MB)!' });
    }

    await interaction.editReply({ content: '✨ جاري التنظيف...' });
    const cleanedBuffer = await cleanerHelper.cleanImage(imageBuffer, mimeType);

    const outName = `cleaned_${fileName}`;
    const cleanedAttachment = new AttachmentBuilder(cleanedBuffer, { name: outName });

    const embed = new EmbedBuilder()
      .setTitle('✅ تم التنظيف!')
      .setColor('#2ecc71')
      .setImage(`attachment://${outName}`)
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed], files: [cleanedAttachment] });
  } catch (err) {
    console.error('❌ خطأ في تنظيف_رابط:', err);
    await interaction
      .editReply({ content: `❌ حصل خطأ: ${err.message}` })
      .catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────
//  /استخراج_نص — OCR (عربي + إنجليزي)
// ─────────────────────────────────────────────────────────────────
async function handleOcrUpload(interaction) {
  try {
    await interaction.deferReply();

    const attachment = interaction.options.getAttachment('صورة');

    if (!attachment.contentType?.startsWith('image/')) {
      return await interaction.editReply({ content: '❌ الملف ده مش صورة!' });
    }

    await interaction.editReply({ content: '⏳ جاري تحميل الصورة...' });
    const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);

    await interaction.editReply({
      content: '🔍 جاري استخراج النص...\n(أول استخدام بيحمّل بيانات اللغة، ممكن ياخد دقيقة)'
    });

    const worker = await getOcrWorker();
    const { data: { text } } = await worker.recognize(imageBuffer);
    const cleanText = (text || '').trim();

    if (!cleanText) {
      return await interaction.editReply({ content: '❌ مش لاقي أي نص في الصورة!' });
    }

    // لو النص طويل، نبعته كملف .txt بدل تجاوز حد رسالة الإيمبيد
    if (cleanText.length > 1800) {
      const fileBuffer = Buffer.from(cleanText, 'utf-8');
      const fileAttachment = new AttachmentBuilder(fileBuffer, { name: 'extracted_text.txt' });
      await interaction.editReply({
        content: '✅ تم استخراج النص (طويل، اتبعت كملف):',
        files: [fileAttachment]
      });
    } else {
      const embed = new EmbedBuilder()
        .setTitle('📝 النص المستخرج')
        .setDescription(cleanText.slice(0, 4000))
        .setColor('#3498db')
        .setTimestamp();
      await interaction.editReply({ content: null, embeds: [embed] });
    }
  } catch (err) {
    console.error('❌ خطأ في استخراج_نص:', err);
    await interaction
      .editReply({ content: `❌ حصل خطأ: ${err.message}` })
      .catch(() => {});
  }
}

export {
  registerWhitenCommands,
  handleWhitenUpload,
  handleWhitenLink,
  handleOcrUpload
};

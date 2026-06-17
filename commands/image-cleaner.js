import config from '../config.js';
import GoogleDriveHelper from '../helpers/google-drive.js';
import ImageCleanerHelper from '../helpers/image-cleaner-api.js';
import { extractFolderId } from '../helpers/drive-utilities.js';
import { EmbedBuilder } from 'discord.js';
import fs from 'fs';
import { google } from 'googleapis';

async function registerCleanChapterCommand(client) {
  const { SlashCommandBuilder } = await import('discord.js');

  const command = new SlashCommandBuilder()
    .setName('clean_chapter')
    .setDescription('تنظيف صور الفصل بتاعك من الكتابة والنصوص باستخدام الذكاء الاصطناعي')
    .addStringOption((option) =>
      option
        .setName('folder_id')
        .setDescription('رابط المجلد أو الـ ID من Google Drive')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('output_name')
        .setDescription('اسم المجلد الناتج (اختياري)')
        .setRequired(false)
    );

  return { data: command, execute: handleCleanChapter };
}

async function handleCleanChapter(interaction) {
  try {
    await interaction.deferReply();

    // ✅ التحقق من وجود مفتاح Gemini API
    if (!config.GOOGLE_API_KEY) {
      return await interaction.editReply({
        content: '❌ مفتاح Gemini API (GOOGLE_API_KEY) مش موجود في إعدادات البوت!'
      });
    }

    const folderInput = interaction.options.getString('folder_id');
    const outputName =
      interaction.options.getString('output_name') || `cleaned-${Date.now()}`;

    // استخراج الـ Folder ID من الرابط أو الـ ID المباشر
    let folderId;
    try {
      folderId = extractFolderId(folderInput);
    } catch (err) {
      return await interaction.editReply({
        content: `❌ الرابط غير صالح: ${err.message}`
      });
    }

    // إعداد OAuth2 من الملفات المحلية
    const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf-8'));
    const token = JSON.parse(fs.readFileSync('token.json', 'utf-8'));
    const { client_secret, client_id, redirect_uris } =
      credentials.installed || credentials.web;

    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );
    oAuth2Client.setCredentials(token);

    // تهيئة الـ Helpers
    const driveHelper = new GoogleDriveHelper(config.GOOGLE_API_KEY);
    driveHelper.drive = google.drive({ version: 'v3', auth: oAuth2Client });

    // ✅ تمرير مفتاح Gemini API للـ ImageCleanerHelper
    const cleanerHelper = new ImageCleanerHelper(config.GOOGLE_API_KEY);

    await interaction.editReply({
      content: '⏳ جاري فحص المجلد وجلب الصور...'
    });

    // جلب قائمة الصور
    const imageFiles = await driveHelper.listFolderImages(folderId);

    if (!imageFiles || imageFiles.length === 0) {
      return await interaction.editReply({
        content: '❌ المجلد فارغ أو مفيش صور بالصيغ المطلوبة (jpg, jpeg, png, webp)!'
      });
    }

    // إنشاء مجلد الإخراج
    const outputFolder = await driveHelper.createFolder(folderId, outputName);

    let successCount = 0;
    let failedCount = 0;
    const errorDetails = [];

    // معالجة كل صورة
    for (const imageFile of imageFiles) {
      try {
        console.log(`📥 جاري تحميل: ${imageFile.name}`);
        const imageBuffer = await driveHelper.downloadFile(imageFile.id);

        // تحديد نوع الصورة للـ Gemini
        const mimeType = imageFile.mimeType?.startsWith('image/')
          ? imageFile.mimeType
          : 'image/jpeg';

        console.log(`✨ جاري تنظيف: ${imageFile.name} بواسطة Gemini...`);
        // ✅ استخدام Gemini بدلاً من Flask
        const cleanedBuffer = await cleanerHelper.cleanImage(imageBuffer, mimeType);

        console.log(`📤 جاري الرفع: ${imageFile.name}`);
        await driveHelper.uploadFile(
          outputFolder.folderId,
          imageFile.name,
          cleanedBuffer,
          mimeType
        );

        successCount++;

        // تحديث التقدم كل صورة
        await interaction.editReply({
          content: `⏳ جاري التنظيف بـ Gemini AI... (${successCount}/${imageFiles.length})`
        });

        // تأخير بسيط لتجنب تجاوز حد الـ Rate Limit
        await new Promise((resolve) => setTimeout(resolve, 1500));

      } catch (err) {
        console.error(`❌ خطأ في معالجة ${imageFile.name}:`, err.message);
        failedCount++;
        errorDetails.push(`• **${imageFile.name}**: ${err.message || 'خطأ غير معروف'}`);
      }
    }

    // مشاركة المجلد الناتج
    const shareLink = await driveHelper.shareFolder(outputFolder.folderId, 'reader');

    // بناء الـ Embed النهائي
    const embed = new EmbedBuilder()
      .setTitle(
        successCount > 0
          ? '✅ تم تنظيف الفصل بنجاح!'
          : '⚠️ اكتملت العملية مع وجود أخطاء'
      )
      .setDescription(
        `**تقرير تنظيف الفصل باستخدام Gemini AI:**\n` +
        `✅ صور ناجحة: **${successCount}**\n` +
        `❌ صور فاشلة: **${failedCount}**`
      )
      .addFields({
        name: '📁 رابط المجلد الناتج',
        value: `[اضغط هنا لفتح المجلد](${shareLink})`
      })
      .setColor(successCount > 0 ? '#2ecc71' : '#f1c40f')
      .setTimestamp();

    if (errorDetails.length > 0) {
      embed.addFields({
        name: '🔍 تفاصيل الأخطاء (أول 5):',
        value: errorDetails.slice(0, 5).join('\n')
      });
    }

    await interaction.editReply({ content: null, embeds: [embed] });

  } catch (err) {
    console.error('❌ خطأ كارثي في clean_chapter:', err);
    await interaction.editReply({
      content: `❌ حصل خطأ: ${err.message}`
    });
  }
}

export { registerCleanChapterCommand, handleCleanChapter };
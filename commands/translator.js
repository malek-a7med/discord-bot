import config from '../config.js';
import GoogleDriveHelper from '../helpers/google-drive.js';
import GoogleDocsHelper from '../helpers/google-docs.js';
import GeminiTranslator from '../helpers/gemini-multimodal.js';
import { EmbedBuilder } from 'discord.js';

async function registerTranslateChapterCommand(client) {
  const { SlashCommandBuilder } = await import('discord.js');

  const command = new SlashCommandBuilder()
    .setName('translate_chapter')
    .setDescription('ترجم فصل المانهوا بتاعك باستخدام الذكاء الاصطناعي')
    .addStringOption((option) =>
      option
        .setName('folder_id')
        .setDescription('رقم مجلد Google Drive اللي فيه الصور')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('language')
        .setDescription('اللغة المقصود الترجمة ليها')
        .setRequired(false)
        .addChoices(
          { name: 'العربية', value: 'arabic' },
          { name: 'الإنجليزية', value: 'english' },
          { name: 'الفرنسية', value: 'french' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('doc_name')
        .setDescription('اسم ملف جوجل دوكس الناتج')
        .setRequired(false)
    );

  return {
    data: command,
    execute: handleTranslateChapter
  };
}

async function handleTranslateChapter(interaction) {
  try {
    // Defer reply
    await interaction.deferReply();

    const folderId = interaction.options.getString('folder_id');
    const targetLanguage = interaction.options.getString('language') || 'arabic';
    const docName =
      interaction.options.getString('doc_name') ||
      `Translated-${Date.now()}`;

    // Initialize helpers
    const driveHelper = new GoogleDriveHelper(config.GOOGLE_API_KEY);
    const docsHelper = new GoogleDocsHelper(config.GOOGLE_API_KEY);
    const translator = new GeminiTranslator();

    await interaction.editReply({
      content: '⏳ بحمل الصور... دي ممكن تاخد وقت'
    });

    // List all images in folder
    const imageFiles = await driveHelper.listFolderImages(folderId);

    if (imageFiles.length === 0) {
      return await interaction.editReply({
        content: '❌ ما لاقيتش صور في المجلد!'
      });
    }

    // Create Google Doc
    const docResult = await docsHelper.createDocument(docName);
    const docId = docResult.docId;

    // Add title to doc
    await docsHelper.appendText(docId, docName, {
      fontSize: 24,
      bold: true
    });

    let processedCount = 0;
    let successCount = 0;
    const translations = [];
    const errors = [];

    // Process each image
    for (const imageFile of imageFiles) {
      try {
        processedCount++;

        // Download image
        const imageBuffer = await driveHelper.downloadFile(imageFile.id);

        // Translate image
        const result = await translator.ocrAndTranslate(imageBuffer, targetLanguage);

        translations.push({
          fileName: imageFile.name,
          ...result
        });

        successCount++;

        // Update progress
        if (processedCount % 2 === 0) {
          await interaction.editReply({
            content: `⏳ ترجمة الصور: ${successCount}/${imageFiles.length}`
          });
        }

        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        errors.push(`❌ ${imageFile.name}: ${err.message}`);
      }
    }

    // Format document with translations
    await docsHelper.appendText(docId, '\n\n');

    for (const translation of translations) {
      // Add panel heading
      await docsHelper.appendText(docId, translation.fileName, {
        fontSize: 16,
        bold: true
      });

      await docsHelper.appendText(docId, `🎭 المود: ${translation.mood}`);
      await docsHelper.appendText(docId, `📝 النص الأصلي:\n${translation.original}`);
      await docsHelper.appendText(docId, `🌍 النص المترجم:\n${translation.translated}`);

      if (translation.notes) {
        await docsHelper.appendText(docId, `📌 ملاحظات: ${translation.notes}`);
      }

      await docsHelper.appendText(docId, '\n' + '-'.repeat(50) + '\n');
    }

    // Share document
    const shareLink = await docsHelper.shareDocument(docId, 'reader');

    // Send final embed
    const embed = new EmbedBuilder()
      .setTitle('✅ تمت الترجمة بتاعتك!')
      .setDescription(`تم ترجمة ${successCount} صورة بنجاح`)
      .addFields(
        {
          name: 'الإجمالي',
          value: `${successCount}/${imageFiles.length}`,
          inline: true
        },
        {
          name: 'اللغة',
          value: targetLanguage,
          inline: true
        },
        {
          name: 'الملف',
          value: `[اضغط هنا](${shareLink})`,
          inline: false
        }
      )
      .setColor('#3498db')
      .setTimestamp();

    if (errors.length > 0 && errors.length <= 5) {
      embed.addFields({
        name: '⚠️ أخطاء',
        value: errors.join('\n'),
        inline: false
      });
    }

    await interaction.editReply({
      embeds: [embed]
    });
  } catch (err) {
    console.error('❌ خطأ في ترجمة الفصل:', err);

    await interaction.editReply({
      content: `❌ حصل خطأ: ${err.message}`
    });
  }
}

export { registerTranslateChapterCommand, handleTranslateChapter };

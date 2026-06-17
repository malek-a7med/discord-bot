import sharp from 'sharp';
import { ImageProcessingError } from '../errors.js';
import { getImageModel } from './gemini-keys.js';

const GEMINI_INSTRUCTION =
  'Remove all text, speech bubbles text, sound effects text, and captions from this manga/manhwa image. Do NOT alter, repaint, or affect the artwork, linework, characters, or background in any way. Fill the areas where text was with the surrounding background color or pattern to make it look naturally clean. Return only the cleaned image with no text.';

function initGeminiModel() {
  return getImageModel();
}

async function cleanImageViaSharp(imageBuffer) {
  try {
    return await sharp(imageBuffer)
      .normalize()
      .sharpen({ sigma: 0.5 })
      .modulate({ saturation: 1.2 })
      .toBuffer();
  } catch (err) {
    console.error('❌ Sharp fallback error:', err.message);
    throw err;
  }
}

async function cleanImageWithGemini(imageBuffer, mimeType = 'image/jpeg') {
  const model = initGeminiModel();

  if (!model) {
    console.warn('⚠️ Gemini model not initialized, falling back to sharp');
    return cleanImageViaSharp(imageBuffer);
  }

  try {
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('صورة فارغة أو غير صحيحة');
    }

    const base64Image = imageBuffer.toString('base64');

    console.log('🤖 إرسال الصورة إلى Gemini API للتنظيف...');

    const response = await model.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType
        }
      },
      {
        text: GEMINI_INSTRUCTION
      }
    ]);

    if (!response.response.candidates || response.response.candidates.length === 0) {
      console.warn('⚠️ لم تحصل على رد من Gemini، استخدام sharp fallback');
      return cleanImageViaSharp(imageBuffer);
    }

    const candidate = response.response.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.warn('⚠️ لا توجد أجزاء في الرد من Gemini، استخدام sharp fallback');
      return cleanImageViaSharp(imageBuffer);
    }

    const imagePart = candidate.content.parts.find((part) => part.inlineData);
    if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
      console.warn('⚠️ Gemini أرجع نصاً فقط بدون صورة، استخدام sharp fallback');
      return cleanImageViaSharp(imageBuffer);
    }

    console.log('✅ تم استقبال الصورة المنظفة من Gemini');

    const cleanedBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    return await sharp(cleanedBuffer).png().toBuffer();
  } catch (err) {
    console.error('❌ خطأ في Gemini API:', err.message);
    console.log('💨 الانتقال إلى sharp كبديل آمن...');
    try {
      return await cleanImageViaSharp(imageBuffer);
    } catch (fallbackErr) {
      console.error('❌ فشل sharp fallback أيضاً:', fallbackErr.message);
      throw new ImageProcessingError(`فشل تنظيف الصورة: ${fallbackErr.message}`);
    }
  }
}

class ImageCleanerHelper {
  constructor() {
    // الموديل بيتجاب من نظام التدوير التلقائي
  }

  cleanImage(imageBuffer, mimeType = 'image/jpeg') {
    return cleanImageWithGemini(imageBuffer, mimeType);
  }
}

export { cleanImageWithGemini, cleanImageViaSharp };
export default ImageCleanerHelper;

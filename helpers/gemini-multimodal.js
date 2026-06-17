import { ImageProcessingError } from '../errors.js';
import { getImageModel } from './gemini-keys.js';

class GeminiTranslator {
  constructor() {
    // بيجيب الموديل مع التدوير التلقائي للمفاتيح
  }

  get model() { return getImageModel(); }

  async ocrAndTranslate(imageBuffer, targetLanguage = 'arabic') {
    try {
      const base64Image = imageBuffer.toString('base64');

      const languageMap = {
        arabic: 'اللغة العربية',
        english: 'English',
        french: 'Français',
        spanish: 'Español',
        japanese: '日本語'
      };

      const targetLang = languageMap[targetLanguage] || 'اللغة العربية';

      const prompt = `You are an expert manga/manhwa translator. Analyze this manhwa/anime panel carefully:

1. Extract ALL visible text (English, Japanese, or other languages)
2. Understand the mood: serious, comedic, dramatic, romantic, action-packed
3. Identify character emotions and tone
4. Translate to ${targetLang} while:
   - Preserving the original tone and style
   - Keeping anime/manga slang and expressions
   - Maintaining character voices (formal, casual, etc.)
   - Adapting cultural references appropriately

Return ONLY a JSON object with NO markdown formatting:
{
  "original_text": "complete text from panel",
  "translated_text": "translated version in ${targetLang}",
  "mood": "description of mood (serious/comedic/dramatic/etc)",
  "notes": "any translation notes or cultural adaptations",
  "confidence": 0.95
}`;

      const response = await this.model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg'
          }
        },
        { text: prompt }
      ]);

      const responseText = response.response.text();

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }

      const result = JSON.parse(jsonMatch[0]);

      return {
        original: result.original_text || '',
        translated: result.translated_text || '',
        mood: result.mood || 'neutral',
        notes: result.notes || '',
        confidence: result.confidence || 0.8
      };
    } catch (err) {
      throw new ImageProcessingError(`خطأ في الترجمة: ${err.message}`);
    }
  }

  async extractTextOnly(imageBuffer) {
    try {
      const base64Image = imageBuffer.toString('base64');

      const prompt = `Extract ALL visible text from this image. Return ONLY the extracted text, nothing else.`;

      const response = await this.model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg'
          }
        },
        { text: prompt }
      ]);

      return response.response.text();
    } catch (err) {
      throw new ImageProcessingError(`خطأ في استخراج النص: ${err.message}`);
    }
  }

  async translateText(text, sourceLanguage, targetLanguage) {
    try {
      const languages = {
        arabic: 'اللغة العربية',
        english: 'English',
        french: 'Français',
        spanish: 'Español',
        japanese: '日本語'
      };

      const sourceLang = languages[sourceLanguage] || sourceLanguage;
      const targetLang = languages[targetLanguage] || targetLanguage;

      const prompt = `Translate the following text from ${sourceLang} to ${targetLang}, maintaining tone and style:

Text: "${text}"

Return ONLY the translated text, nothing else.`;

      const response = await this.model.generateContent(prompt);

      return response.response.text();
    } catch (err) {
      throw new ImageProcessingError(`خطأ في الترجمة: ${err.message}`);
    }
  }

  async analyzeImageContent(imageBuffer) {
    try {
      const base64Image = imageBuffer.toString('base64');

      const prompt = `Analyze this manga/manhwa image and provide:
1. Scene description
2. Character emotions/expressions
3. Panel context/flow
4. Any text visible

Return as JSON:
{
  "scene_description": "...",
  "character_emotions": "...",
  "context": "...",
  "text_found": true/false
}`;

      const response = await this.model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg'
          }
        },
        { text: prompt }
      ]);

      const responseText = response.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Invalid JSON response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      throw new ImageProcessingError(`خطأ في تحليل الصورة: ${err.message}`);
    }
  }

  async batchTranslate(imageBuffers, targetLanguage = 'arabic') {
    try {
      const results = [];
      for (const buffer of imageBuffers) {
        const result = await this.ocrAndTranslate(buffer, targetLanguage);
        results.push(result);
        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      return results;
    } catch (err) {
      throw new ImageProcessingError(`خطأ في ترجمة الدفعة: ${err.message}`);
    }
  }
}

export default GeminiTranslator;

// هذا الملف يستخرج الـ ID من روابط Google Drive
import axios from 'axios';

export function extractFolderId(input) {
  // إذا كان المدخل هو الـ ID مباشرة (يحتوي على أرقام وحروف طويلة)
  if (input.length > 20 && !input.includes('drive.google.com')) {
    return input;
  }

  // إذا كان المدخل رابط (URL)
  try {
    const url = new URL(input);
    const pathParts = url.pathname.split('/');
    // الـ ID عادة يكون الجزء الأخير في الرابط بعد /folders/
    const folderIndex = pathParts.indexOf('folders');
    if (folderIndex !== -1 && pathParts[folderIndex + 1]) {
      return pathParts[folderIndex + 1];
    }
  } catch (err) {
    // في حال فشل تحليل الرابط
  }

  throw new Error('مش قادر ألاقي الـ Folder ID في الرابط ده، اتأكد إنه رابط صحيح!');
}

export function getFolderIdHelpText() {
  return 'انسخ الرابط من المتصفح أو هات الـ ID مباشرة';
}

// ─────────────────────────────────────────────────────────────────
//  جديد: استخراج ID لملف (صورة) بدل فولدر، ودعم اللينكات المباشرة
// ─────────────────────────────────────────────────────────────────

/**
 * يتحقق إذا كان اللينك من Google Drive / Docs
 */
export function isDriveLink(url) {
  return url.includes('drive.google.com') || url.includes('docs.google.com');
}

/**
 * يستخرج File ID من رابط ملف Google Drive
 * يدعم الأشكال:
 *  - https://drive.google.com/file/d/<ID>/view
 *  - https://drive.google.com/open?id=<ID>
 *  - https://drive.google.com/uc?id=<ID>
 *  - أو الـ ID مباشرة
 */
export function extractFileId(input) {
  if (input.length > 20 && !isDriveLink(input)) {
    return input;
  }

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * تحميل ملف عام (Public/Anyone with link) من Google Drive
 * بدون أي مصادقة — بيستخدم رابط uc?export=download
 * بيتعامل مع صفحة "تأكيد" Google للملفات الكبيرة (virus scan warning)
 */
export async function downloadPublicDriveFile(fileId) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };

  let url = `https://drive.google.com/uc?export=download&id=${fileId}`;
  let response = await axios.get(url, {
    responseType: 'arraybuffer',
    maxRedirects: 5,
    headers
  });

  const contentType = response.headers['content-type'] || '';

  // لو الملف كبير، جوجل بترجع صفحة HTML فيها رابط تأكيد
  if (contentType.includes('text/html')) {
    const html = Buffer.from(response.data).toString('utf-8');
    const confirmMatch = html.match(/confirm=([0-9A-Za-z_-]+)/);

    if (confirmMatch) {
      url = `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${fileId}`;
      response = await axios.get(url, {
        responseType: 'arraybuffer',
        maxRedirects: 5,
        headers
      });
    } else {
      throw new Error('الملف ده مش عام (Public) أو الرابط غلط — تأكد إن الإعدادات "Anyone with the link"');
    }
  }

  return Buffer.from(response.data);
}
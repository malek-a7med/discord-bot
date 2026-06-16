import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream'; // استيراد مكتبة الـ Stream لحل المشكلة فوراً
import { GoogleDriveError } from '../errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = path.join(__dirname, '../token.json');
const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');

class GoogleDriveHelper {
  constructor(apiKey, serviceAccountJson = null) {
    this.apiKey = apiKey;
    this.serviceAccountJson = serviceAccountJson;
    this.drive = null;
    this.initializeAuth();
  }

  initializeAuth() {
    try {
      let authClient;
      if (fs.existsSync(TOKEN_PATH) && fs.existsSync(CREDENTIALS_PATH)) {
        const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
        const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

        authClient = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        authClient.setCredentials(token);
      } else if (this.serviceAccountJson && fs.existsSync(this.serviceAccountJson)) {
        authClient = new google.auth.GoogleAuth({
          keyFile: this.serviceAccountJson,
          scopes: ['https://www.googleapis.com/auth/drive']
        });
      }

      this.drive = google.drive({
        version: 'v3',
        auth: authClient || this.apiKey
      });
    } catch (err) {
      throw new GoogleDriveError(`فشل التحقق من الهوية: ${err.message}`);
    }
  }

  async listFolderImages(folderId) {
    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name, mimeType)',
      });

      const files = response.data.files || [];
      
      const imageFiles = files.filter(f => {
        const isImageMime = f.mimeType && f.mimeType.includes('image');
        const isImageExt = /\.(jpg|jpeg|png|webp)$/i.test(f.name);
        const isNotCleaned = !f.name.startsWith('cleaned-');
        
        return (isImageMime || isImageExt) && isNotCleaned;
      });
      
      return imageFiles;
    } catch (err) {
      throw new GoogleDriveError(`خطأ في قائمة الملفات: ${err.message}`);
    }
  }

  async downloadFile(fileId) {
    try {
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );
      return new Promise((resolve, reject) => {
        const chunks = [];
        response.data
          .on('data', (chunk) => chunks.push(chunk))
          .on('end', () => resolve(Buffer.concat(chunks)))
          .on('error', reject);
      });
    } catch (err) {
      throw new GoogleDriveError(`خطأ في تحميل الملف: ${err.message}`);
    }
  }

  async uploadFile(folderId, fileName, buffer, mimeType = 'image/jpeg') {
    try {
      // تعديل جوهري: تحويل الـ Buffer إلى Readable Stream عشان مكتبة جوجل تقبله وترفعه بنجاح
      const mediaStream = Readable.from(buffer);

      const response = await this.drive.files.create({
        requestBody: { name: fileName, mimeType, parents: [folderId] },
        media: { 
          mimeType, 
          body: mediaStream // إرسال الـ Stream بدلاً من الـ Buffer العادي
        },
        fields: 'id, webViewLink'
      });
      return { fileId: response.data.id, link: response.data.webViewLink };
    } catch (err) {
      throw new GoogleDriveError(`خطأ في رفع الملف: ${err.message}`);
    }
  }

  async createFolder(parentFolderId, folderName) {
    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId]
        },
        fields: 'id, webViewLink'
      });
      return { folderId: response.data.id, link: response.data.webViewLink };
    } catch (err) {
      throw new GoogleDriveError(`خطأ في إنشاء مجلد: ${err.message}`);
    }
  }

  async shareFolder(folderId, role = 'reader') {
    try {
      await this.drive.permissions.create({
        fileId: folderId,
        requestBody: { role, type: 'anyone' }
      });
      const file = await this.drive.files.get({ fileId: folderId, fields: 'webViewLink' });
      return file.data.webViewLink;
    } catch (err) {
      throw new GoogleDriveError(`خطأ في مشاركة المجلد: ${err.message}`);
    }
  }
}

export default GoogleDriveHelper;
import { google } from 'googleapis';
import { GoogleDocsError } from '../errors.js';

class GoogleDocsHelper {
  constructor(apiKey, auth = null) {
    this.apiKey = apiKey;
    this.auth = auth;
    this.docs = google.docs({
      version: 'v1',
      auth: auth || this.apiKey
    });
    this.drive = google.drive({
      version: 'v3',
      auth: auth || this.apiKey
    });
  }

  async createDocument(title, parentFolderId = null) {
    try {
      const requestBody = {
        title
      };

      const response = await this.docs.documents.create({
        requestBody
      });

      const docId = response.data.documentId;

      // Move to parent folder if specified
      if (parentFolderId) {
        await this.drive.files.update({
          fileId: docId,
          addParents: parentFolderId,
          fields: 'id, webViewLink'
        });
      }

      return {
        docId,
        link: `https://docs.google.com/document/d/${docId}/edit`
      };
    } catch (err) {
      throw new GoogleDocsError(`خطأ في إنشاء المستند: ${err.message}`);
    }
  }

  async appendText(docId, text, formatting = {}) {
    try {
      const requests = [
        {
          insertText: {
            text: text + '\n',
            location: {
              index: 1
            }
          }
        }
      ];

      if (formatting.bold || formatting.italic || formatting.fontSize) {
        requests.push({
          updateTextStyle: {
            range: {
              startIndex: 1,
              endIndex: 1 + text.length
            },
            textStyle: {
              bold: formatting.bold || false,
              italic: formatting.italic || false,
              fontSize: formatting.fontSize
                ? { magnitude: formatting.fontSize, unit: 'PT' }
                : undefined
            },
            fields: 'bold,italic,fontSize'
          }
        });
      }

      await this.docs.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests }
      });

      return true;
    } catch (err) {
      throw new GoogleDocsError(`خطأ في إضافة نص: ${err.message}`);
    }
  }

  async insertTable(docId, rows, columns) {
    try {
      const requests = [
        {
          insertTable: {
            rows,
            columns,
            location: {
              index: 1
            }
          }
        }
      ];

      await this.docs.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests }
      });

      return true;
    } catch (err) {
      throw new GoogleDocsError(`خطأ في إدراج جدول: ${err.message}`);
    }
  }

  async insertImage(docId, imageUrl, width = 300, height = 400) {
    try {
      const requests = [
        {
          insertInlineImage: {
            uri: imageUrl,
            location: {
              index: 1
            },
            objectSize: {
              width: { magnitude: width, unit: 'PT' },
              height: { magnitude: height, unit: 'PT' }
            }
          }
        }
      ];

      await this.docs.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests }
      });

      return true;
    } catch (err) {
      throw new GoogleDocsError(`خطأ في إدراج صورة: ${err.message}`);
    }
  }

  async formatHeading(docId, startIndex, endIndex, level = 1) {
    try {
      const headingMap = {
        1: 'HEADING_1',
        2: 'HEADING_2',
        3: 'HEADING_3'
      };

      const requests = [
        {
          updateParagraphStyle: {
            range: {
              startIndex,
              endIndex
            },
            paragraphStyle: {
              namedStyleType: headingMap[level]
            },
            fields: 'namedStyleType'
          }
        }
      ];

      await this.docs.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests }
      });

      return true;
    } catch (err) {
      throw new GoogleDocsError(`خطأ في تنسيق العنوان: ${err.message}`);
    }
  }

  async shareDocument(docId, role = 'reader') {
    try {
      await this.drive.permissions.create({
        fileId: docId,
        requestBody: {
          role,
          type: 'anyone'
        }
      });

      return `https://docs.google.com/document/d/${docId}/edit`;
    } catch (err) {
      throw new GoogleDocsError(`خطأ في مشاركة المستند: ${err.message}`);
    }
  }

  async getDocumentContent(docId) {
    try {
      const response = await this.docs.documents.get({
        documentId: docId
      });

      return response.data;
    } catch (err) {
      throw new GoogleDocsError(`خطأ في الحصول على محتوى المستند: ${err.message}`);
    }
  }

  async clearDocument(docId) {
    try {
      const doc = await this.getDocumentContent(docId);
      const content = doc.body.content;

      if (!content || content.length === 0) {
        return true;
      }

      const requests = [
        {
          deleteContentRange: {
            range: {
              startIndex: 1,
              endIndex: content[content.length - 1].endIndex
            }
          }
        }
      ];

      await this.docs.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests }
      });

      return true;
    } catch (err) {
      throw new GoogleDocsError(`خطأ في حذف محتوى المستند: ${err.message}`);
    }
  }
}

export default GoogleDocsHelper;

import fs from 'fs';
import readline from 'readline';
import { google } from 'googleapis';

const credentials = JSON.parse(fs.readFileSync('credentials.json'));
const { client_secret, client_id, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive'],
});

console.log('🔗 افتح الرابط ده في المتصفح:\n', authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('بعد ما تفتح الرابط وتوافق، خذ الكود اللي هيظهرلك وحطه هنا ودوس Enter: ', (code) => {
  rl.close();
  oAuth2Client.getToken(code, (err, token) => {
    if (err) {
      console.error('❌ خطأ في استخراج التوكن:', err.message);
      return;
    }
    fs.writeFileSync('token.json', JSON.stringify(token));
    console.log('✅ تم حفظ token.json بنجاح! البوت الآن جاهز للعمل.');
  });
});
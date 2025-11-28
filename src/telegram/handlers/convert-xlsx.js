import XLSX from 'xlsx';
import { InputFile } from 'grammy';
import { createLogger } from '../../logger.js';
import { checkCooldown } from '../../db/cooldown.js';

const log = createLogger('ConvertXlsx');

// -- handleConvertXlsxStart --
export const handleConvertXlsxStart = async (ctx) => {
  try {
    await ctx.reply(
      '📤 Please upload .xlsx file to convert to .txt\n\n' +
      'I will extract only "Number" column and convert to .txt file',
      { reply_markup: { remove_keyboard: true } },
    );
    ctx.session.convertingXlsx = true;
  } catch (error) {
    log.error({ error }, 'Error in handleConvertXlsxStart');
    throw error;
  }
};

// -- handleXlsxFileInput --
export const handleXlsxFileInput = async (ctx) => {
  try {
    const cooldownCheck = await checkCooldown(ctx.from?.id, 'convert_xlsx', 20);

    if (cooldownCheck.onCooldown) {
      await ctx.reply(
        `Processing: Wait ${cooldownCheck.remainingSeconds} seconds before converting again`,
      );
      return;
    }

    const fileId = ctx.message.document.file_id;
    const fileName = ctx.message.document.file_name;

    if (!fileName.toLowerCase().endsWith('.xlsx')) {
      await ctx.reply('⚠️ File must be .xlsx format');
      return;
    }

    await ctx.reply('Processing: Processing file...');

    const file = await ctx.api.getFile(fileId);
    const baseUrl = 'https://api.telegram.org/file/bot';
    const downloadUrl = `${baseUrl}${ctx.api.token}/${file.file_path}`;

    const https = await import('https');
    const fileBuffer = await new Promise((resolve, reject) => {
      const req = https.default.get(downloadUrl, { timeout: 30000 }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Download timeout'));
      });
    });

    const workbook = XLSX.read(fileBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      await ctx.reply('⚠️ File has no data or invalid format');
      ctx.session.convertingXlsx = false;
      return;
    }

    const numbersSet = new Set();
    for (const row of data) {
      let cellValue = null;
      for (const key of Object.keys(row)) {
        const val = row[key];
        if (val) {
          const numStr = String(val).trim();
          const digitsOnly = numStr.replace(/\D/g, '');
          if (digitsOnly && digitsOnly.length >= 5 && !isNaN(digitsOnly)) {
            cellValue = digitsOnly;
            break;
          }
        }
      }
      if (cellValue) {
        numbersSet.add(cellValue);
      }
    }

    if (numbersSet.size === 0) {
      await ctx.reply('⚠️ No valid numbers (>= 5 digits) found in file');
      ctx.session.convertingXlsx = false;
      return;
    }

    const uniqueNumbers = Array.from(numbersSet);
    const txtContent = uniqueNumbers.join('\n');
    const txtBuffer = globalThis.Buffer.from(txtContent, 'utf8');
    const txtFileName = `numbers_${Date.now()}.txt`;

    await ctx.replyWithDocument(
      new InputFile(txtBuffer, txtFileName),
      {
        caption: `Conversion successful!\n\n📊 Total unique numbers: ${uniqueNumbers.length}`,
      },
    );

    ctx.session.convertingXlsx = false;
  } catch (error) {
    log.error({ error }, 'Error in handleXlsxFileInput');
    const errorMsg = error?.message || 'Unknown error';
    if (errorMsg.includes('timeout')) {
      await ctx.reply('⏱️ Timeout while downloading file. Try again with a smaller file.');
    } else {
      await ctx.reply('⚠️ Error occurred while processing file');
    }
    ctx.session.convertingXlsx = false;
  }
};

import { Keyboard } from 'grammy';

// -- ownerWAMenu --
export const ownerWAMenu = () => {
  return new Keyboard()
    .text('📱 Pair WhatsApp')
    .text('❌ Disconnect')
    .row()
    .text('🔍 Cek Bio')
    .text('📊 Status')
    .row()
    .text('🔙 Kembali')
    .resized();
};

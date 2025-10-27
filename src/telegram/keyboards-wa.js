import { Keyboard } from 'grammy';

// -- ownerWAMenu --
export const ownerWAMenu = () => {
  return new Keyboard()
    .text('📱 Pair WhatsApp')
    .text('❌ Disconnect')
    .row()
    .text('🔍 Check Bio')
    .text('📊 Status')
    .row()
    .text('🔙 Back')
    .resized();
};

import { Keyboard } from 'grammy';

// -- ownerMainMenu --
export const ownerMainMenu = () => {
  return new Keyboard()
    .text('👥 View Users')
    .text('➕ Add User')
    .row()
    .text('🔄 Extend User')
    .text('🗑️ Remove User')
    .row()
    .text('📊 System Status')
    .text('⚙️ Set Trial Days')
    .row()
    .text('📢 Broadcast')
    .text('📱 Pairing')
    .row()
    .text('🔍 Check Bio')
    .text('📧 Email Menu')
    .row()
    .text('❓ Help')
    .resized();
};

// -- ownerPairingMenu --
export const ownerPairingMenu = () => {
  return new Keyboard()
    .text('📱 Pair WhatsApp')
    .text('❌ Disconnect')
    .row()
    .text('🔍 Check Bio')
    .text('🔙 Back')
    .resized();
};

// -- ownerPanelMenu --
export const ownerPanelMenu = () => {
  return ownerMainMenu();
};

// -- mainAdminMenu --
export const mainAdminMenu = () => {
  return ownerMainMenu();
};

// -- userMainMenu --
export const userMainMenu = () => {
  return new Keyboard()
    .text('📱 Pair WhatsApp')
    .text('📊 Status')
    .row()
    .text('🔍 Check Bio')
    .text('❌ Disconnect')
    .row()
    .text('📧 Setup Email')
    .text('🔧 Fix Nomor')
    .row()
    .text('❓ Help')
    .text('🔙 Cancel')
    .resized();
};

// -- addUserRoleKeyboard --
export const addUserRoleKeyboard = () => {
  return new Keyboard()
    .text('👤 User')
    .text('👑 Owner')
    .row()
    .text('🔙 Cancel')
    .resized();
};

// -- cancelKeyboard --
export const cancelKeyboard = () => {
  return new Keyboard()
    .text('🔙 Cancel')
    .resized();
};

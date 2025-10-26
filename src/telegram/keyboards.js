import { Keyboard } from 'grammy';

// -- ownerMainMenu --
export const ownerMainMenu = () => {
  return new Keyboard()
    .text('🛠️ Owner Panel')
    .text('📱 Pairing')
    .row()
    .text('🔍 Check Bio')
    .resized();
};

// -- ownerPanelMenu --
export const ownerPanelMenu = () => {
  return new Keyboard()
    .text('👥 View Users')
    .text('➕ Add User')
    .row()
    .text('🔍 Check Bio')
    .text('📊 System Status')
    .row()
    .text('❓ Help')
    .text('🔙 Back')
    .resized();
};

// -- ownerPairingMenu --
export const ownerPairingMenu = () => {
  return new Keyboard()
    .text('📱 Pair WhatsApp')
    .text('📊 Status')
    .row()
    .text('🔍 Check Bio')
    .text('❌ Disconnect')
    .row()
    .text('❓ Help')
    .text('🔙 Back')
    .resized();
};

// -- mainAdminMenu --
export const mainAdminMenu = () => {
  return ownerPanelMenu();
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
    .text('❓ Help')
    .text('🔙 Cancel')
    .resized();
};

// -- addUserRoleKeyboard --
export const addUserRoleKeyboard = () => {
  return new Keyboard()
    .text('trial (1 day)')
    .text('user (permanent)')
    .row()
    .text('owner')
    .row()
    .text('Cancel')
    .resized();
};

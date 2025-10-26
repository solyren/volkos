import { Keyboard } from 'grammy';

// -- ownerMainMenu --
export const ownerMainMenu = () => {
  return new Keyboard()
    .text('🛠️ Owner Panel')
    .text('📱 Pairing')
    .resized();
};

// -- ownerPanelMenu --
export const ownerPanelMenu = () => {
  return new Keyboard()
    .text('👥 View Users')
    .text('➕ Add User')
    .row()
    .text('📊 System Status')
    .text('❓ Help')
    .row()
    .text('🔙 Back')
    .resized();
};

// -- ownerPairingMenu --
export const ownerPairingMenu = () => {
  return new Keyboard()
    .text('📱 Pair WhatsApp')
    .text('📊 Status')
    .row()
    .text('❌ Disconnect')
    .text('❓ Help')
    .row()
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
    .text('❌ Disconnect')
    .text('❓ Help')
    .row()
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

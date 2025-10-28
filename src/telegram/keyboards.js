import { Keyboard } from 'grammy';

// -- ownerMainMenu --
export const ownerMainMenu = () => {
  return new Keyboard()
    .text('👥 Lihat User')
    .text('➕ Tambah User')
    .row()
    .text('🔄 Perpanjang User')
    .text('🗑️ Hapus User')
    .row()
    .text('📊 Status Sistem')
    .text('⚙️ Atur Hari Trial')
    .row()
    .text('📢 Broadcast')
    .text('📱 Menu WA')
    .row()
    .text('📧 Menu Email')
    .text('❓ Help')
    .row()
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
    .text('🔍 Cek Bio')
    .text('❌ Disconnect')
    .row()
    .text('📧 Setup Email')
    .text('🔧 Fix Nomor')
    .row()
    .text('❓ Help')
    .text('🔙 Batal')
    .resized();
};

// -- addUserRoleKeyboard --
export const addUserRoleKeyboard = () => {
  return new Keyboard()
    .text('👤 Pengguna')
    .text('👑 Pemilik')
    .row()
    .text('🔙 Batal')
    .resized();
};

// -- cancelKeyboard --
export const cancelKeyboard = () => {
  return new Keyboard()
    .text('🔙 Batal')
    .resized();
};

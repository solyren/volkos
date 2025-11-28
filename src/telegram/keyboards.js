import { Keyboard } from 'grammy';

// -- ownerMainMenu --
export const ownerMainMenu = () => {
  return new Keyboard()
    .text('View Users')
    .text('Add User')
    .row()
    .text('System Status')
    .text('Broadcast')
    .row()
    .text('WhatsApp Menu')
    .text('Email Menu')
    .row()
    .text('Remove User')
    .text('Convert XLSX')
    .row()
    .text('Help')
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
    .text('Pair WhatsApp')
    .text('Check Bio')
    .row()
    .text('Status')
    .text('Setup Email')
    .row()
    .text('Disconnect')
    .text('Fix Number')
    .row()
    .text('Help')
    .resized();
};

// -- addUserRoleKeyboard --
export const addUserRoleKeyboard = () => {
  return new Keyboard()
    .text('User')
    .text('Owner')
    .row()
    .text('Cancel')
    .resized();
};

// -- cancelKeyboard --
export const cancelKeyboard = () => {
  return new Keyboard()
    .text('Cancel')
    .resized();
};

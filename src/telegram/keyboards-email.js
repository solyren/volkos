import { Keyboard } from 'grammy';

// -- ownerEmailMenu --
export const ownerEmailMenu = () => {
  return new Keyboard()
    .text('Set Template')
    .text('View Template')
    .row()
    .text('Delete Template')
    .text('Setup Email')
    .row()
    .text('Fix Number')
    .text('Back')
    .resized();
};

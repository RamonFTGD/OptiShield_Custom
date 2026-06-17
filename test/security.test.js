import { expect } from 'chai';
import { getUserLevel, hasPermission, LEVELS, isValidJid, getLevelName } from '../lib/security.js';

describe('Security Functions', () => {
  describe('getUserLevel', () => {
    it('should return USER level by default', () => {
      expect(getUserLevel('123@s.whatsapp.net')).to.equal(LEVELS.USER);
    });
  });

  describe('getLevelName', () => {
    it('should return the correct level name', () => {
      expect(getLevelName(LEVELS.USER)).to.equal('👤 Usuario');
      expect(getLevelName(LEVELS.OWNER)).to.equal('👑 Owner');
      expect(getLevelName(999)).to.equal('👤 Usuario');
    });
  });

  describe('hasPermission', () => {
    it('should return true if no required level is specified', () => {
      expect(hasPermission('123@s.whatsapp.net')).to.be.true;
    });

    it('should return true for USER if required level is USER', () => {
      expect(hasPermission('123@s.whatsapp.net', LEVELS.USER)).to.be.true;
    });

    it('should return false for USER if required level is ADMIN', () => {
      expect(hasPermission('123@s.whatsapp.net', LEVELS.ADMIN)).to.be.false;
    });
  });

  describe('isValidJid', () => {
    it('should validate JIDs correctly', () => {
      expect(isValidJid('123456789@s.whatsapp.net')).to.be.true;
      expect(isValidJid('123456789@g.us')).to.be.true;
      expect(isValidJid('abc@s.whatsapp.net')).to.be.false;
      expect(isValidJid('123@status')).to.be.false;
    });
  });
});

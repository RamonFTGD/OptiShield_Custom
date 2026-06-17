import { expect } from 'chai';
import { formatNum, formatBytes, isUrl, clamp } from '../lib/utils.js';

describe('Utility Functions', () => {
  describe('formatNum', () => {
    it('should format numbers correctly', () => {
      expect(formatNum(100)).to.equal('100');
      expect(formatNum(1500)).to.equal('1.5K');
      expect(formatNum(2000000)).to.equal('2.0M');
      expect(formatNum(0)).to.equal('0');
      expect(formatNum(null)).to.equal('?');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(1024)).to.equal('1.00 KB');
      expect(formatBytes(1048576)).to.equal('1.00 MB');
      expect(formatBytes(0)).to.equal('0.00 B');
    });
  });

  describe('isUrl', () => {
    it('should identify valid URLs', () => {
      expect(isUrl('https://google.com')).to.be.true;
      expect(isUrl('http://example.com')).to.be.true;
      expect(isUrl('ftp://example.com')).to.be.false;
      expect(isUrl('not a url')).to.be.false;
    });
  });

  describe('clamp', () => {
    it('should clamp strings correctly', () => {
      expect(clamp('hello world', 5)).to.equal('hello…');
      expect(clamp('hi', 5)).to.equal('hi');
      expect(clamp('', 5)).to.equal('');
    });
  });
});

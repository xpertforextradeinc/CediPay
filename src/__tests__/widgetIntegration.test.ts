import request from 'supertest';
import app from '../app';
import fs from 'fs';
import path from 'path';

describe('Widget Integration', () => {
  describe('Static Files', () => {
    it('should serve the checkout widget JavaScript', async () => {
      const response = await request(app).get('/cedipay-checkout.js');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('javascript');
      expect(response.text).toContain('CediPay Checkout Widget');
    });

    it('should serve the checkout widget CSS', async () => {
      const response = await request(app).get('/cedipay-checkout.css');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('css');
      expect(response.text).toContain('cedipay-overlay');
    });

    it('should serve the demo page', async () => {
      const response = await request(app).get('/demo.html');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('html');
      expect(response.text).toContain('CediPay Checkout Widget');
    });
  });

  describe('Widget Files Content', () => {
    it('widget JavaScript should define CediPay global object', () => {
      const widgetPath = path.join(__dirname, '../../public/cedipay-checkout.js');
      const content = fs.readFileSync(widgetPath, 'utf-8');

      expect(content).toContain('window.CediPay');
      expect(content).toContain('init:');
      expect(content).toContain('openCheckout:');
      expect(content).toContain('closeCheckout:');
    });

    it('widget CSS should have required styles', () => {
      const cssPath = path.join(__dirname, '../../public/cedipay-checkout.css');
      const content = fs.readFileSync(cssPath, 'utf-8');

      expect(content).toContain('.cedipay-overlay');
      expect(content).toContain('.cedipay-modal');
      expect(content).toContain('.cedipay-btn-primary');
    });

    it('demo page should include widget script', () => {
      const demoPath = path.join(__dirname, '../../public/demo.html');
      const content = fs.readFileSync(demoPath, 'utf-8');

      expect(content).toContain('cedipay-checkout.js');
      expect(content).toContain('CediPay.init');
      expect(content).toContain('CediPay.openCheckout');
    });
  });

  describe('Documentation', () => {
    it('should have widget setup documentation', () => {
      const docsPath = path.join(__dirname, '../../docs/WIDGET_SETUP.md');
      expect(fs.existsSync(docsPath)).toBe(true);

      const content = fs.readFileSync(docsPath, 'utf-8');
      expect(content).toContain('CediPay Checkout Widget');
      expect(content).toContain('Merchant Setup Guide');
    });

    it('should have implementation README', () => {
      const readmePath = path.join(__dirname, '../../WIDGET_README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toContain('CediPay Checkout Widget Implementation');
    });
  });
});

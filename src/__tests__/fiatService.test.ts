import { sendMobileMoney } from '../services/fiatService';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FiatService - sendMobileMoney', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env['PAYSTACK_SECRET_KEY'] = 'test-secret-key';
  });

  describe('Amount conversion to pesewas', () => {
    it('should correctly convert whole GHS amounts to pesewas', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { data: { reference: 'TEST-REF-123' } },
      });

      await sendMobileMoney({
        amount: 100,
        mobileNumber: '0541234567',
        network: 'MTN',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.paystack.co/transfer/initiate',
        expect.objectContaining({
          amount: 10000, // 100 GHS = 10000 pesewas
        }),
        expect.any(Object)
      );
    });

    it('should correctly handle decimal GHS amounts (e.g., 100.50 GHS)', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { data: { reference: 'TEST-REF-123' } },
      });

      await sendMobileMoney({
        amount: 100.50,
        mobileNumber: '0541234567',
        network: 'MTN',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.paystack.co/transfer/initiate',
        expect.objectContaining({
          amount: 10050, // 100.50 GHS = 10050 pesewas (not 10049.999999999998)
        }),
        expect.any(Object)
      );
    });

    it('should correctly handle small decimal amounts (e.g., 1.01 GHS)', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { data: { reference: 'TEST-REF-123' } },
      });

      await sendMobileMoney({
        amount: 1.01,
        mobileNumber: '0541234567',
        network: 'MTN',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.paystack.co/transfer/initiate',
        expect.objectContaining({
          amount: 101, // 1.01 GHS = 101 pesewas
        }),
        expect.any(Object)
      );
    });

    it('should correctly handle amounts with many decimal places', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { data: { reference: 'TEST-REF-123' } },
      });

      await sendMobileMoney({
        amount: 99.99,
        mobileNumber: '0541234567',
        network: 'MTN',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.paystack.co/transfer/initiate',
        expect.objectContaining({
          amount: 9999, // 99.99 GHS = 9999 pesewas
        }),
        expect.any(Object)
      );
    });

    it('should correctly handle large amounts', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { data: { reference: 'TEST-REF-123' } },
      });

      await sendMobileMoney({
        amount: 1234.56,
        mobileNumber: '0541234567',
        network: 'MTN',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.paystack.co/transfer/initiate',
        expect.objectContaining({
          amount: 123456, // 1234.56 GHS = 123456 pesewas
        }),
        expect.any(Object)
      );
    });

    it('should correctly handle 2.07 GHS (known floating-point issue)', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { data: { reference: 'TEST-REF-123' } },
      });

      await sendMobileMoney({
        amount: 2.07,
        mobileNumber: '0541234567',
        network: 'MTN',
      });

      // 2.07 * 100 = 206.99999999999997 in JavaScript
      // We need this to be exactly 207 (an integer)
      const callArgs = mockedAxios.post.mock.calls[0]?.[1] as any;
      expect(Number.isInteger(callArgs.amount)).toBe(true);
      expect(callArgs.amount).toBe(207);
    });

    it('should correctly handle 3.29 GHS (known floating-point issue)', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { data: { reference: 'TEST-REF-123' } },
      });

      await sendMobileMoney({
        amount: 3.29,
        mobileNumber: '0541234567',
        network: 'MTN',
      });

      // 3.29 * 100 = 328.99999999999994 in JavaScript
      // We need this to be exactly 329 (an integer)
      const callArgs = mockedAxios.post.mock.calls[0]?.[1] as any;
      expect(Number.isInteger(callArgs.amount)).toBe(true);
      expect(callArgs.amount).toBe(329);
    });
  });

  describe('Validation', () => {
    it('should reject amounts less than 1 GHS', async () => {
      await expect(
        sendMobileMoney({
          amount: 0.5,
          mobileNumber: '0541234567',
          network: 'MTN',
        })
      ).rejects.toThrow();
    });

    it('should reject invalid mobile number length', async () => {
      await expect(
        sendMobileMoney({
          amount: 100,
          mobileNumber: '054123456', // Only 9 digits
          network: 'MTN',
        })
      ).rejects.toThrow();
    });

    it('should reject invalid network', async () => {
      await expect(
        sendMobileMoney({
          amount: 100,
          mobileNumber: '0541234567',
          network: 'INVALID' as any,
        })
      ).rejects.toThrow();
    });
  });

  describe('API Integration', () => {
    it('should call Paystack API with correct headers', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { data: { reference: 'TEST-REF-123' } },
      });

      await sendMobileMoney({
        amount: 100,
        mobileNumber: '0541234567',
        network: 'MTN',
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.paystack.co/transfer/initiate',
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-secret-key',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should return success response with reference', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { data: { reference: 'TEST-REF-123' } },
      });

      const result = await sendMobileMoney({
        amount: 100,
        mobileNumber: '0541234567',
        network: 'MTN',
      });

      expect(result).toEqual({
        success: true,
        ref: 'TEST-REF-123',
      });
    });

    it('should throw error when API call fails', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API Error'));

      await expect(
        sendMobileMoney({
          amount: 100,
          mobileNumber: '0541234567',
          network: 'MTN',
        })
      ).rejects.toThrow('Mobile Money transfer failed');
    });
  });
});

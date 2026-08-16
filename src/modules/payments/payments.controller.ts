import type { Request, Response } from 'express';
import { paymentsService } from './payments.service.js';
import { verifyWebhookSignature } from '../../lib/paystack.js';
import { BadRequestError } from '../../lib/errors.js';

export const paymentsController = {
  /**
   * Public endpoint — Safaricom calls this directly, no JWT auth.
   * Always responds 200 { ResultCode: 0 } to acknowledge receipt per Daraja contract.
   * Actual success/failure is inside req.body and handled in the service.
   */
  async mpesaCallback(req: Request, res: Response) {
    await paymentsService.handleMpesaCallback(req.body);
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  },

  /**
   * Public endpoint — Paystack calls this.
   * Signature check happens here (not in service) because it needs raw HTTP request data.
   * Always 200 after accepting; errors during processing are logged but not surfaced to Paystack.
   */
  async paystackWebhook(req: Request, res: Response) {
    const signature = req.headers['x-paystack-signature'] as string | undefined;
    const rawBody = (req as any).rawBody as Buffer;

    if (!verifyWebhookSignature(rawBody, signature)) {
      // Reject immediately — someone is calling our webhook without a valid signature
      res.status(401).json({ error: { message: 'Invalid signature' } });
      return;
    }

    await paymentsService.handlePaystackWebhook(req.body);
    res.status(200).send('OK');
  },
  
  async getStatusByReference(req: Request, res: Response) {
  const reference = req.query.reference as string;
  if (!reference) throw new BadRequestError('reference is required');
  const result = await paymentsService.getStatusByReference(reference);
  res.json(result);
},

  async getStatus(req: Request, res: Response) {
    const payment = await paymentsService.getStatus(String(req.params.bookingId));
    res.json({ payment });
  },
};

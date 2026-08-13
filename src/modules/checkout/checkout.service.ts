import { cartRepository } from '../cart/cart.repository.js';
import { ordersRepository } from '../orders/orders.repository.js';
import { productsRepository } from '../products/products.repository.js';
import { pricingService } from '../pricing/pricing.service.js';
import { paymentsService } from '../payments/payments.service.js';
import { BadRequestError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import type { CheckoutInput } from './checkout.schema.js';

// Reasonable default — a typical mixed e-commerce order doesn't have a known weight
const DEFAULT_PARCEL_WEIGHT_KG = 2;

export const checkoutService = {
  async checkout(customerId: string, input: CheckoutInput) {
    const cart = await cartRepository.findOrCreateForUser(customerId);
    const fullCart = await cartRepository.getWithItems(cart.id);

    if (!fullCart || fullCart.items.length === 0) {
      throw new BadRequestError('Cart is empty');
    }

    // Authoritative pre-flight stock check BEFORE the transaction.
    // The transaction has its own atomic check too, but this gives a clear 400 error
    // with the product name rather than a cryptic transaction rollback.
    for (const item of fullCart.items) {
      const product = await productsRepository.findById(item.productId);
      if (!product || !product.isActive) {
        throw new BadRequestError(`"${item.product.name}" is no longer available`);
      }
      if (product.stockQuantity < item.quantity) {
        throw new BadRequestError(
          `Only ${product.stockQuantity} unit(s) of "${product.name}" left in stock`,
        );
      }
    }

    const productsTotal = fullCart.items.reduce(
      (sum, i) => sum + i.product.price * i.quantity,
      0,
    );

    const deliveryQuote = await pricingService.calculateQuote({
      pickupZoneId: env.STORE_PICKUP_ZONE_ID,
      dropoffZoneId: input.dropoffZoneId,
      packageType: 'PARCEL',
      weightKg: DEFAULT_PARCEL_WEIGHT_KG,
    });

    const totalAmount = productsTotal + deliveryQuote.price;

    const order = await ordersRepository.createWithItemsAndReserveStock({
      customerId,
      items: fullCart.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.product.price, // snapshot — never re-read product.price after this point
      })),
      productsTotal,
      deliveryFee: deliveryQuote.price,
      totalAmount,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      dropoffZoneId: input.dropoffZoneId,
      dropoffAddress: input.dropoffAddress,
    });

    // Cart cleared now — the order carries its own immutable snapshot of what was purchased
    await cartRepository.clearCart(cart.id);

    const payment =
      input.paymentMethod === 'MPESA'
        ? await paymentsService.initiateMpesaForOrder(order.id, input.payerPhone!, totalAmount)
        : await paymentsService.initiateCardForOrder(order.id, input.payerEmail!, totalAmount);

    return { order, payment };
  },
};

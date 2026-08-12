import { cartRepository } from './cart.repository.js';
import { productsRepository } from '../products/products.repository.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';

async function assertProductAvailable(productId: string, requestedQuantity: number) {
  const product = await productsRepository.findById(productId);
  if (!product || !product.isActive) {
    throw new NotFoundError('Product not found');
  }
  if (product.stockQuantity < requestedQuantity) {
    throw new BadRequestError(`Only ${product.stockQuantity} unit(s) of "${product.name}" available`);
  }
  return product;
}

export const cartService = {
  async getCart(userId: string) {
    const cart = await cartRepository.findOrCreateForUser(userId);
    const fullCart = await cartRepository.getWithItems(cart.id);

    const items = fullCart!.items.map((item) => ({
      productId: item.productId,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
      imageUrl: item.product.imageUrl,
      lineTotal: item.product.price * item.quantity,
      inStock: item.product.stockQuantity >= item.quantity,
    }));

    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);

    return { cartId: cart.id, items, total };
  },

  async addItem(userId: string, productId: string, quantity: number) {
    const cart = await cartRepository.findOrCreateForUser(userId);
    const existing = await cartRepository.findItem(cart.id, productId);

    const totalRequestedQuantity = (existing?.quantity ?? 0) + quantity;
    await assertProductAvailable(productId, totalRequestedQuantity);

    if (existing) {
      await cartRepository.incrementItem(cart.id, productId, quantity);
    } else {
      await cartRepository.addItem(cart.id, productId, quantity);
    }

    return cartService.getCart(userId);
  },

  async updateItemQuantity(userId: string, productId: string, quantity: number) {
    const cart = await cartRepository.findOrCreateForUser(userId);
    const existing = await cartRepository.findItem(cart.id, productId);
    if (!existing) {
      throw new NotFoundError('Item not in cart');
    }

    await assertProductAvailable(productId, quantity);
    await cartRepository.setItemQuantity(cart.id, productId, quantity);

    return cartService.getCart(userId);
  },

  async removeItem(userId: string, productId: string) {
    const cart = await cartRepository.findOrCreateForUser(userId);
    const existing = await cartRepository.findItem(cart.id, productId);
    if (!existing) {
      throw new NotFoundError('Item not in cart');
    }
    await cartRepository.removeItem(cart.id, productId);
    return cartService.getCart(userId);
  },

  async clear(userId: string) {
    const cart = await cartRepository.findOrCreateForUser(userId);
    await cartRepository.clearCart(cart.id);
  },
};

import { prisma } from '../../config/db.js';

export const cartRepository = {
  async findOrCreateForUser(userId: string) {
    const existing = await prisma.cart.findUnique({ where: { userId } });
    if (existing) return existing;
    return prisma.cart.create({ data: { userId } });
  },

  getWithItems(cartId: string) {
    return prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: { product: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  findItem(cartId: string, productId: string) {
    return prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId } },
    });
  },

  addItem(cartId: string, productId: string, quantity: number) {
    return prisma.cartItem.create({ data: { cartId, productId, quantity } });
  },

  incrementItem(cartId: string, productId: string, byQuantity: number) {
    return prisma.cartItem.update({
      where: { cartId_productId: { cartId, productId } },
      data: { quantity: { increment: byQuantity } },
    });
  },

  setItemQuantity(cartId: string, productId: string, quantity: number) {
    return prisma.cartItem.update({
      where: { cartId_productId: { cartId, productId } },
      data: { quantity },
    });
  },

  removeItem(cartId: string, productId: string) {
    return prisma.cartItem.delete({
      where: { cartId_productId: { cartId, productId } },
    });
  },

  clearCart(cartId: string) {
    return prisma.cartItem.deleteMany({ where: { cartId } });
  },
};

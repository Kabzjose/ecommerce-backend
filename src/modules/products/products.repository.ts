import { prisma } from '../../config/db.js';
import type { CreateProductInput, UpdateProductInput } from './products.schema.js';

export const productsRepository = {
  create(data: CreateProductInput) {
    return prisma.product.create({ data });
  },

  findById(id: string) {
    return prisma.product.findUnique({ where: { id } });
  },

  findMany(params: {
    category?: string;
    search?: string;
    onlyActive: boolean;
    skip: number;
    take: number;
  }) {
    const { category, search, onlyActive, skip, take } = params;
    return prisma.product.findMany({
      where: {
        ...(onlyActive && { isActive: true }),
        ...(category && { category }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  },

  count(params: { category?: string; search?: string; onlyActive: boolean }) {
    const { category, search, onlyActive } = params;
    return prisma.product.count({
      where: {
        ...(onlyActive && { isActive: true }),
        ...(category && { category }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
    });
  },

  update(id: string, data: UpdateProductInput) {
    return prisma.product.update({ where: { id }, data });
  },

  // Atomic decrement — prevents overselling race conditions between
  // "read stockQuantity" and "write stockQuantity - n"
  decrementStock(id: string, quantity: number) {
    return prisma.product.update({
      where: { id },
      data: { stockQuantity: { decrement: quantity } },
    });
  },

  deactivate(id: string) {
    return prisma.product.update({ where: { id }, data: { isActive: false } });
  },
};

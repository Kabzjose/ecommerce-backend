import { prisma } from '../../config/db.js';

export const productsRepository = {
  findById(id: string) {
    return prisma.product.findUnique({ where: { id } });
  },
};

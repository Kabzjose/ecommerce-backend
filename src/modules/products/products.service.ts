import { productsRepository } from './products.repository.js';
import { NotFoundError } from '../../lib/errors.js';
import type { CreateProductInput, UpdateProductInput } from './products.schema.js';

export const productsService = {
  create(input: CreateProductInput) {
    return productsRepository.create(input);
  },

  // includeInactive=true for admin panel — they need to see deactivated products to re-activate them
  async getById(id: string, includeInactive = false) {
    const product = await productsRepository.findById(id);
    if (!product || (!includeInactive && !product.isActive)) {
      throw new NotFoundError('Product not found');
    }
    return product;
  },

  async list(params: {
    category?: string;
    search?: string;
    page: number;
    limit: number;
    asAdmin: boolean;
  }) {
    const { category, search, page, limit, asAdmin } = params;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      productsRepository.findMany({ category, search, onlyActive: !asAdmin, skip, take: limit }),
      productsRepository.count({ category, search, onlyActive: !asAdmin }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async update(id: string, input: UpdateProductInput) {
    const existing = await productsRepository.findById(id);
    if (!existing) throw new NotFoundError('Product not found');
    return productsRepository.update(id, input);
  },

  async deactivate(id: string) {
    const existing = await productsRepository.findById(id);
    if (!existing) throw new NotFoundError('Product not found');
    return productsRepository.deactivate(id);
  },
};

import { adminRepository } from './admin.repository.js';

export const adminService = {
  getOverview() {
    return adminRepository.getOverviewStats();
  },

  async getAllRidersPerformance(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const { riders, total } = await adminRepository.listRidersForPerformance(skip, limit);

    // Run all rider performance queries concurrently — they're independent of each other
    // Trade-off: N parallel lightweight queries (fine at typical page sizes of 20)
    const withPerformance = await Promise.all(
      riders.map(async (rider) => ({
        ...rider,
        performance: await adminRepository.getRiderPerformance(rider.id),
      })),
    );

    return { items: withPerformance, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  getSingleRiderPerformance(riderId: string) {
    return adminRepository.getRiderPerformance(riderId);
  },

  getRevenue(days: number) {
    return adminRepository.getRevenueByPeriod(days);
  },
};

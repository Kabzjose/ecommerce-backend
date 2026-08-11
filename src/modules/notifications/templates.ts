export const templates = {
  paymentConfirmed: (bookingId: string, price: number) =>
    `ChapChap: Payment of KES ${price} confirmed for booking #${bookingId.slice(0, 8)}. We're finding you a rider!`,

  riderAssigned: (bookingId: string, riderName: string) =>
    `ChapChap: ${riderName} has been assigned to your delivery #${bookingId.slice(0, 8)} and will pick up your package shortly.`,

  pickedUp: (bookingId: string) =>
    `ChapChap: Your package for booking #${bookingId.slice(0, 8)} has been picked up and is on its way!`,

  inTransit: (bookingId: string) =>
    `ChapChap: Your package #${bookingId.slice(0, 8)} is now in transit.`,

  delivered: (bookingId: string) =>
    `ChapChap: Your package #${bookingId.slice(0, 8)} has been delivered. Thank you for choosing us!`,

  bookingCancelled: (bookingId: string, reason: string) =>
    `ChapChap: Your booking #${bookingId.slice(0, 8)} was cancelled. Reason: ${reason}`,

  recipientIncoming: (bookingId: string, senderName: string) =>
    `ChapChap: ${senderName} is sending you a package (ref #${bookingId.slice(0, 8)}). You'll be notified when it's out for delivery.`,
};

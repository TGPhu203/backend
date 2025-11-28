// services/payment/payosService.js
import { PayOS } from "@payos/node";

const payOS = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

/**
 * Tạo link thanh toán cho 1 order
 */
const createPaymentLink = async ({
  orderCode,
  amount,
  description,
  items = [],
  returnUrl,
  cancelUrl,
}) => {
  const paymentData = {
    orderCode,   // integer
    amount,      // integer VND
    description,
    items,       // [{ name, quantity, price }]
    returnUrl,
    cancelUrl,
  };

  const paymentLink = await payOS.paymentRequests.create(paymentData);
  return paymentLink;
};

/**
 * Xác thực webhook và lấy dữ liệu thanh toán
 */
const verifyWebhook = async (payload) => {
  // SDK PayOS thường sẽ verify và trả lại phần "data" đã giải mã
  const data = await payOS.webhooks.verify(payload);
  return data;
};

export default {
  createPaymentLink,
  verifyWebhook,
};

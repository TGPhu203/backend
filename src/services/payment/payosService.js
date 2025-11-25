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
    orderCode,       // integer
    amount,          // integer VND
    description,
    items,           // [{ name, quantity, price }]
    returnUrl,
    cancelUrl,
  };

  // SDK NodeJS: paymentRequests.create() :contentReference[oaicite:1]{index=1}
  const paymentLink = await payOS.paymentRequests.create(paymentData);

  // paymentLink.checkoutUrl là URL để redirect người dùng :contentReference[oaicite:2]{index=2}
  return paymentLink;
};

/**
 * Xác thực webhook và lấy dữ liệu thanh toán
 */
const verifyWebhook = (payload) => {
  // webhooks.verify() trả về dữ liệu có orderCode, amount, paymentLinkId, code, desc, ... :contentReference[oaicite:3]{index=3}
  const data = payOS.webhooks.verify(payload);
  return data;
};

export default {
  createPaymentLink,
  verifyWebhook,
};

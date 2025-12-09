// services/email/emailService.js
import nodemailer from 'nodemailer';


// Create transporter
const createTransporter = () => {
  const host = process.env.EMAIL_HOST || "smtp.gmail.com";
  const port = Number(process.env.EMAIL_PORT) || 587;
  const user = process.env.EMAIL_USERNAME;
  const pass = process.env.EMAIL_PASSWORD;

  if (!user || !pass) {
    console.error("[MAIL] Thiếu EMAIL_USERNAME hoặc EMAIL_PASSWORD");
  }

  if (process.env.NODE_ENV === "development") {
    return nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass },
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.EMAIL_SECURE === "true",
    auth: { user, pass },
  });
};

// Send email (hàm chung)
export const sendEmail = async (options) => {
  const transporter = createTransporter();

  const fromName = process.env.EMAIL_FROM_NAME || "shopmini";
  const fromEmail =
    process.env.EMAIL_FROM || process.env.EMAIL_USERNAME || "no-reply@example.com";

  const subject = options.subject || "(no subject)";
  const text =
    options.text ||
    "Email này không có nội dung text. Nếu bạn thấy thông báo này thì có gì đó sai với template HTML.";
  const html = options.html || `<p>${text}</p>`;

  const mailOptions = {
    from: `${fromName} <${fromEmail}>`,
    to: options.email,
    subject,
    text,
    html,
  };

  // log debug
  console.log("[MAIL] To:", options.email);
  console.log("[MAIL] Subject:", subject);
  console.log("[MAIL] HTML length:", html.length);

  await transporter.sendMail(mailOptions);
};

// ============== Verification email ==============
export const sendVerificationEmail = async (email, token) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
  const verificationUrl = `${frontendUrl}/verify-email/${token}`;

  const subject = "Xác thực tài khoản của bạn";

  const text = [
    "Cảm ơn bạn đã đăng ký tài khoản.",
    "Vui lòng truy cập đường dẫn sau để xác thực email:",
    verificationUrl,
    "",
    "Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.",
    "Liên kết này sẽ hết hạn sau 24 giờ.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Xác thực tài khoản</h2>
      <p>Cảm ơn bạn đã đăng ký tài khoản. Vui lòng nhấp vào liên kết bên dưới để xác thực email của bạn:</p>
      <p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">
          Xác thực email
        </a>
      </p>
      <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
      <p>Liên kết này sẽ hết hạn sau 24 giờ.</p>
      <p>Nếu nút không hoạt động, hãy copy liên kết sau và dán vào trình duyệt:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
    </div>
  `;

  await sendEmail({ email, subject, text, html });
};

// ============== Reset password email ==============
export const sendResetPasswordEmail = async (email, token) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
  const resetUrl = `${frontendUrl}/reset-password/${token}`;

  const subject = "Đặt lại mật khẩu của bạn";

  const text = [
    "Bạn đã yêu cầu đặt lại mật khẩu.",
    "Vui lòng truy cập đường dẫn sau để đặt lại mật khẩu:",
    resetUrl,
    "",
    "Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.",
    "Liên kết này sẽ hết hạn sau 1 giờ.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Đặt lại mật khẩu</h2>
      <p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng nhấp vào liên kết bên dưới để đặt lại mật khẩu của bạn:</p>
      <p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">
          Đặt lại mật khẩu
        </a>
      </p>
      <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
      <p>Liên kết này sẽ hết hạn sau 1 giờ.</p>
      <p>Nếu nút không hoạt động, hãy copy liên kết sau và dán vào trình duyệt:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
    </div>
  `;

  await sendEmail({ email, subject, text, html });
};


// Send order confirmation email
export const sendOrderConfirmationEmail = async (email, order) => {
  const { orderNumber, orderDate, total, items, shippingAddress } = order;

  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.price.toLocaleString('vi-VN')}đ</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.subtotal.toLocaleString('vi-VN')}đ</td>
      </tr>
    `
    )
    .join('');

  await sendEmail({
    email,
    subject: `Xác nhận đơn hàng #${orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Xác nhận đơn hàng</h2>
        <p>Cảm ơn bạn đã đặt hàng. Đơn hàng của bạn đã được xác nhận.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p><strong>Mã đơn hàng:</strong> #${orderNumber}</p>
          <p><strong>Ngày đặt hàng:</strong> ${new Date(orderDate).toLocaleDateString('vi-VN')}</p>
          <p><strong>Tổng tiền:</strong> ${total.toLocaleString('vi-VN')}đ</p>
        </div>
        
        <h3>Chi tiết đơn hàng</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="padding: 10px; text-align: left;">Sản phẩm</th>
              <th style="padding: 10px; text-align: center;">Số lượng</th>
              <th style="padding: 10px; text-align: right;">Đơn giá</th>
              <th style="padding: 10px; text-align: right;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 10px; text-align: right;"><strong>Tổng cộng:</strong></td>
              <td style="padding: 10px; text-align: right;"><strong>${total.toLocaleString('vi-VN')}đ</strong></td>
            </tr>
          </tfoot>
        </table>
        
        <h3>Địa chỉ giao hàng</h3>
        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p>${shippingAddress.name}</p>
          <p>${shippingAddress.address1}</p>
          ${shippingAddress.address2 ? `<p>${shippingAddress.address2}</p>` : ''}
          <p>${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zip}</p>
          <p>${shippingAddress.country}</p>
        </div>
        
        <p>Chúng tôi sẽ thông báo cho bạn khi đơn hàng được giao.</p>
        <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi.</p>
      </div>
    `,
  });
};

// Send order status update email
export const sendOrderStatusUpdateEmail = async (email, order) => {
  const { orderNumber, orderDate, status } = order;

  const statusMap = {
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    shipped: 'Đã giao cho đơn vị vận chuyển',
    delivered: 'Đã giao hàng',
    cancelled: 'Đã hủy',
    completed: 'Hoàn thành',
  };

  const statusText = statusMap[status] || status;

  await sendEmail({
    email,
    subject: `Cập nhật trạng thái đơn hàng #${orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Cập nhật trạng thái đơn hàng</h2>
        <p>Đơn hàng của bạn đã được cập nhật.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p><strong>Mã đơn hàng:</strong> #${orderNumber}</p>
          <p><strong>Ngày đặt hàng:</strong> ${new Date(orderDate).toLocaleDateString('vi-VN')}</p>
          <p><strong>Trạng thái mới:</strong> ${statusText}</p>
        </div>
        
        <p>Bạn có thể theo dõi đơn hàng của mình trong tài khoản của bạn.</p>
        <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi.</p>
      </div>
    `,
  });
};

// Send order cancellation email
export const sendOrderCancellationEmail = async (email, order) => {
  const { orderNumber, orderDate } = order;

  await sendEmail({
    email,
    subject: `Đơn hàng #${orderNumber} đã bị hủy`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Đơn hàng đã bị hủy</h2>
        <p>Đơn hàng của bạn đã bị hủy theo yêu cầu của bạn.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p><strong>Mã đơn hàng:</strong> #${orderNumber}</p>
          <p><strong>Ngày đặt hàng:</strong> ${new Date(orderDate).toLocaleDateString('vi-VN')}</p>
        </div>
        
        <p>Nếu bạn đã thanh toán cho đơn hàng này, khoản tiền sẽ được hoàn lại trong vòng 5-7 ngày làm việc.</p>
        <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi.</p>
      </div>
    `,
  });
};

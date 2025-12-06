import { RepairRequest } from "../models/index.js";
// nếu muốn gửi mail cho KH / admin, bạn có thể import service email
// import { sendRepairRequestEmail } from "../services/email/emailService.js";

export const createRepairRequest = async (req, res) => {
  try {
    const {
      customerName,
      phone,
      email,
      productName,
      imei,
      issueDescription,
      preferredTime,
    } = req.body || {};

    if (!customerName || !phone || !productName || !issueDescription) {
      return res.status(400).json({
        status: "error",
        message:
          "Vui lòng nhập đầy đủ họ tên, số điện thoại, sản phẩm và mô tả vấn đề",
      });
    }

    const payload = {
      customerName,
      phone,
      email,
      productName,
      imei,
      issueDescription,
      preferredTime,
    };

    // nếu route này có dùng verifyToken thì có thể gán userId = req.user.id
    if (req.user && req.user.id) {
      payload.userId = req.user.id;
    }

    const doc = await RepairRequest.create(payload);

    // TODO: gửi email thông báo cho admin / khách nếu bạn muốn
    // await sendRepairRequestEmail({ ... });

    return res.status(201).json({
      status: "success",
      data: doc,
    });
  } catch (error) {
    console.error("Error creating repair request:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

// ADMIN: lấy danh sách yêu cầu sửa chữa
export const getAllRepairRequests = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sort = "createdAt",
      order = "DESC",
    } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { productName: { $regex: search, $options: "i" } },
        { imei: { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {};
    sortOptions[sort] = order === "DESC" ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [rows, total] = await Promise.all([
      RepairRequest.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      RepairRequest.countDocuments(query),
    ]);

    return res.status(200).json({
      status: "success",
      data: {
        repairRequests: rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching repair requests:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

// ADMIN: xem chi tiết 1 yêu cầu
export const getRepairRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await RepairRequest.findById(id).lean();

    if (!doc) {
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy yêu cầu sửa chữa",
      });
    }

    return res.status(200).json({
      status: "success",
      data: doc,
    });
  } catch (error) {
    console.error("Error fetching repair request:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};

// ADMIN: cập nhật trạng thái / ghi chú
export const updateRepairRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body || {};

    const doc = await RepairRequest.findById(id);
    if (!doc) {
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy yêu cầu sửa chữa",
      });
    }

    if (status) {
      doc.status = status; // cần gửi đúng 1 trong ["new", "in_progress", "completed", "cancelled"]
    }

    if (adminNotes !== undefined) {
      doc.adminNotes = adminNotes;
    }

    await doc.save();

    // TODO: nếu muốn, gửi email thông báo cập nhật trạng thái cho khách hàng

    return res.status(200).json({
      status: "success",
      data: doc,
    });
  } catch (error) {
    console.error("Error updating repair request:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};
// LỊCH SỬ YÊU CẦU SỬA CHỮA CỦA CHÍNH USER
export const getMyRepairRequests = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        status: "error",
        message: "Vui lòng đăng nhập để xem lịch sử bảo hành",
      });
    }

    const userId = req.user.id;

    const rows = await RepairRequest.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      status: "success",
      data: rows,
    });
  } catch (error) {
    console.error("Error getMyRepairRequests:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};


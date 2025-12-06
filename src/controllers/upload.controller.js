// upload.controller.js (hoặc tương đương)
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "../middlewares/errorHandler.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDirs = {
  reviews: path.join(__dirname, "../../uploads/reviews"),
  products: path.join(__dirname, "../../uploads/products"),
  users: path.join(__dirname, "../../uploads/users"),
  avatar: path.join(__dirname, "../../uploads/avatar"),
};

Object.values(uploadDirs).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadType = req.params.type || "general";
    const uploadPath = uploadDirs[uploadType] || uploadDirs.products;
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// ⚠ CHO PHÉP CẢ ẢNH LẪN VIDEO
const fileFilter = (req, file, cb) => {
  const allowedImageMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  const allowedVideoMimes = [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",   // mov
    "video/x-msvideo",   // avi
    "video/x-ms-wmv",
  ];

  if (
    allowedImageMimes.includes(file.mimetype) ||
    allowedVideoMimes.includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "Chỉ chấp nhận file ảnh hoặc video (JPEG, PNG, GIF, WebP, MP4, WebM, OGG...)",
        400
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB cho cả ảnh/video
    files: 10,
  },
});

// Single
const uploadSingle = async (req, res, next) => {
  try {
    const uploadType = req.params.type || "general";
    const uploadMiddleware = upload.single("file");

    uploadMiddleware(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return next(new AppError("File quá lớn. Tối đa 50MB", 400));
          }
          return next(new AppError(`Lỗi upload: ${err.message}`, 400));
        }
        return next(err);
      }

      if (!req.file) return next(new AppError("Không có file được upload", 400));

      const fileUrl = `/uploads/${uploadType}/${req.file.filename}`;

      res.status(200).json({
        status: "success",
        message: "Upload file thành công",
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          url: fileUrl,
          size: req.file.size,
          mimetype: req.file.mimetype, // 👈 thêm
          type: uploadType,
        },
      });
    });
  } catch (error) {
    next(error);
  }
};

// Multiple
const uploadMultiple = async (req, res, next) => {
  try {
    const uploadType = req.params.type || "general";
    const maxFiles = uploadType === "reviews" ? 5 : 10;
    const uploadMiddleware = upload.array("files", maxFiles);

    uploadMiddleware(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return next(new AppError("File quá lớn. Tối đa 50MB", 400));
          }
          if (err.code === "LIMIT_FILE_COUNT") {
            return next(
              new AppError(`Số lượng file tối đa là ${maxFiles}`, 400)
            );
          }
          return next(new AppError(`Lỗi upload: ${err.message}`, 400));
        }
        return next(err);
      }

      if (!req.files || req.files.length === 0) {
        return next(new AppError("Không có file được upload", 400));
      }

      const files = req.files.map((file) => ({
        filename: file.filename,
        originalName: file.originalname,
        url: `/uploads/${uploadType}/${file.filename}`,
        size: file.size,
        mimetype: file.mimetype, // 👈 thêm
      }));

      res.status(200).json({
        status: "success",
        message: `Upload ${files.length} file thành công`,
        data: { files, type: uploadType, count: files.length },
      });
    });
  } catch (error) {
    next(error);
  }
};

const deleteFile = async (req, res, next) => {
  try {
    const { type, filename } = req.params;

    if (!uploadDirs[type]) throw new AppError("Loại file không hợp lệ", 400);

    const filePath = path.join(uploadDirs[type], filename);

    if (!fs.existsSync(filePath)) throw new AppError("File không tồn tại", 404);

    fs.unlinkSync(filePath);

    res.status(200).json({
      status: "success",
      message: "Xóa file thành công",
    });
  } catch (error) {
    next(error);
  }
};

export default {
  uploadSingle,
  uploadMultiple,
  deleteFile,
  upload,
};

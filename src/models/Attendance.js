import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: Date,
    required: true, // Lưu ngày (ví dụ: 2023-10-27T00:00:00.000Z) để query
  },
  checkIn: {
    type: Date,
  },
  checkOut: {
    type: Date,
  },
  workHours: {
    type: Number,
    default: 0, // Số giờ làm việc trong ngày
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'leave'], // Có mặt, vắng, đi muộn, xin nghỉ
    default: 'present',
  },
  note: String, // Ghi chú (nếu đi muộn hoặc xin về sớm)
}, { timestamps: true });

// Index để tìm kiếm nhanh theo user và ngày
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
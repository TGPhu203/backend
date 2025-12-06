import mongoose from 'mongoose';

const payrollSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  month: { type: Number, required: true }, // Tháng 1-12
  year: { type: Number, required: true },  // Năm 2024
  
  totalWorkDays: { type: Number, default: 0 }, // Tổng ngày công
  totalWorkHours: { type: Number, default: 0 }, // Tổng giờ làm (nếu tính theo giờ)
  
  baseSalary: { type: Number, required: true }, // Lương cứng lúc tính
  bonus: { type: Number, default: 0 }, // Thưởng
  deductions: { type: Number, default: 0 }, // Phạt/Khấu trừ
  
  finalSalary: { type: Number, required: true }, // Thực lĩnh
  
  status: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending',
  },
  paidAt: Date,
}, { timestamps: true });

const Payroll = mongoose.model('Payroll', payrollSchema);
export default Payroll;
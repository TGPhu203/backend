// src/utils/imei.js

// Tính checksum Luhn cho 14 số đầu
function calcLuhnChecksum(digits14) {
    let sum = 0;
  
    for (let i = 0; i < 14; i++) {
      let digit = parseInt(digits14[i], 10);
      const posFromRight = 14 - i;
  
      // Vị trí chẵn từ phải sang trái → nhân đôi
      if (posFromRight % 2 === 0) {
        digit = digit * 2;
        if (digit > 9) digit -= 9;
      }
  
      sum += digit;
    }
  
    const checksum = (10 - (sum % 10)) % 10;
    return checksum;
  }
  
  export function generateRandomImei() {
    // 6 số TAC giả (Type Allocation Code)
    const tac = "356938"; // demo
  
    // 8 số serial ngẫu nhiên
    let serial = "";
    for (let i = 0; i < 8; i++) {
      serial += Math.floor(Math.random() * 10).toString();
    }
  
    const first14 = tac + serial;
  
    const checksum = calcLuhnChecksum(first14);
    return first14 + checksum.toString(); // đủ 15 số
  }
  
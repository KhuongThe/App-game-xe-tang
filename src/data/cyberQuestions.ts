import { CyberQuestion } from '../types/game';

export const CYBER_QUESTIONS: CyberQuestion[] = [
  {
    id: 'q1',
    topic: 'PHISHING',
    topicLabel: '🎣 Lừa đảo Phishing',
    question: 'Bạn nhận được tin nhắn SMS: "Tài khoản của bạn đã trúng thưởng iPhone 16 Pro Max! Nhấp vào link bit.ly/qua-tang để nhận ngay". Bạn nên làm gì?',
    options: [
      'Bấm vào link ngay để kịp nhận quà kẻo hết hạn',
      'Xóa tin nhắn hoặc báo cáo lừa đảo, tuyệt đối không bấm vào link lạ',
      'Chia sẻ link cho bạn bè cùng nhận thưởng'
    ],
    correctIndex: 1,
    explanation: 'Đây là chiêu trò Phishing kinh điển. Kẻ gian gửi link độc hại để đánh cắp mật khẩu, mã OTP hoặc cài virus vào máy của bạn.',
    rewardType: 'SHIELD',
    rewardLabel: '🛡️ KHIÊN TƯỜNG LỬA (Chặn 2 phát đạn)',
  },
  {
    id: 'q2',
    topic: 'PASSWORD',
    topicLabel: '🔑 Mật khẩu & Bảo mật',
    question: 'Mật khẩu nào sau đây là mạnh và an toàn nhất để bảo vệ tài khoản của bạn?',
    options: [
      '12345678 hoặc abcdefgh',
      'nguyenvana2010 (họ tên và năm sinh)',
      'Cb#9x!Tank$2026 (trên 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt)'
    ],
    correctIndex: 2,
    explanation: 'Mật khẩu mạnh cần dài từ 12 ký tự trở lên, kết hợp chữ in hoa, chữ thường, chữ số và ký tự đặc biệt, không liên quan đến thông tin cá nhân.',
    rewardType: 'SUPER_BULLET',
    rewardLabel: '⚡ ĐẠN DIỆT VIRUS (Nhân đôi sát thương trong 20s)',
  },
  {
    id: 'q3',
    topic: 'MALWARE',
    topicLabel: '🦠 Phòng chống Mã độc',
    question: 'Khi muốn tải một tựa game hoặc phần mềm mới về máy tính, cách làm nào là AN TOÀN NHẤT?',
    options: [
      'Tải bản "bẻ khóa" (Crack/Mod) miễn phí từ các trang web chia sẻ trôi nổi trên mạng',
      'Tải từ trang web chính thức của nhà phát hành hoặc kho ứng dụng uy tín',
      'Tải file đính kèm dạng file .exe hoặc .bat do người lạ gửi qua Discord'
    ],
    correctIndex: 1,
    explanation: 'Các bản tải crack lậu thường bị tin tặc cài sẵn mã độc Trojan, phần mềm gián điệp đánh cắp tài khoản ngân hàng và game.',
    rewardType: 'HEAL_BASE',
    rewardLabel: '🏥 KHẮC PHỤC SỰ CỐ (Hồi 20% máu căn cứ Server)',
  },
  {
    id: 'q4',
    topic: 'PRIVACY',
    topicLabel: '🔒 Bảo vệ Thông tin cá nhân',
    question: 'Một người tự xưng là "Nhân viên hỗ trợ kỹ thuật game" nhắn tin yêu cầu bạn cung cấp mã xác thực OTP gửi về điện thoại để nhận skin hiếm. Bạn nên làm gì?',
    options: [
      'Gửi mã OTP ngay vì họ là nhân viên chính thức',
      'Tuyệt đối không gửi mã OTP cho bất kỳ ai, kể cả nhân viên tự xưng',
      'Đọc mã OTP cho bạn thân nghe'
    ],
    correctIndex: 1,
    explanation: 'Mã OTP là chìa khóa bảo mật cuối cùng của tài khoản. Không một nhân viên hay quản trị viên chân chính nào yêu cầu người dùng đọc mã OTP.',
    rewardType: 'SHIELD',
    rewardLabel: '🛡️ KHIÊN TƯỜNG LỬA (Chặn 2 phát đạn)',
  },
  {
    id: 'q5',
    topic: 'NETWORK_SAFETY',
    topicLabel: '📶 An toàn Wi-Fi công cộng',
    question: 'Khi ngồi tại quán cà phê và kết nối Wi-Fi công cộng miễn phí không cần mật khẩu, hành động nào là NGUY HIỂM NHẤT?',
    options: [
      'Xem video học tập trên YouTube',
      'Đăng nhập tài khoản ngân hàng và thực hiện chuyển tiền giao dịch',
      'Đọc báo tin tức trực tuyến'
    ],
    correctIndex: 1,
    explanation: 'Wi-Fi công cộng không có mã hóa rất dễ bị tin tặc chặn bắt dữ liệu truyền đi (Man-in-the-Middle) để lấy cắp thông tin thẻ và mật khẩu.',
    rewardType: 'SUPER_BULLET',
    rewardLabel: '⚡ ĐẠN DIỆT VIRUS (Nhân đôi sát thương trong 20s)',
  },
  {
    id: 'q6',
    topic: 'MALWARE',
    topicLabel: '🚨 Mã độc tống tiền (Ransomware)',
    question: 'Mã độc tống tiền (Ransomware) là loại mã độc nguy hiểm như thế nào?',
    options: [
      'Làm màn hình máy tính đổi màu sắc sặc sỡ',
      'Mã hóa toàn bộ dữ liệu quan trọng trên máy và đòi tiền chuộc để giải mã',
      'Tự động xóa lịch sử duyệt web của bạn'
    ],
    correctIndex: 1,
    explanation: 'Ransomware khóa toàn bộ tài liệu học tập, ảnh và dữ liệu quan trọng của bạn rồi tống tiền. Luôn sao lưu dữ liệu ra ổ cứng ngoài để phòng tránh.',
    rewardType: 'HEAL_BASE',
    rewardLabel: '🏥 KHẮC PHỤC SỰ CỐ (Hồi 20% máu căn cứ Server)',
  },
  {
    id: 'q7',
    topic: 'PASSWORD',
    topicLabel: '🛡️ Xác thực 2 bước (2FA)',
    question: 'Tại sao chúng ta nên luôn bật tính năng Xác thực 2 yếu tố (2FA / Two-Factor Authentication)?',
    options: [
      'Để game tải về máy nhanh hơn gấp đôi',
      'Dù kẻ xấu có biết được mật khẩu thì vẫn không thể đăng nhập nếu không có bước xác nhận thứ 2',
      'Để không bao giờ phải nhập lại mật khẩu nữa'
    ],
    correctIndex: 1,
    explanation: '2FA tạo thêm một lớp bảo vệ vững chắc (như ứng dụng Authenticator hoặc thông báo xác nhận điện thoại) ngăn chặn 99% các vụ cướp tài khoản.',
    rewardType: 'SHIELD',
    rewardLabel: '🛡️ KHIÊN TƯỜNG LỬA (Chặn 2 phát đạn)',
  },
  {
    id: 'q8',
    topic: 'PHISHING',
    topicLabel: '🔗 Nhận diện Liên kết giả mạo',
    question: 'Đâu là địa chỉ trang web an toàn và chính xác của ngân hàng Vietcombank?',
    options: [
      'http://vietcombank-nhanqua.top/login.html',
      'https://www.vietcombank.com.vn/',
      'https://vietcombbank-khuyenmai88.com/'
    ],
    correctIndex: 1,
    explanation: 'Trang web an toàn có chứng chỉ bảo mật HTTPS (hình ổ khóa) và đúng tên miền chính thức của đơn vị, không có các từ ngữ khuyến mãi kỳ lạ.',
    rewardType: 'SUPER_BULLET',
    rewardLabel: '⚡ ĐẠN DIỆT VIRUS (Nhân đôi sát thương trong 20s)',
  },
];

export function getRandomQuestion(): CyberQuestion {
  const index = Math.floor(Math.random() * CYBER_QUESTIONS.length);
  return CYBER_QUESTIONS[index];
}

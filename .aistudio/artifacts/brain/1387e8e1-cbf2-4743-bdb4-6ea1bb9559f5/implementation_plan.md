# CyberTank - Battle City An Ninh Mạng (2 vs 2)

Dự án game xe tăng chiến thuật 4 người chơi trực tuyến trên 4 máy tính khác nhau, chia làm 2 phe bảo vệ căn cứ Server/Tường lửa của mình, kết hợp hỏi đáp tình huống an toàn thông tin để cường hóa vũ khí và phòng thủ.

## User Review & Critical Decisions

> [!IMPORTANT]
> Dựa trên phỏng vấn Bước A, các yêu cầu cốt lõi đã được xác định:
> - **Đối tượng**: Mọi lứa tuổi, tập trung vào học sinh tiếp cận kiến thức an ninh mạng trực quan.
> - **Chế độ chơi**: 4 người chia làm 2 phe (2 vs 2: Đội Xanh vs Đội Đỏ) trên các máy tính khác nhau qua Web (dùng chung mạng Internet hoặc LAN).
> - **Cơ chế giáo dục**: Bắn hòm tiếp tế xuất hiện trên bản đồ, trả lời nhanh câu hỏi an toàn mạng để nhận đạn đặc biệt hoặc phục hồi căn cứ.
> - **Tài khoản**: Không cần đăng nhập, nhập tên và mã PIN phòng là chơi ngay.
> - **Điều khiển**: Bàn phím máy tính (WASD hoặc Phím mũi tên để di chuyển, Phím Cách Space để bắn đạn).

## 1. Tổng quan & Ý tưởng cốt lõi

- **Mục tiêu**: Giúp người chơi vừa trải nghiệm cảm giác kịch tính của game bắn xe tăng huyền thoại Battle City, vừa rèn luyện phản xạ nhận diện nguy cơ mạng (lừa đảo trực tuyến, virus mã độc, bảo mật mật khẩu, an toàn dữ liệu).
- **Cơ chế 2 phe**:
  - Phe Xanh (Blue Defenders) và Phe Đỏ (Red CyberSec).
  - Mỗi bên có một Căn cứ chính (Main Server Firewall). Đội nào để máy chủ bị phá hủy trước sẽ thua.
  - Phá vỡ tường bảo mật để tiến công hoặc giải cứu máy chủ.
  - Hòm dữ liệu (Data Crate) rơi ngẫu nhiên: bắn vỡ sẽ mở câu hỏi an toàn thông tin. Trả lời đúng nhận buff (Tăng tốc độ, Khiên tường lửa, Đạn diệt Trojan).

## 2. Trải nghiệm người dùng & Giao diện hiện đại

```
┌────────────────────────────────────────────────────────┐
│               SẢNH CHỜ PHÒNG CHƠI (LOBBY)             │
│  Mã PIN: [ 8 4 9 2 ]             [Sao chép liên kết]   │
│                                                        │
│  [ PHE XANH (2/2) ]             [ PHE ĐỎ (2/2) ]       │
│  - Người chơi 1 (Host) [Sẵn sàng] - Người chơi 3 [Sẵn sàng]│
│  - Người chơi 2        [Sẵn sàng] - Người chơi 4 [Sẵn sàng]│
│                                                        │
│             [ BẮT ĐẦU TRẬN ĐẤU ]                       │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│              CHIẾN TRƯỜNG XE TĂNG (CANVAS 2D)          │
│  Tường Gạch | Tường Thép | Bụi Cây Dữ Liệu | Sông Mạng │
│                                                        │
│   [Server Xanh] 🛡️                🛡️ [Server Đỏ]      │
│     🚜 P1     🚜 P2                  🚜 P3     🚜 P4    │
│                                                        │
│             📦 [HÒM TIẾP TẾ BẢO MẬT]                   │
└────────────────────────────────────────────────────────┘
```

- **Phong cách thị giác**: Cyberpunk Neon hiện đại (nền tối `#0f172a`, viền sáng xanh cyan `#06b6d4`, tím dạ quang `#a855f7`, cam lửa `#f97316`).
- **Phản hồi tức thì**: Bắn đạn có vệt sáng, vụ nổ pixel mượt mà, thông báo câu hỏi xuất hiện nổi bật không che khuất hoàn toàn tầm nhìn.

## 3. Kiến trúc kỹ thuật & Dữ liệu

```
[Máy Khách 1 (P1)] ──┐
[Máy Khách 2 (P2)] ──┼──> WebSocket Server (Node.js) ──> Đồng bộ tọa độ xe,
[Máy Khách 3 (P3)] ──┤    (Server-Authoritative)          đạn, máu căn cứ,
[Máy Khách 4 (P4)] ──┘                                    hòm câu hỏi
```

- **Đồng bộ thời gian thực**: WebSocket đảm bảo độ trễ thấp giữa các máy tính khác nhau.
- **Xử lý va chạm**: Bản đồ lưới (Grid Map) chuẩn Battle City với các ô: Tường bảo mật (gạch), Tường lửa cứng (thép), Dòng dữ liệu (sông), Vùng ẩn danh (bụi cây).
- **Bộ ngân hàng câu hỏi**: Đa dạng các câu hỏi tình huống thực tế (phishing qua email/SMS, mật khẩu mạnh 2FA, virus mã hóa ransomware, kết nối Wifi công cộng).

## 4. Kế hoạch các mốc triển khai (Milestones)

- **Mốc 1: Khung xương trò chơi & Điều khiển cục bộ** [✓ ĐÃ HOÀN THÀNH]
  - Tạo sảnh nhập tên, bàn cờ Canvas đồ họa xe tăng di chuyển mượt mà bằng WASD/Mũi tên, bắn đạn và va chạm với tường gạch.
- **Mốc 2: Hệ thống đa người chơi thời gian thực (Multiplayer)** [✓ ĐÃ HOÀN THÀNH]
  - Tích hợp máy chủ WebSocket, cơ chế tạo phòng bằng mã PIN 4 số, chia 2 phe Xanh - Đỏ (tối đa 4 người kết nối cùng lúc).
- **Mốc 3: Bản đồ Battle City & Căn cứ Server 2 phe** [✓ ĐÃ HOÀN THÀNH]
  - Dựng bản đồ chiến thuật hoàn chỉnh: 2 máy chủ căn cứ ở 2 đầu sân, hệ thống tường gạch phá hủy được, tường thép kiên cố.
- **Mốc 4: Hòm tiếp tế an ninh mạng & Cơ chế câu hỏi giáo dục** [✓ ĐÃ HOÀN THÀNH]
  - Máy chủ tự động sinh Hòm Tiếp Tế An Ninh Mạng định kỳ 18-25s trên ô trống bản đồ.
  - Khi xe tăng chạm vào hoặc bắn trúng hòm tiếp tế, mở giao diện CyberQuizModal chứa câu hỏi trắc nghiệm tình huống an toàn thông tin (Lừa đảo Phishing, Mật khẩu & 2FA, Mã độc Malware, Lộ lọt thông tin cá nhân).
  - Trả lời đúng: Nhận ngay buff đặc biệt (Khiên Tường Lửa chặn 2 phát đạn, Đạn Diệt Virus x2 sát thương trong 20s, hoặc Khắc phục sự cố hồi 20% máu căn cứ server) kèm hiệu ứng hào quang lấp lánh và đồng bộ tới toàn bộ người chơi.
  - Trả lời sai: Xe tăng bị dính mã độc Malware và tê liệt 3 giây kèm hiệu ứng glitch đỏ cảnh báo.
- **Mốc 5: Hoàn thiện luật thi đấu, âm thanh & Tinh chỉnh trải nghiệm** [✓ ĐÃ HOÀN THÀNH]
  - Tích hợp đồng hồ đếm ngược 180s (3 phút) trên HUD với cảnh báo nhấp nháy khi còn dưới 30s. Nếu hết giờ, đội bảo vệ máy chủ căn cứ an toàn hơn sẽ chiến thắng.
  - Hệ thống âm thanh Web Audio API hoàn chỉnh (tiếng bắn thường, bắn đạn siêu cấp X2, tiếng nổ, tiếng còi căn cứ bị tấn công, tiếng hòm tiếp tế xuất hiện, tiếng chuông trả lời đúng, tiếng còi mã độc tê liệt và nhạc khải hoàn chiến thắng).
  - Tích hợp nút bật / tắt âm thanh tiện lợi trên cả Sảnh Chờ và trong Trận Đấu.
  - Bảng tổng kết và vinh danh cuối trận (MatchEndSummary): Danh hiệu MVP "Hiệp Sĩ An Ninh Mạng Xuất Sắc", thống kê chi tiết từng người chơi (số câu an ninh trả lời đúng, sát thương, số gạch phá hủy, tổng điểm).
  - Nút "Chơi Lại Ván Mới" đưa toàn bộ người chơi trong phòng đồng bộ trở về Sảnh Chờ để đổi phe và sẵn sàng cho hiệp đấu tiếp theo.

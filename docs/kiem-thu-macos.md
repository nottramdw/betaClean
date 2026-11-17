# Kiểm thử trên máy Mac thật

Các mục dưới đây không tự động hoá được trên CI (cần phiên đồ hoạ, quyền hệ thống hoặc phần cứng thật). Mỗi mục ghi kết quả: Đạt / Lỗi (kèm ảnh chụp và mô tả).

Bản cài: tệp `.dmg` mới nhất trong GitHub Release hoặc artifact `betaclean-macOS` của workflow `build`.

## 1. Cài đặt và quyền

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 1.1 | Mở DMG, kéo betaClean vào Applications, mở ứng dụng | Ứng dụng mở được (bản chưa notarize: chuột phải → Mở) |
| 1.2 | Cấp Full Disk Access: System Settings → Privacy & Security → Full Disk Access → thêm betaClean, mở lại ứng dụng | Quét không còn báo thiếu quyền với `~/Library/Mail`, `~/Library/Safari` |

## 2. Quét virus

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 2.1 | Mở Quét virus khi có mạng | CSDL tự cập nhật, không báo lỗi |
| 2.2 | Tạo tệp mẫu EICAR trong `~/Downloads`, quét thư mục người dùng | Phát hiện tệp mẫu |
| 2.3 | Cách ly tệp mẫu, khôi phục, rồi xoá khỏi khu cách ly | Mỗi thao tác thành công, Lịch sử ghi đủ |
| 2.4 | Ngắt mạng, quét lại | Quét bằng CSDL đã có, không treo |

## 3. Dọn dẹp

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 3.1 | Tệp rác: quét, dọn mục an toàn | Tệp vào Thùng rác của Finder, khôi phục được bằng "Put Back" |
| 3.2 | Cắm USB hoặc ổ ngoài, chép một tệp lớn, dọn tệp đó từ màn hình Tệp lớn | Tệp vào Thùng rác của ổ đó; ổ vẫn gắn bình thường |
| 3.3 | Tạo bản clone: `cp -c tep-lon.bin ban-clone.bin` trong `~/Downloads`, quét Tệp trùng lặp | Không có nhóm cho cặp clone; nếu thêm bản chép thường thì nhóm hiện nhãn "Dùng chung dữ liệu" và dung lượng thu hồi chỉ bằng một bản |
| 3.4 | Tệp lâu không dùng: quét thư mục người dùng | Có kết quả, ngày dùng cuối hợp lý |

## 4. Bộ nhớ RAM

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 4.1 | Mở Bộ nhớ RAM | Tiến trình gộp theo ứng dụng (ví dụ Chrome và các tiến trình con thành một dòng) |
| 4.2 | Mở TextEdit, gõ chữ chưa lưu, bấm Đóng | TextEdit hỏi lưu, không mất dữ liệu |
| 4.3 | Bấm Buộc dừng một ứng dụng thường | Ứng dụng tắt ngay |
| 4.4 | Mở Calculator (ứng dụng trong `/System/Applications`), bấm Đóng | Calculator tắt bình thường |
| 4.5 | Tìm Finder, Dock, WindowServer trong danh sách | Hiện "Tiến trình hệ thống", không có nút dừng |

## 5. Hiệu năng

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 5.1 | Quét tổng quan toàn bộ | Ghi lại thời gian quét và dung lượng ổ |
| 5.2 | Quét virus toàn bộ thư mục người dùng | Ghi lại thời gian quét |

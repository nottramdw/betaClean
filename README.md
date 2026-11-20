# betaClean

Ứng dụng dọn dẹp ổ đĩa cho macOS và Windows, chạy hoàn toàn offline.

## Tính năng

- **Tổng quan**: quét thư mục người dùng và các ổ dữ liệu, gộp kết quả theo mức cần xem xét.
- **Tệp rác**: bộ nhớ đệm, tệp tạm, nhật ký theo danh mục vị trí rác của từng hệ điều hành.
- **Tệp lớn, tệp trùng lặp, tệp lâu không dùng**: nhận diện hard link và clone APFS để không tính dung lượng ảo.
- **Quét virus**: ClamAV đóng gói sẵn; Windows bổ sung Microsoft Defender. Khu cách ly cho phép khôi phục.
- **Bộ nhớ RAM**: theo dõi ứng dụng theo RAM và CPU, đóng hoặc buộc dừng; tiến trình hệ thống được bảo vệ.
- **Dọn dẹp an toàn**: mọi thao tác xoá cần xác nhận, tệp chuyển vào Thùng rác, vùng hệ thống bị chặn.

## Tải về

Bản cài Windows (`.exe`) và macOS (`.dmg`) có tại [Releases](https://github.com/nottramdw/betaClean/releases).

Bản macOS chưa notarize. Lần đầu mở, macOS sẽ chặn ứng dụng; vào **System Settings → Privacy & Security** và chọn **Open Anyway**, hoặc chạy:

```sh
xattr -dr com.apple.quarantine /Applications/betaClean.app
```

Để quét đầy đủ thư mục `~/Library`, cấp **Full Disk Access** cho betaClean.

## Build từ mã nguồn

Yêu cầu:

- Node.js 22+
- Rust stable (`rustup`)
- Windows: Microsoft C++ Build Tools, WebView2
- macOS: Xcode Command Line Tools

| Lệnh                                        | Mục đích                          |
| ------------------------------------------- | --------------------------------- |
| `npm install`                               | Cài phụ thuộc                     |
| `npm run fetch:clamav`                      | Tải ClamAV vào tài nguyên         |
| `npm run tauri dev`                         | Chạy chế độ phát triển            |
| `npm run tauri build`                       | Build bản cài                     |
| `npm run lint`                              | ESLint và Prettier                |
| `cargo clippy --all-targets -- -D warnings` | Lint Rust (trong `src-tauri`)     |
| `cargo test`                                | Kiểm thử Rust (trong `src-tauri`) |

## Cấu trúc

```text
src/                 Giao diện React + TypeScript
  app/               Khung ứng dụng, điều hướng
  features/<tên>/    Màn hình theo tính năng
  shared/            Thành phần và tiện ích dùng chung
src-tauri/           Lõi Rust (Tauri 2)
  src/features/<tên>/  commands.rs, service.rs, model.rs
  rules/             Danh mục vị trí rác, quy tắc phân tích
scripts/             Tải ClamAV khi build
docs/                Hướng dẫn kiểm thử thủ công
```

Mã nguồn tổ chức theo Package by Feature: mỗi tính năng có thư mục tương ứng ở `src/features/` và `src-tauri/src/features/`.

## Công nghệ

Tauri 2, Rust, React, TypeScript, Tailwind CSS, ClamAV, `czkawka_core`, `sysinfo`.

## Giấy phép

Mã nguồn betaClean phát hành theo [giấy phép MIT](LICENSE). ClamAV đóng gói kèm bản cài giữ giấy phép GPLv2 riêng.

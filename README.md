# betaClean

Ứng dụng dọn dẹp cho macOS và Windows, chạy offline: tệp rác, tệp lớn, tệp trùng, tệp lâu không dùng, tệp nghi nhiễm virus.

## Công nghệ

Tauri 2 (Rust), React, TypeScript, Tailwind CSS, ClamAV.

## Yêu cầu

- Node.js 22+
- Rust stable (`rustup`)
- Windows: Microsoft C++ Build Tools, WebView2
- macOS: Xcode Command Line Tools

## Lệnh

| Lệnh                                        | Mục đích                          |
| ------------------------------------------- | --------------------------------- |
| `npm install`                               | Cài phụ thuộc                     |
| `npm run tauri dev`                         | Chạy chế độ phát triển            |
| `npm run lint`                              | ESLint và Prettier                |
| `npm run build`                             | Build giao diện                   |
| `npm run tauri build`                       | Build bản cài                     |
| `cargo clippy --all-targets -- -D warnings` | Lint Rust (trong `src-tauri`)     |
| `cargo test`                                | Kiểm thử Rust (trong `src-tauri`) |

## Cấu trúc

Package by Feature. Mỗi tính năng có thư mục tương ứng ở `src/features/` (giao diện) và `src-tauri/src/features/` (lõi Rust: `commands.rs`, `service.rs`, `model.rs`).

## Tài liệu

- `docs/tien-do.md`: tiến độ
- `docs/quyet-dinh.md`: quyết định đã chốt
- `plans/`: kế hoạch triển khai

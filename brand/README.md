# Pantrio brand assets

Bỏ ảnh gốc / master vào đây trước khi copy sang Web & Mobile.

## Gợi ý tên file

| File | Mục đích |
|------|----------|
| `logo-full.png` / `.svg` | Logo đầy đủ (chữ + symbol) |
| `logo-mark.png` / `.svg` | Chỉ symbol / icon vuông |
| `logo-wordmark.png` / `.svg` | Chỉ chữ Pantrio |
| `splash.png` | Ảnh splash (nền + logo), tỉ lệ ~1080×1920 hoặc lớn hơn |
| `app-icon-1024.png` | Icon app 1024×1024 (iOS/Android) |

Sau khi thả file:

1. **Web** → copy bản dùng runtime vào `apps/web/public/brand/`
2. **Mobile** → copy vào `apps/mobile/assets/brand/` (logo / splash / icon)

Wire favicon, shell logo, Flutter assets / splash sẽ làm ở bước tiếp theo.

# Mobile brand assets

```
assets/brand/
  logo/     → logo-full.png, logo-mark.png
  splash/   → splash.png (hoặc splash-light.png / splash-dark.png)
  icon/     → app-icon-1024.png
```

Sau khi thêm ảnh, khai báo trong `pubspec.yaml` (bước sau):

```yaml
flutter:
  assets:
    - assets/brand/logo/
    - assets/brand/splash/
    - assets/brand/icon/
```

Splash native (flutter_native_splash) dùng file trong `splash/` khi cấu hình.

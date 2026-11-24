# Định dạng Template & Dự án (TEMPLATE_FORMAT) – v1.0 (Đã khóa sau Bước 3)

> **Trạng thái:** Đã khóa schema v1.0 cho Bản 1 sau khi hoàn thiện & review Prototype Bước 3. Mọi trường mới thêm về sau phải giữ tương thích ngược (optional fields).

## 1. Nguyên tắc tách lớp
Một dự án slideshow gồm 2 cấu hình độc lập:
1. `motionTemplate`: Quy định bố cục khung ảnh, chuyển động camera/ảnh, cách xử lý ảnh dọc và kiểu transition mặc định.
2. `filmLook`: Quy định màu sắc, LUT, độ hạt, halation, bloom, rung khung và viền phim.

## 2. Cấu trúc nháp `MotionTemplate` (JSON)
```json
{
  "id": "polaroid-memories",
  "name": "Polaroid Kỷ Niệm",
  "heavyLevel": "light",
  "defaultFps": 24,
  "portraitMode": "smart-pairing",
  "slideDefaults": {
    "durationSec": 2.5,
    "transitionId": "light-leak-wipe",
    "transitionDurationSec": 0.6,
    "motionPreset": "gentle-drift-z"
  },
  "camera": {
    "parallaxStrength": 0.35,
    "easing": "cubic-bezier(0.25, 0.1, 0.25, 1.0)"
  },
  "frameStyle": {
    "type": "polaroid",
    "borderColor": "#f4f1ea",
    "shadowBlur": 0.12
  }
}
```

## 3. Cấu trúc nháp `FilmLookPreset` (JSON)
```json
{
  "id": "super-8-family",
  "name": "Super 8 Gia Đình",
  "intensity": 0.85,
  "targetFpsFeel": 18,
  "color": {
    "lutId": "super8-warm",
    "customCubePath": null,
    "contrast": 1.08,
    "fade": 0.12,
    "saturation": 0.95
  },
  "optics": {
    "halation": 0.45,
    "bloom": 0.25,
    "softness": 0.15,
    "chromaticAberration": 0.12
  },
  "texture": {
    "grainAmount": 0.4,
    "grainSize": 1.6,
    "dustAmount": 0.2,
    "scratchAmount": 0.1,
    "gateWeave": 0.35,
    "flicker": 0.2
  },
  "gate": {
    "vignette": 0.4,
    "roundedCorners": 0.08,
    "sprocketHole": false
  }
}
```

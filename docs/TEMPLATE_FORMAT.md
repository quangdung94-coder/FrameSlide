# TEMPLATE_FORMAT – file dự án và phong cách

Mọi kiểu dưới đây có bản TypeScript + zod schema trong `src/shared/schema.ts`. Đơn vị thời gian là **giây** (số thực), engine đổi sang khung bằng `Math.round(sec * 30)`. Tọa độ là **chuẩn hóa 0..1** theo ảnh (gốc trên trái).

## 1. Dự án (`.fslide`)

```json
{
  "format": "frameslide-project",
  "version": 1,
  "name": "Cưới Thanh & Mai – B-roll 01",
  "output": { "durationSec": 15, "fixedDuration": true },
  "look": { "id": "super8", "strength": 0.7, "seed": 1234 },
  "styleId": "memory",
  "photos": [
    { "id": "p1", "path": "D:/Cuoi/IMG_0001.jpg", "hash": "sha1:…", "width": 6000, "height": 4000, "takenAt": "2026-10-02T09:12:00" }
  ],
  "slides": [
    {
      "id": "s1",
      "photoId": "p1",
      "durationSec": 3.2,
      "motion": { "type": "kenburns", "from": { "cx": 0.5, "cy": 0.5, "zoom": 1.0 }, "to": { "cx": 0.55, "cy": 0.45, "zoom": 1.15 }, "easing": "easeInOutSine" },
      "transition": { "id": "dreamy", "durationSec": 1.0, "params": {} },
      "texts": [
        { "text": "Thanh & Mai", "fontId": "playfair-display", "sizeRel": 0.07, "color": "#FFF8EC", "anchor": "bottom-left", "marginRel": 0.06, "animation": "fade-up", "startSec": 0.3, "endSec": 2.8 }
      ]
    }
  ]
}
```

Không có trường `output.width/height/fps` vì đó là hằng số (1920x1080, 30). Không có trường audio.

### Quy tắc

- `transition` của slide i là chuyển cảnh **từ slide i sang slide i+1**. Slide cuối không có transition (hoặc bị bỏ qua).
- Transition chồng lên cuối slide i và đầu slide i+1. Tổng độ dài = `Σ durationSec − Σ transition.durationSec`.
- `transition.durationSec` ≤ 0.5 × min(độ dài hai slide hai bên).
- `look.strength` trong [0.1, 1.0]. Schema từ chối < 0.1. Không có giá trị "none".
- `look.seed` số nguyên, đổi seed thì grain/bụi/rung khác đi nhưng vẫn tất định.

## 2. Chuyển động (`motion`)

```jsonc
// Ken Burns: khung nhìn là hình chữ nhật 16:9 nằm trong ảnh.
// cx, cy = tâm khung theo ảnh (0..1). zoom = 1 nghĩa là khung 16:9 lớn nhất vừa trong ảnh.
{ "type": "kenburns", "from": {"cx":0.5,"cy":0.5,"zoom":1.0}, "to": {"cx":0.5,"cy":0.5,"zoom":1.2}, "easing": "easeInOutSine" }

// Camera 2.5D: ảnh là mặt phẳng trong không gian 3D, camera phối cảnh di chuyển.
{ "type": "camera25d", "preset": "dolly-in" | "dolly-out" | "pan-left" | "pan-right" | "tilt", "intensity": 0.5, "easing": "easeInOutCubic" }
```

Engine phải **kẹp (clamp)** tâm và zoom để khung không bao giờ ra ngoài ảnh (không lộ viền đen), kể cả với ảnh dọc. Easing hỗ trợ: `linear`, `easeInOutSine`, `easeInOutCubic`, `easeOutQuad`.

## 2b. Chia khung (`layout`)

Slide mặc định một ảnh (`photoId` + `motion`). Slide chia khung dùng `layout` + `cells` thay cho `photoId`/`motion`:

```json
{
  "id": "s4",
  "durationSec": 3.5,
  "layout": { "type": "split2v", "gapPx": 8, "gapColor": "#000000" },
  "cells": [
    { "photoId": "p7", "motion": { "type": "kenburns", "from": {"cx":0.5,"cy":0.5,"zoom":1.0}, "to": {"cx":0.5,"cy":0.45,"zoom":1.12}, "easing": "easeInOutSine" }, "delaySec": 0 },
    { "photoId": "p8", "motion": { "type": "kenburns", "from": {"cx":0.5,"cy":0.5,"zoom":1.12}, "to": {"cx":0.5,"cy":0.5,"zoom":1.0}, "easing": "easeInOutSine" }, "delaySec": 0.2 }
  ],
  "transition": { "id": "fade", "durationSec": 1.0 }
}
```

- `layout.type`: `single` (mặc định), `split2v` (2 ô trái/phải), `split2h` (2 ô trên/dưới), `grid4` (2x2). Số `cells` phải khớp: 1, 2, 2, 4.
- Tỉ lệ khung Ken Burns của mỗi ô bằng tỉ lệ của ô (ví dụ `split2v` là 960x1080 trừ khe), không phải 16:9. Clamp không lộ viền vẫn áp dụng trong từng ô.
- `delaySec` (0–1s): ô hiện ra muộn hơn bằng fade nhanh 0.3s, tạo cảm giác lệch nhịp. Mặc định 0.
- `gapPx` tính theo khung 1920x1080, 0–40. Chữ (`texts`) vẽ trên toàn khung, không theo ô.
- Transition giữa slide chia khung và slide khác vẫn chạy trên toàn khung như bình thường.

## 3. Giải độ dài cố định

Khi `output.fixedDuration = true`: cho trước tổng D và danh sách slide, tìm độ dài mỗi slide sao cho tổng = D (sai số ≤ 1 khung). Cách làm: giữ nguyên tỉ lệ giữa các slide, giữ transition theo phong cách, co giãn đều, mỗi slide ≥ 1.2 giây. Nếu không đủ chỗ thì bỏ bớt ảnh cuối (báo cho người dùng). Hàm thuần trong `engine/timeline.ts`, có test.

## 4. Phong cách (`styles/*.json`)

Phong cách là **công thức** để Quick Create dựng dự án, không phải bản ghi cứng từng slide.

```json
{
  "format": "frameslide-style",
  "version": 1,
  "id": "memory",
  "name": "Kỷ niệm",
  "description": "Chuyển động chậm, dissolve mềm, phim gia đình ấm.",
  "weight": "light",
  "look": { "id": "super8", "strength": 0.6 },
  "slideDurationSec": { "min": 2.5, "max": 3.5 },
  "transitions": [
    { "id": "fade", "weight": 3, "durationSec": 1.0 },
    { "id": "dreamy", "weight": 2, "durationSec": 1.2 },
    { "id": "fadecolor", "weight": 1, "durationSec": 0.8, "params": { "color": [1, 0.97, 0.9] } }
  ],
  "motions": [
    { "type": "kenburns", "zoomRange": [1.0, 1.15], "weight": 3 },
    { "type": "camera25d", "preset": "dolly-in", "intensity": 0.3, "weight": 1 }
  ],
  "layouts": [
    { "type": "single", "weight": 6 },
    { "type": "split2v", "weight": 2 },
    { "type": "grid4", "weight": 1 }
  ],
  "title": { "fontId": "playfair-display", "animation": "fade-up", "onFirstSlide": true }
}
```

- `layouts`: tỉ lệ chọn kiểu chia khung khi Quick Create. Ưu tiên ghép ảnh dọc vào `split2v`. Không đặt hai slide chia khung liền nhau.
- `weight` (light/medium/heavy) hiển thị cho người dùng biết độ nặng.
- Lựa chọn ngẫu nhiên trong phong cách dùng PRNG với seed của dự án, không lặp cùng transition hai lần liên tiếp.

## 5. Xuất hàng loạt (job)

```json
{
  "sourceFolder": "D:/Cuoi/Anh",
  "clips": 6,
  "durationSec": 15,
  "styleIds": ["memory", "film"],
  "styleMode": "same" ,
  "format": "prores422hq",
  "outputFolder": "D:/Cuoi/Broll",
  "namePattern": "{folder}_broll_{index:02}_{style}"
}
```

`styleMode`: `same` (mọi clip dùng styleIds[0]) hoặc `cycle` (luân phiên). Ảnh chia theo thứ tự ngày chụp, mỗi clip một nhóm liên tiếp. `format`: `mp4` | `prores422hq` | `dnxhrhq`.

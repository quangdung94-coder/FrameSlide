export const FULLSCREEN_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * Pass 1 (Linear RGBA16F):
 * - 4 Scene Layouts (0=Single, 1=Diptych 2-up, 2=Triptych 3-up, 3=Mosaic 4-up)
 * - Per-slot custom Focal Points, 90-deg Rotation & Exposure compensation
 * - 7 Motion Template Styles (0=Ken Burns, 1=2.5D Parallax, 2=Polaroid, 3=Filmstrip, 4=Mosaic, 5=3D Gallery, 6=3D Photo Wall)
 * - Motion Intensity (0..1.5), Per-Scene Motion Direction (0..6), Background & Border Styles
 * - 20 Editorial & 3D Perspective Transitions (codes 0..19)
 * - Deterministic Floating Bokeh / Dust Motes in Linear HDR space (feeds Pass 2 Bloom/Halation)
 */
export const SCENE_TRANSITION_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform sampler2D uTexA0;
  uniform sampler2D uTexA1;
  uniform sampler2D uTexA2;
  uniform sampler2D uTexA3;
  uniform vec2 uSizeA0;
  uniform vec2 uSizeA1;
  uniform vec2 uSizeA2;
  uniform vec2 uSizeA3;
  uniform vec2 uFocalA0;
  uniform vec2 uFocalA1;
  uniform vec2 uFocalA2;
  uniform vec2 uFocalA3;
  uniform float uRotA0;
  uniform float uRotA1;
  uniform float uRotA2;
  uniform float uRotA3;
  uniform float uExpA0;
  uniform float uExpA1;
  uniform float uExpA2;
  uniform float uExpA3;
  uniform int uLayoutA;
  uniform int uMotionDirA;

  uniform sampler2D uTexB0;
  uniform sampler2D uTexB1;
  uniform sampler2D uTexB2;
  uniform sampler2D uTexB3;
  uniform vec2 uSizeB0;
  uniform vec2 uSizeB1;
  uniform vec2 uSizeB2;
  uniform vec2 uSizeB3;
  uniform vec2 uFocalB0;
  uniform vec2 uFocalB1;
  uniform vec2 uFocalB2;
  uniform vec2 uFocalB3;
  uniform float uRotB0;
  uniform float uRotB1;
  uniform float uRotB2;
  uniform float uRotB3;
  uniform float uExpB0;
  uniform float uExpB1;
  uniform float uExpB2;
  uniform float uExpB3;
  // User transform per slot (move / scale / free rotation inside its frame):
  // xy = offset in frame units (y up), z = scale, w = rotation (radians).
  // Per-photo colour tweaks per slot: x = contrast, y = saturation, z = warmth, w = opacity.
  uniform vec4 uAdjA0;
  uniform vec4 uAdjA1;
  uniform vec4 uAdjA2;
  uniform vec4 uAdjA3;
  uniform vec4 uAdjB0;
  uniform vec4 uAdjB1;
  uniform vec4 uAdjB2;
  uniform vec4 uAdjB3;
  uniform vec4 uXfA0;
  uniform vec4 uXfA1;
  uniform vec4 uXfA2;
  uniform vec4 uXfA3;
  uniform vec4 uXfB0;
  uniform vec4 uXfB1;
  uniform vec4 uXfB2;
  uniform vec4 uXfB3;
  uniform int uLayoutB;
  uniform int uMotionDirB;

  uniform vec2 uResolution;
  uniform float uProgressA;
  uniform float uProgressB;
  uniform float uTransProgress;
  uniform int uTransType;      // 0..19
  uniform int uMotionStyle;    // 0..6 (scene A = current)
  uniform int uMotionStyleB;   // 0..6 (scene B = next; a scene may have its own template)
  uniform float uMotionIntensity; // 0..1.5
  // Background per scene (A = current, B = next): 0=blur, 1=black, 2=paper, 3=studio,
  // 4=solid, 5=gradient, 6=pattern. Colours are linear RGB.
  // Frame look per scene (A = current, B = next): x = corner, y = shadow, z = border, w = feather.
  uniform vec4 uCardStyleA;
  uniform vec4 uCardStyleB;
  // Staggered entry per scene: how far each card (x..w = card 0..3) has appeared, 0..1,
  // and the entry style: 0 = off, 1 = fade, 2 = slide up, 3 = zoom out.
  uniform vec4 uStaggerA;
  uniform vec4 uStaggerB;
  uniform int uStaggerStyleA;
  uniform int uStaggerStyleB;
  uniform int uBgStyleA;
  uniform int uBgStyleB;
  uniform vec3 uBgCol1A;
  uniform vec3 uBgCol2A;
  uniform vec3 uBgCol1B;
  uniform vec3 uBgCol2B;
  uniform float uBgAngleA;     // radians, CSS convention (0 = bottom→top, 90° = left→right)
  uniform float uBgAngleB;
  uniform int uBgPatternA;     // 0=dots, 1=stripes, 2=grid, 3=diamonds
  uniform int uBgPatternB;
  uniform int uBorderStyle;    // 0=auto, 1=none, 2=thin, 3=polaroid
  uniform int uPortraitMode;   // 0=matte-framed/smart-pairing, 1=safe-top-third
  uniform int uSlideIndexA;
  uniform int uSlideIndexB;
  uniform float uBokeh;        // 0..1
  uniform float uTimeSec;
  uniform int uBlurTaps;       // always 9; a uniform so the blur stays a real loop on D3D

  float easeInOutSine(float x) {
    return -(cos(3.14159265 * clamp(x, 0.0, 1.0)) - 1.0) * 0.5;
  }

  float easeOutCubic(float x) {
    float inv = 1.0 - clamp(x, 0.0, 1.0);
    return 1.0 - inv * inv * inv;
  }

  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  vec2 rotate2d(vec2 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  }

  // Rotates UV in 90-deg steps (quarterTurns = 0,1,2,3 clockwise)
  vec2 rotateUv90(vec2 uv, float quarterTurns) {
    int q = int(mod(floor(quarterTurns + 0.5), 4.0));
    if (q == 1) return vec2(1.0 - uv.y, uv.x);
    if (q == 2) return vec2(1.0 - uv.x, 1.0 - uv.y);
    if (q == 3) return vec2(uv.y, 1.0 - uv.x);
    return uv;
  }

  vec2 effectiveSize(vec2 sz, float quarterTurns) {
    int q = int(mod(floor(quarterTurns + 0.5), 4.0));
    return (q == 1 || q == 3) ? vec2(sz.y, sz.x) : sz;
  }

  // ---------------------------------------------------------------------------
  // Photo "slots": slot = scene * 4 + i  (scene 0 = A, scene 1 = B; i = 0..3).
  // Every photo is read through these helpers so the heavy scene/card code below
  // exists ONCE in the compiled shader and is driven by loops with dynamic
  // bounds. (Windows turns WebGL into HLSL and compiles it with D3D; that
  // compiler inlines every call site, and the old one-call-per-card layout took
  // ~15 s per compile on an RTX 3060, freezing the window on start-up.)
  // ---------------------------------------------------------------------------
  vec3 fetchSlot(int slot, vec2 uv) {
    // textureLod (no mipmaps anyway): no implicit derivatives, so the loops that
    // call this can stay real loops on Windows/D3D instead of being unrolled.
    if (slot == 0) return textureLod(uTexA0, uv, 0.0).rgb;
    if (slot == 1) return textureLod(uTexA1, uv, 0.0).rgb;
    if (slot == 2) return textureLod(uTexA2, uv, 0.0).rgb;
    if (slot == 3) return textureLod(uTexA3, uv, 0.0).rgb;
    if (slot == 4) return textureLod(uTexB0, uv, 0.0).rgb;
    if (slot == 5) return textureLod(uTexB1, uv, 0.0).rgb;
    if (slot == 6) return textureLod(uTexB2, uv, 0.0).rgb;
    return textureLod(uTexB3, uv, 0.0).rgb;
  }

  vec2 slotSize(int slot) {
    if (slot == 0) return uSizeA0;
    if (slot == 1) return uSizeA1;
    if (slot == 2) return uSizeA2;
    if (slot == 3) return uSizeA3;
    if (slot == 4) return uSizeB0;
    if (slot == 5) return uSizeB1;
    if (slot == 6) return uSizeB2;
    return uSizeB3;
  }

  vec2 slotFocal(int slot) {
    if (slot == 0) return uFocalA0;
    if (slot == 1) return uFocalA1;
    if (slot == 2) return uFocalA2;
    if (slot == 3) return uFocalA3;
    if (slot == 4) return uFocalB0;
    if (slot == 5) return uFocalB1;
    if (slot == 6) return uFocalB2;
    return uFocalB3;
  }

  float slotRot(int slot) {
    if (slot == 0) return uRotA0;
    if (slot == 1) return uRotA1;
    if (slot == 2) return uRotA2;
    if (slot == 3) return uRotA3;
    if (slot == 4) return uRotB0;
    if (slot == 5) return uRotB1;
    if (slot == 6) return uRotB2;
    return uRotB3;
  }

  float slotExp(int slot) {
    if (slot == 0) return uExpA0;
    if (slot == 1) return uExpA1;
    if (slot == 2) return uExpA2;
    if (slot == 3) return uExpA3;
    if (slot == 4) return uExpB0;
    if (slot == 5) return uExpB1;
    if (slot == 6) return uExpB2;
    return uExpB3;
  }

  vec4 slotAdj(int slot) {
    if (slot == 0) return uAdjA0;
    if (slot == 1) return uAdjA1;
    if (slot == 2) return uAdjA2;
    if (slot == 3) return uAdjA3;
    if (slot == 4) return uAdjB0;
    if (slot == 5) return uAdjB1;
    if (slot == 6) return uAdjB2;
    return uAdjB3;
  }

  vec4 slotXf(int slot) {
    if (slot == 0) return uXfA0;
    if (slot == 1) return uXfA1;
    if (slot == 2) return uXfA2;
    if (slot == 3) return uXfA3;
    if (slot == 4) return uXfB0;
    if (slot == 5) return uXfB1;
    if (slot == 6) return uXfB2;
    return uXfB3;
  }

  // Applies the user's move/scale/rotate to a 0..1 frame uv (inverse mapping:
  // where in the untransformed photo frame does this screen point come from).
  vec2 applyUserXf(int slot, vec2 uv, float boxAspect) {
    vec4 xf = slotXf(slot);
    vec2 p = (uv - 0.5 - xf.xy) * vec2(boxAspect, 1.0);
    float c = cos(-xf.w);
    float s = sin(-xf.w);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) / max(0.05, xf.z);
    return p / vec2(boxAspect, 1.0) + 0.5;
  }

  // 1 inside the photo, 0 outside (soft edge), for photos moved/shrunk/rotated by the user.
  float photoCoverage(vec2 imgUv, vec2 aaUv) {
    vec2 d = abs(imgUv - 0.5);
    vec2 m = smoothstep(vec2(0.5) + aaUv, vec2(0.5) - aaUv, d);
    return m.x * m.y;
  }

  vec3 samplePhotoSlot(int slot, vec2 uv) {
    vec2 ruv = rotateUv90(clamp(uv, 0.001, 0.999), slotRot(slot));
    vec3 c = fetchSlot(slot, clamp(ruv, 0.001, 0.999)) * slotExp(slot);
    vec4 adj = slotAdj(slot);
    // Per-photo grade in linear light: contrast around mid grey, saturation, warm/cool shift.
    c = max((c - 0.18) * adj.x + 0.18, vec3(0.0));
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(luma), c, adj.y);
    c *= vec3(1.0 + 0.14 * adj.z, 1.0, 1.0 - 0.14 * adj.z);
    return c;
  }

  vec2 applyKenBurns(vec2 uv, float progress, int slideIdx, int motionDir) {
    if (motionDir == 6 || uMotionIntensity <= 0.001) {
      return uv;
    }
    float t = easeInOutSine(progress);
    int variant = slideIdx - (slideIdx / 4) * 4;

    float scaleStart = 1.02;
    float scaleEnd = 1.14;
    vec2 panStart = vec2(-0.015, 0.008);
    vec2 panEnd = vec2(0.015, -0.008);

    if (motionDir == 1) {
      // Zoom In
      scaleStart = 1.00;
      scaleEnd = 1.16;
      panStart = vec2(0.0);
      panEnd = vec2(0.0);
    } else if (motionDir == 2) {
      // Zoom Out
      scaleStart = 1.16;
      scaleEnd = 1.00;
      panStart = vec2(0.0);
      panEnd = vec2(0.0);
    } else if (motionDir == 3) {
      // Pan Left
      scaleStart = 1.08;
      scaleEnd = 1.08;
      panStart = vec2(0.032, 0.0);
      panEnd = vec2(-0.032, 0.0);
    } else if (motionDir == 4) {
      // Pan Right
      scaleStart = 1.08;
      scaleEnd = 1.08;
      panStart = vec2(-0.032, 0.0);
      panEnd = vec2(0.032, 0.0);
    } else if (variant == 1) {
      scaleStart = 1.14;
      scaleEnd = 1.03;
      panStart = vec2(0.014, 0.010);
      panEnd = vec2(-0.014, -0.008);
    } else if (variant == 2) {
      scaleStart = 1.04;
      scaleEnd = 1.16;
      panStart = vec2(-0.020, -0.006);
      panEnd = vec2(0.020, 0.006);
    } else if (variant == 3) {
      scaleStart = 1.15;
      scaleEnd = 1.04;
      panStart = vec2(0.018, -0.010);
      panEnd = vec2(-0.018, 0.010);
    }

    float scale = 1.0 + (mix(scaleStart, scaleEnd, t) - 1.0) * uMotionIntensity;
    vec2 pan = mix(panStart, panEnd, t) * uMotionIntensity;
    return (uv - 0.5) / max(1.0, scale) + 0.5 + pan;
  }

  vec2 coverUvWithFocal(vec2 uv, float imgAspect, float boxAspect, vec2 focalUi) {
    vec2 res = uv;
    float anchorX = clamp(focalUi.x, 0.15, 0.85);
    float anchorY = clamp(1.0 - focalUi.y, 0.15, 0.85);

    if (imgAspect > boxAspect) {
      float scale = boxAspect / imgAspect;
      float halfSpan = scale * 0.5;
      float center = clamp(anchorX, halfSpan, 1.0 - halfSpan);
      res.x = (uv.x - 0.5) * scale + center;
    } else {
      float scale = imgAspect / boxAspect;
      float halfSpan = scale * 0.5;
      float center = clamp(anchorY, halfSpan, 1.0 - halfSpan);
      res.y = (uv.y - 0.5) * scale + center;
    }
    return res;
  }

  // 3x3 blur (centre 0.24, edges 0.12, corners 0.07) as one loop: one photo read
  // in the compiled shader instead of nine.
  vec3 sampleBlurredSlot(int slot, vec2 uv) {
    vec3 col = vec3(0.0);
    for (int k = 0; k < uBlurTaps; k++) {
      int kx = k - (k / 3) * 3 - 1;
      int ky = k / 3 - 1;
      int manhattan = (kx < 0 ? -kx : kx) + (ky < 0 ? -ky : ky);
      float w = manhattan == 0 ? 0.24 : (manhattan == 1 ? 0.12 : 0.07);
      col += samplePhotoSlot(slot, uv + vec2(float(kx), float(ky)) * 0.016) * w;
    }
    return col;
  }

  // Rounded-rectangle mask: frac 0..1 of the smaller half-extent; d is already abs().
  float roundedMaskAA(vec2 d, vec2 halfSize, float frac, float canvasAspect, vec2 aa) {
    vec2 p = d * vec2(canvasAspect, 1.0);
    vec2 h = halfSize * vec2(canvasAspect, 1.0);
    float r = frac * min(h.x, h.y);
    vec2 q = p - h + vec2(r);
    float dist = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
    float w = max(aa.y, 0.0005);
    return smoothstep(w, -w, dist);
  }

  float rectMaskAA(vec2 d, vec2 halfSize, vec2 aa) {
    vec2 edge = smoothstep(halfSize + aa, halfSize - aa, d);
    return edge.x * edge.y;
  }

  vec3 computeBackground(int scene, int slot0, vec2 screenUv, float easeP, float canvasAspect, bool parallax, bool filmstrip) {
    int bgStyle = scene == 0 ? uBgStyleA : uBgStyleB;
    vec3 c1 = scene == 0 ? uBgCol1A : uBgCol1B;
    vec3 c2 = scene == 0 ? uBgCol2A : uBgCol2B;
    if (bgStyle == 4) {
      return c1;
    }
    if (bgStyle == 5) {
      // Linear gradient matching CSS linear-gradient(<angle>deg, c1, c2)
      float ang = scene == 0 ? uBgAngleA : uBgAngleB;
      vec2 dir = vec2(sin(ang), cos(ang));
      vec2 p = (screenUv - 0.5) * vec2(canvasAspect, 1.0);
      float halfLen = 0.5 * (abs(canvasAspect * dir.x) + abs(dir.y));
      float t = clamp(dot(p, dir) / max(1e-4, 2.0 * halfLen) + 0.5, 0.0, 1.0);
      return mix(c1, c2, t);
    }
    if (bgStyle == 6) {
      // Static pattern (deterministic, no time input): c1 = base, c2 = ink
      int pat = scene == 0 ? uBgPatternA : uBgPatternB;
      float cells = 16.0;
      vec2 p = screenUv * vec2(canvasAspect, 1.0) * cells;
      float aaw = cells / max(1.0, uResolution.y) * 1.5;
      vec2 cell = fract(p) - 0.5;
      float m = 0.0;
      if (pat == 1) {
        float st = abs(fract((p.x + p.y) * 0.5) - 0.5);
        m = 1.0 - smoothstep(0.12, 0.12 + aaw, st);
      } else if (pat == 2) {
        vec2 e = 0.5 - abs(cell);
        m = 1.0 - smoothstep(0.035, 0.035 + aaw, min(e.x, e.y));
      } else if (pat == 3) {
        float d = abs(cell.x) + abs(cell.y);
        m = 1.0 - smoothstep(0.26, 0.26 + aaw, d);
      } else {
        m = 1.0 - smoothstep(0.2, 0.2 + aaw, length(cell));
      }
      return mix(c1, c2, m);
    }
    if (bgStyle == 1) {
      return vec3(0.008, 0.008, 0.010);
    }
    if (bgStyle == 2) {
      // Warm archival photo paper background
      float vig = 1.0 - length((screenUv - 0.5) * vec2(0.9, 1.0)) * 0.22;
      return vec3(0.76, 0.72, 0.65) * vig;
    }
    if (bgStyle == 3) {
      // Studio charcoal radial gradient
      float g = exp(-dot(screenUv - 0.5, screenUv - 0.5) * 3.2);
      return mix(vec3(0.025, 0.026, 0.032), vec3(0.085, 0.088, 0.10), g);
    }
    vec2 effSz = effectiveSize(slotSize(slot0), slotRot(slot0));
    float asp0 = effSz.x / max(1.0, effSz.y);
    vec2 bgPan = vec2(mix(-0.025, 0.025, easeP), 0.0) * (parallax ? 1.8 : 0.7) * uMotionIntensity;
    vec2 bgUv = coverUvWithFocal(screenUv + bgPan, asp0, canvasAspect, vec2(0.5, 0.5));
    return sampleBlurredSlot(slot0, (bgUv - 0.5) / 1.18 + 0.5) * (filmstrip ? 0.14 : 0.24);
  }

  // Draws one 2D or True-3D perspective photo card onto baseCol
  vec3 compositeCard(
    vec3 baseCol,
    int slot,
    vec2 screenUv,
    vec2 center,
    vec2 halfExt,
    float tiltRad,
    float yaw3d,
    float pitch3d,
    float zOffset,
    float kbScale,
    float canvasAspect,
    vec2 aa,
    bool defaultPolaroid,
    int motionStyle,
    vec4 cardStyle
  ) {
    // Resolve border style override
    bool isNone = (uBorderStyle == 1);
    bool isPolaroid = (uBorderStyle == 3) || (uBorderStyle == 0 && defaultPolaroid);

    vec2 localP;
    float lightShade = 1.0;

    if (abs(yaw3d) > 0.001 || abs(pitch3d) > 0.001 || abs(zOffset) > 0.001) {
      // True 3D perspective ray-plane intersection
      float camDist = 2.35;
      vec2 ndc = (screenUv - center) * vec2(canvasAspect, 1.0);
      vec3 ro = vec3(0.0, 0.0, camDist);
      vec3 rd = normalize(vec3(ndc.x, ndc.y, -1.65));

      // Plane normal rotated by yaw3d (Y axis) and pitch3d (X axis)
      float cy = cos(yaw3d), sy = sin(yaw3d);
      float cx = cos(pitch3d), sx = sin(pitch3d);
      vec3 right = vec3(cy, 0.0, -sy);
      vec3 up = vec3(sy * sx, cx, cy * sx);
      vec3 normal = normalize(cross(right, up));

      vec3 planeCenter = vec3(0.0, 0.0, zOffset);
      float denom = dot(rd, normal);
      if (abs(denom) < 0.0001) return baseCol;
      float tHit = dot(planeCenter - ro, normal) / denom;
      if (tHit <= 0.05) return baseCol;

      vec3 hit = ro + rd * tHit - planeCenter;
      vec2 p3d = vec2(dot(hit, right), dot(hit, up));
      if (abs(tiltRad) > 0.0001) {
        p3d = rotate2d(p3d, tiltRad);
      }
      localP = p3d / vec2(canvasAspect, 1.0);

      // Soft studio directional lighting & subtle glass sheen on tilted 3D card
      vec3 lightDir = normalize(vec3(-0.35, 0.45, 0.85));
      lightShade = mix(0.84, 1.08, clamp(dot(normal, lightDir) * 0.5 + 0.5, 0.0, 1.0));
    } else {
      vec2 rel = (screenUv - center) * vec2(canvasAspect, 1.0);
      if (abs(tiltRad) > 0.0001) {
        rel = rotate2d(rel, tiltRad);
      }
      localP = rel / vec2(canvasAspect, 1.0);
    }

    // Scene frame look: border width multiplier (a soft edge replaces the border).
    float softEdge = cardStyle.w;
    float padScale = softEdge > 0.01 ? 0.0 : cardStyle.z;
    vec2 aaM = aa + vec2(softEdge * 0.05 / canvasAspect, softEdge * 0.05);
    float padX = isNone ? 0.0 : (isPolaroid ? 0.016 / canvasAspect : 0.009 / canvasAspect) * padScale;
    float padTop = isNone ? 0.0 : (isPolaroid ? 0.018 : 0.009) * padScale;
    float padBot = isNone ? 0.0 : (isPolaroid ? 0.068 : 0.009) * padScale;

    vec2 cardCenterShift = vec2(0.0, (padTop - padBot) * 0.5);
    vec2 cardHalf = halfExt + vec2(padX, (padTop + padBot) * 0.5);

    vec2 dCard = abs(localP - cardCenterShift);
    float shadowDist = length(max(dCard - cardHalf, 0.0) * vec2(canvasAspect, 1.0));
    float shadow = exp(-shadowDist * (abs(yaw3d) > 0.01 ? 16.0 : 24.0)) * (abs(yaw3d) > 0.01 ? 0.62 : 0.52) * cardStyle.y;
    vec3 outCol = baseCol * (1.0 - shadow);

    bool rounded = cardStyle.x > 0.001;
    float outerMask = rounded
      ? roundedMaskAA(dCard, cardHalf, cardStyle.x, canvasAspect, aaM)
      : rectMaskAA(dCard, cardHalf, aaM);
    if (outerMask > 0.001) {
      vec2 dImg = abs(localP);
      float innerMask = isNone
        ? outerMask
        : (rounded
            ? roundedMaskAA(dImg, halfExt, cardStyle.x * 0.9, canvasAspect, aaM)
            : rectMaskAA(dImg, halfExt, aaM));

      vec2 boxUv = (localP + halfExt) / max(2.0 * halfExt, vec2(0.0001));
      float effKb = 1.0 + (kbScale - 1.0) * uMotionIntensity;
      boxUv = (boxUv - 0.5) / max(1.0, effKb) + 0.5;
      vec2 effSz = effectiveSize(slotSize(slot), slotRot(slot));
      float imgAspect = effSz.x / max(1.0, effSz.y);
      float boxAspect = (halfExt.x * canvasAspect) / max(0.0001, halfExt.y);
      vec2 xfUv = applyUserXf(slot, boxUv, boxAspect);
      vec2 sampleUv = coverUvWithFocal(xfUv, imgAspect, boxAspect, slotFocal(slot));
      vec3 photoCol = samplePhotoSlot(slot, sampleUv)
        * photoCoverage(xfUv, aa / max(2.0 * halfExt, vec2(0.0001)));

      vec3 borderCol = (motionStyle == 3 && uBorderStyle == 0)
        ? vec3(0.03, 0.03, 0.035)
        : vec3(0.86, 0.83, 0.78);

      vec3 cardCol = mix(borderCol, photoCol, innerMask) * lightShade;
      outCol = mix(outCol, cardCol, outerMask * slotAdj(slot).w);
    }

    return outCol;
  }

  // Renders one scene (0 = A, 1 = B) at screenUv. Cards of every layout go through
  // ONE compositeCard call inside a loop, so the D3D compiler sees it only once.
  vec3 sampleScene(int scene, vec2 screenUv) {
    int base = scene * 4;
    int layoutId = scene == 0 ? uLayoutA : uLayoutB;
    int motionDir = scene == 0 ? uMotionDirA : uMotionDirB;
    float progress = scene == 0 ? uProgressA : uProgressB;
    int slideIdx = scene == 0 ? uSlideIndexA : uSlideIndexB;

    float canvasAspect = uResolution.x / max(1.0, uResolution.y);
    vec2 aa = 1.25 / max(uResolution, vec2(1.0));
    float easeP = easeInOutSine(progress);
    int motionStyle = scene == 0 ? uMotionStyle : uMotionStyleB;
    bool polaroid = (motionStyle == 2);
    bool parallax = (motionStyle == 1);
    bool filmstrip = (motionStyle == 3);
    bool gallery3d = (motionStyle == 5);
    bool wall3d = (motionStyle == 6);
    bool forceTilt3d = (motionDir == 5);
    bool is3d = gallery3d || wall3d || forceTilt3d;

    float dirSign = ((slideIdx - (slideIdx / 2) * 2) == 0) ? 1.0 : -1.0;
    float baseYaw = is3d ? mix(-0.18, 0.18, easeP) * dirSign * uMotionIntensity : 0.0;
    float basePitch = is3d ? mix(0.06, -0.05, easeP) * uMotionIntensity : 0.0;

    bool multi = (layoutId == 1 || layoutId == 2 || layoutId == 3);

    // LAYOUT 0: SINGLE PHOTO
    vec2 effSz0 = effectiveSize(slotSize(base), slotRot(base));
    float asp0 = effSz0.x / max(1.0, effSz0.y);
    bool isPortrait = asp0 < 0.95;
    bool framedSingle = polaroid || parallax || is3d || (isPortrait && uPortraitMode == 0 && canvasAspect > 1.05);

    if (!multi && !framedSingle) {
      // Plain full-frame Ken Burns: no background, no card.
      vec2 kbUv = applyKenBurns(screenUv, progress, slideIdx, motionDir);
      vec2 xfUv = applyUserXf(base, kbUv, canvasAspect);
      vec2 uv = coverUvWithFocal(xfUv, asp0, canvasAspect, slotFocal(base));
      return samplePhotoSlot(base, uv) * photoCoverage(xfUv, aa) * slotAdj(base).w;
    }

    vec3 col = computeBackground(scene, base, screenUv, easeP, canvasAspect, parallax || is3d, filmstrip);

    // Shared per-layout values (same numbers as the original per-layout code).
    int cardCount = 1;
    vec2 halfExt = vec2(0.5);
    float drift = 0.0;
    float gap = 0.0;
    float spacing = 0.0;
    vec2 fgDrift = vec2(0.0);

    if (layoutId == 1) {
      // DIPTYCH (2-up)
      cardCount = 2;
      drift = (parallax || is3d) ? mix(-0.018, 0.018, easeP) * uMotionIntensity : 0.0;
      float frameH = polaroid ? 0.72 : (is3d ? 0.76 : 0.80);
      float frameW = min(0.41, frameH * (canvasAspect < 1.0 ? 0.52 : 0.72) / canvasAspect);
      halfExt = vec2(frameW, frameH) * 0.5;
      gap = canvasAspect < 1.0 ? 0.022 : 0.032;
    } else if (layoutId == 2) {
      // TRIPTYCH (3-up Filmstrip / Gallery)
      cardCount = 3;
      drift = mix(-0.028, 0.028, easeP) * (filmstrip ? 1.6 : 0.8) * uMotionIntensity;
      float frameH = polaroid ? 0.64 : 0.72;
      halfExt = vec2(0.275, frameH) * 0.5;
      spacing = 0.305;
      if (filmstrip) {
        float barMask = smoothstep(0.42, 0.415, abs(screenUv.y - 0.5));
        col = mix(col, vec3(0.018, 0.018, 0.02), barMask * 0.92);
      }
    } else if (layoutId == 3) {
      // MOSAIC 4-UP (2x2 Grid / 3D Photo Wall)
      cardCount = 4;
      halfExt = vec2(0.215, 0.205);
      drift = mix(-0.012, 0.012, easeP) * uMotionIntensity;
    } else {
      // Framed single photo
      float frameH = polaroid ? 0.74 : (is3d ? 0.78 : (parallax ? 0.80 : 0.86));
      float targetAsp = isPortrait ? asp0 : min(asp0, 1.65);
      float frameW = min(0.84, frameH * targetAsp / canvasAspect);
      halfExt = vec2(frameW, frameH) * 0.5;
      fgDrift = (parallax || is3d)
        ? vec2(mix(0.02, -0.02, easeP), mix(-0.008, 0.008, easeP)) * uMotionIntensity
        : vec2(0.0);
    }

    for (int c = 0; c < cardCount; c++) {
      vec2 center = vec2(0.5);
      float tilt = 0.0;
      float yaw = baseYaw;
      float pitch = basePitch;
      float z = 0.0;
      float kb = 1.0;
      bool cardPolaroid = polaroid;

      if (layoutId == 1) {
        float side = c == 0 ? -1.0 : 1.0;
        center = vec2(0.5 + side * (halfExt.x + gap) + drift, 0.5);
        tilt = polaroid ? (c == 0 ? -0.045 : 0.040) : 0.0;
        yaw = baseYaw - side * (is3d ? 0.11 : 0.0);
        z = c == 0 ? (wall3d ? 0.12 : (gallery3d ? 0.06 : 0.0))
                   : (wall3d ? -0.10 : (gallery3d ? -0.04 : 0.0));
        kb = c == 0 ? mix(1.0, 1.06, easeP) : mix(1.06, 1.0, easeP);
      } else if (layoutId == 2) {
        float side = float(c - 1); // -1, 0, +1
        center = vec2(0.5 + side * spacing + drift, 0.5);
        tilt = polaroid ? side * 0.035 : 0.0;
        yaw = baseYaw - side * (is3d ? 0.14 : 0.0);
        z = c == 1 ? (wall3d ? 0.14 : 0.0) : (wall3d ? -0.14 : 0.0);
        kb = c == 1 ? mix(1.05, 1.0, easeP) : mix(1.0, 1.05, easeP);
      } else if (layoutId == 3) {
        float gx = 0.232;
        float gy = 0.228;
        float sx = (c == 0 || c == 2) ? -1.0 : 1.0;  // left / right column
        float sy = (c < 2) ? 1.0 : -1.0;             // top / bottom row
        // Cards 0 and 3 drift right, 1 and 2 drift left.
        float dSign = (c == 0 || c == 3) ? 1.0 : -1.0;
        center = vec2(0.5 + sx * gx + dSign * drift, 0.5 + sy * gy);
        yaw = baseYaw - sx * (wall3d ? 0.08 : 0.0);
        pitch = sy * basePitch;
        bool outer = (c == 0 || c == 3);
        z = outer ? (wall3d ? 0.16 : 0.0) : (wall3d ? -0.10 : 0.0);
        kb = outer ? mix(1.0, 1.06, easeP) : mix(1.06, 1.0, easeP);
        cardPolaroid = false;
      } else {
        center = vec2(0.5) + fgDrift;
        tilt = polaroid ? (dirSign * -0.032) : 0.0;
        z = is3d ? mix(-0.08, 0.14, easeP) * uMotionIntensity : 0.0;
        kb = mix(1.0, 1.07, easeP);
      }

      // Staggered entry (2–4 photo scenes): the card fades in, optionally sliding up or zooming.
      int stStyle = scene == 0 ? uStaggerStyleA : uStaggerStyleB;
      float appear = 1.0;
      vec2 cardHalfExt = halfExt;
      if (stStyle > 0 && cardCount > 1) {
        vec4 st = scene == 0 ? uStaggerA : uStaggerB;
        appear = c == 0 ? st.x : (c == 1 ? st.y : (c == 2 ? st.z : st.w));
        if (appear <= 0.001) continue;
        if (stStyle == 2) center.y -= (1.0 - appear) * 0.08;
        if (stStyle == 3) cardHalfExt *= mix(0.82, 1.0, appear);
      }
      vec3 beforeCard = col;
      col = compositeCard(col, base + c, screenUv, center, cardHalfExt, tilt, yaw, pitch, z, kb, canvasAspect, aa, cardPolaroid, motionStyle, scene == 0 ? uCardStyleA : uCardStyleB);
      col = mix(beforeCard, col, appear);
    }
    return col;
  }

  vec3 computeLightLeak(vec2 uv, float p, bool burnMode) {
    float bell = pow(sin(clamp(p, 0.0, 1.0) * 3.14159265), burnMode ? 1.1 : 1.35);
    float sweepX = mix(-0.35, 1.35, p);
    float wave = sin(uv.y * (burnMode ? 7.5 : 4.5) + p * 3.0) * (burnMode ? 0.18 : 0.11);
    float band1 = exp(-pow((uv.x - sweepX + wave) * (burnMode ? 2.0 : 2.4), 2.0));
    float band2 = exp(-pow((uv.x - (sweepX - 0.22)) * 3.6 + wave * 0.7, 2.0));
    float edgeGlow = exp(-pow((uv.y - 0.25) * 1.6, 2.0)) * 0.65 + 0.35;

    vec3 warmAmber = burnMode ? vec3(2.4, 0.36, 0.04) : vec3(1.85, 0.68, 0.14);
    vec3 hotCore   = burnMode ? vec3(3.1, 1.35, 0.25) : vec3(2.40, 1.45, 0.65);
    return (warmAmber * band1 + hotCore * band2 * 0.85) * edgeGlow * bell * 1.15;
  }

  // Deterministic warm floating bokeh / dust motes in linear HDR space
  vec3 computeBokehOverlay(vec2 uv, float timeSec, float strength, float canvasAspect) {
    if (strength <= 0.001) return vec3(0.0);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 14; i++) {
      float fi = float(i) + 1.0;
      float rx = hash11(fi * 17.31);
      float ry = hash11(fi * 39.73);
      float spd = mix(0.018, 0.055, hash11(fi * 71.13));
      float radius = mix(0.016, 0.058, hash11(fi * 93.47));
      float px = fract(rx + timeSec * spd * 0.35 + sin(timeSec * 0.5 + fi) * 0.025);
      float py = fract(ry + timeSec * spd);
      vec2 d = (uv - vec2(px, py)) * vec2(canvasAspect, 1.0);
      float dist = length(d);
      float softDisc = smoothstep(radius, radius * 0.18, dist);
      float ring = smoothstep(radius * 0.92, radius * 0.70, dist) * (1.0 - smoothstep(radius * 0.68, radius * 0.45, dist));
      float pulse = 0.55 + 0.45 * sin(timeSec * 1.4 + fi * 2.3);
      vec3 tint = mix(vec3(1.55, 1.05, 0.55), vec3(1.85, 1.45, 0.95), hash11(fi * 51.7));
      acc += tint * (softDisc * 0.42 + ring * 0.28) * pulse;
    }
    return acc * strength * 0.45;
  }

  // Helper for 3D perspective plane projection of a fullscreen scene
  bool projectFullscreenPlane(vec2 uv, float angleY, float zShift, out vec2 outUv, out float shade) {
    float c = cos(angleY);
    float s = sin(angleY);
    float camZ = 2.2;
    vec3 ro = vec3(0.0, 0.0, camZ);
    vec3 rd = normalize(vec3((uv.x - 0.5) * 1.75, (uv.y - 0.5) * 1.75, -1.65));
    vec3 right = vec3(c, 0.0, -s);
    vec3 normal = vec3(s, 0.0, c);
    float denom = dot(rd, normal);
    if (abs(denom) < 0.001) return false;
    float tHit = dot(vec3(0.0, 0.0, zShift) - ro, normal) / denom;
    if (tHit <= 0.05) return false;
    vec3 hit = ro + rd * tHit - vec3(0.0, 0.0, zShift);
    vec2 p = vec2(dot(hit, right), hit.y) * 0.72 + 0.5;
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return false;
    outUv = p;
    shade = mix(0.45, 1.0, abs(c));
    return true;
  }

  // ---------------------------------------------------------------------------
  // Tap list: every transition only *describes* which scene samples it needs
  // (scene A or B, uv, weight) plus an additive colour. main() then evaluates all
  // taps in ONE loop, so sampleScene is inlined only once in the compiled shader.
  // Calling the scene sampler directly in each transition (~50 call sites) made the
  // Windows D3D shader compiler inline it ~50 times and freeze the app.
  // ---------------------------------------------------------------------------
  const int MAX_TAPS = 10;
  vec2 gTapUv[MAX_TAPS];
  float gTapW[MAX_TAPS];
  int gTapSrc[MAX_TAPS];
  int gTapCount = 0;

  void tapA(vec2 uv, float w) {
    if (gTapCount < MAX_TAPS) {
      gTapUv[gTapCount] = uv;
      gTapW[gTapCount] = w;
      gTapSrc[gTapCount] = 0;
      gTapCount++;
    }
  }

  void tapB(vec2 uv, float w) {
    if (gTapCount < MAX_TAPS) {
      gTapUv[gTapCount] = uv;
      gTapW[gTapCount] = w;
      gTapSrc[gTapCount] = 1;
      gTapCount++;
    }
  }

  void main() {
    float canvasAspect = uResolution.x / max(1.0, uResolution.y);
    vec3 addCol = vec3(0.0);
    gTapCount = 0;

    if (uTransProgress <= 0.0001) {
      tapA(vUv, 1.0);
    } else {
      float p = clamp(uTransProgress, 0.0, 1.0);
      float t = easeInOutSine(p);
      float bell = sin(p * 3.14159265);

      if (uTransType == 0) {
        tapA(vUv, 1.0 - t);
        tapB(vUv, t);
      } else if (uTransType == 1) {
        tapA(vUv, 1.0 - t);
        tapB(vUv, t);
        addCol = computeLightLeak(vUv, p, false);
      } else if (uTransType == 2) {
        if (p < 0.5) tapA(vUv, 1.0 - p * 2.0);
        else tapB(vUv, (p - 0.5) * 2.0);
      } else if (uTransType == 3) {
        float w = pow(1.0 - abs(p * 2.0 - 1.0), 1.3);
        if (p < 0.5) tapA(vUv, 1.0 - w);
        else tapB(vUv, 1.0 - w);
        addCol = vec3(1.15) * w;
      } else if (uTransType == 4) {
        float r = bell * 0.012;
        float wA = (1.0 - t) * 0.2;
        float wB = t * 0.2;
        tapA(vUv, wA);
        tapA(vUv + vec2(r, 0.0), wA);
        tapA(vUv - vec2(r, 0.0), wA);
        tapA(vUv + vec2(0.0, r), wA);
        tapA(vUv - vec2(0.0, r), wA);
        tapB(vUv, wB);
        tapB(vUv + vec2(r, 0.0), wB);
        tapB(vUv - vec2(r, 0.0), wB);
        tapB(vUv + vec2(0.0, r), wB);
        tapB(vUv - vec2(0.0, r), wB);
      } else if (uTransType == 5) {
        float g = 1.0 + bell * 1.15;
        tapA(vUv, (1.0 - t) * g);
        tapB(vUv, t * g);
      } else if (uTransType == 6) {
        float m = smoothstep(0.25, 0.75, p);
        tapA(vUv, 1.0 - m);
        tapB(vUv, m);
        addCol = computeLightLeak(vUv, p, true);
      } else if (uTransType == 7) {
        if (p < 0.5) tapA(vUv, 1.0);
        else tapB(vUv, 1.0);
        addCol = vec3(1.9, 1.75, 1.45) * pow(bell, 2.2);
      } else if (uTransType == 8) {
        float x = vUv.x + t;
        float seam = abs(x - 1.0);
        if (seam < 0.018) {
          addCol = vec3(0.01);
        } else if (x < 1.0) {
          tapA(vec2(x, vUv.y), 1.0);
        } else {
          tapB(vec2(x - 1.0, vUv.y), 1.0);
        }
      } else if (uTransType == 9) {
        tapA((vUv - 0.5) / (1.0 + t * 0.75) + 0.5, 1.0 - t);
        tapB((vUv - 0.5) / mix(0.65, 1.0, easeOutCubic(p)) + 0.5, t);
      } else if (uTransType == 10) {
        tapA((vUv - 0.5) / mix(1.0, 0.65, t) + 0.5, 1.0 - t);
        tapB((vUv - 0.5) / mix(1.65, 1.0, easeOutCubic(p)) + 0.5, t);
      } else if (uTransType == 11 || uTransType == 12) {
        // 11: whip pan left, 12: whip pan right (3-tap motion blur)
        float baseX = uTransType == 11 ? vUv.x + t : vUv.x - t;
        float blur = bell * 0.022;
        bool onA = uTransType == 11 ? baseX < 1.0 : baseX >= 0.0;
        float bx = onA ? baseX : (uTransType == 11 ? baseX - 1.0 : baseX + 1.0);
        for (int k = -1; k <= 1; k++) {
          vec2 uvK = vec2(clamp(bx + float(k) * blur, 0.001, 0.999), vUv.y);
          if (onA) tapA(uvK, 1.0 / 3.0);
          else tapB(uvK, 1.0 / 3.0);
        }
      } else if (uTransType == 13) {
        vec2 shake = vec2(sin(p * 48.0), cos(p * 37.0)) * (bell * 0.028);
        if (p < 0.5) tapA(vUv + shake, 1.0);
        else tapB(vUv + shake, 1.0);
      } else if (uTransType == 14) {
        float edge = 1.0 - easeOutCubic(p);
        if (vUv.x >= edge) {
          tapB(vec2(vUv.x - edge, vUv.y), 1.0);
        } else {
          float sh = exp(-(edge - vUv.x) * 28.0) * 0.55;
          tapA(vUv, 1.0 - sh);
        }
      } else if (uTransType == 15) {
        float diag = (vUv.x * 0.78 + (1.0 - vUv.y) * 0.22);
        float fold = mix(1.05, -0.05, t);
        if (diag > fold) {
          float crease = exp(-(diag - fold) * 18.0) * 0.45;
          tapB(vUv, 1.0 - crease);
        } else {
          tapA(vUv, 1.0);
          addCol = vec3(exp(-(fold - diag) * 24.0) * 0.22);
        }
      } else if (uTransType == 16) {
        // 16: 3D Card Flip (180-deg perspective Y rotation)
        float angle = t * 3.14159265;
        vec2 pUv;
        float sh;
        if (t < 0.5) {
          if (projectFullscreenPlane(vUv, angle, -0.25 * bell, pUv, sh)) tapA(pUv, sh);
          else addCol = vec3(0.015, 0.015, 0.02);
        } else {
          if (projectFullscreenPlane(vUv, angle - 3.14159265, -0.25 * bell, pUv, sh)) tapB(pUv, sh);
          else addCol = vec3(0.015, 0.015, 0.02);
        }
      } else if (uTransType == 17) {
        // 17: 3D Cube Turn (perspective 90-deg cube face transition)
        float splitX = 1.0 - t;
        float persp = 0.24 * bell;
        if (vUv.x < splitX) {
          float nx = vUv.x / max(0.0001, splitX);
          float scaleY = mix(1.0 - persp * 0.65, 1.0 + persp * 0.35, nx);
          float ny = (vUv.y - 0.5) / scaleY + 0.5;
          if (ny >= 0.0 && ny <= 1.0) tapA(vec2(nx, ny), mix(0.55, 1.0, splitX));
          else addCol = vec3(0.012, 0.012, 0.016);
        } else {
          float nx = (vUv.x - splitX) / max(0.0001, 1.0 - splitX);
          float scaleY = mix(1.0 + persp * 0.35, 1.0 - persp * 0.65, nx);
          float ny = (vUv.y - 0.5) / scaleY + 0.5;
          if (ny >= 0.0 && ny <= 1.0) tapB(vec2(nx, ny), mix(0.55, 1.0, 1.0 - splitX));
          else addCol = vec3(0.012, 0.012, 0.016);
        }
      } else if (uTransType == 18) {
        // 18: 3D Dolly Fly-Through (camera pushes through tilted Scene A into emerging Scene B)
        float tiltA = t * 0.22;
        vec2 uvA = rotate2d(vUv - 0.5, tiltA * 0.25) / (1.0 + t * 1.15) + 0.5;
        vec2 uvB = rotate2d(vUv - 0.5, -(1.0 - t) * 0.06) / mix(0.58, 1.0, easeOutCubic(p)) + 0.5;
        tapA(uvA, 1.0 - smoothstep(0.35, 0.92, t));
        tapB(uvB, smoothstep(0.18, 0.85, t));
        addCol = vec3(0.35, 0.28, 0.22) * pow(bell, 2.0);
      } else {
        // 19: 3D Page Turn (perspective hinged page turn with cast shadow & spine sheen)
        float edge = 1.0 - t;
        float perspSkew = (vUv.y - 0.5) * 0.16 * bell;
        float curvedEdge = edge + perspSkew;
        if (vUv.x > curvedEdge) {
          float shadow = exp(-(vUv.x - curvedEdge) * 14.0) * 0.58 * bell;
          tapB(vUv, 1.0 - shadow);
        } else {
          float nx = vUv.x / max(0.001, curvedEdge);
          float archY = (vUv.y - 0.5) / (1.0 + 0.14 * bell * nx) + 0.5;
          float spineGlow = exp(-pow((1.0 - nx) * 6.0, 2.0)) * 0.28 * bell;
          float curlShade = mix(1.0, 0.78, nx * bell);
          tapA(vec2(nx, clamp(archY, 0.001, 0.999)), curlShade);
          addCol = vec3(spineGlow);
        }
      }
    }

    // Evaluate all taps in a single, non-unrolled loop (dynamic bound).
    vec3 outCol = addCol;
    // sampleScene appears ONCE here; the tap decides which scene (A/B) it reads.
    for (int i = 0; i < gTapCount; i++) {
      float w = gTapW[i];
      if (w <= 0.00001) continue;
      outCol += sampleScene(gTapSrc[i], gTapUv[i]) * w;
    }

    // Add deterministic Linear HDR Bokeh / Dust Motes (glows cleanly in Pass 2 Bloom/Halation)
    outCol += computeBokehOverlay(vUv, uTimeSec, uBokeh, canvasAspect);

    gl_FragColor = vec4(outCol, 1.0);
  }
`;

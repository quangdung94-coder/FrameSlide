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
  uniform int uLayoutB;
  uniform int uMotionDirB;

  uniform vec2 uResolution;
  uniform float uProgressA;
  uniform float uProgressB;
  uniform float uTransProgress;
  uniform int uTransType;      // 0..19
  uniform int uMotionStyle;    // 0..6
  uniform float uMotionIntensity; // 0..1.5
  uniform int uBgStyle;        // 0=blur, 1=black, 2=paper, 3=studio
  uniform int uBorderStyle;    // 0=auto, 1=none, 2=thin, 3=polaroid
  uniform int uPortraitMode;   // 0=matte-framed/smart-pairing, 1=safe-top-third
  uniform int uSlideIndexA;
  uniform int uSlideIndexB;
  uniform float uBokeh;        // 0..1
  uniform float uTimeSec;

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

  vec3 samplePhoto(sampler2D tex, vec2 uv, float rotQ, float expMult) {
    vec2 ruv = rotateUv90(clamp(uv, 0.001, 0.999), rotQ);
    // textureLod (no mipmaps anyway): no implicit derivatives, so the tap loop in main()
    // can stay a real loop on Windows/D3D instead of being force-unrolled.
    return textureLod(tex, clamp(ruv, 0.001, 0.999), 0.0).rgb * expMult;
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

  vec3 sampleBlurred(sampler2D tex, vec2 uv, float rotQ, float expMult) {
    vec2 o = vec2(0.016, 0.016);
    vec3 col = samplePhoto(tex, uv, rotQ, expMult) * 0.24;
    col += samplePhoto(tex, uv + vec2( o.x,  0.0), rotQ, expMult) * 0.12;
    col += samplePhoto(tex, uv + vec2(-o.x,  0.0), rotQ, expMult) * 0.12;
    col += samplePhoto(tex, uv + vec2( 0.0,  o.y), rotQ, expMult) * 0.12;
    col += samplePhoto(tex, uv + vec2( 0.0, -o.y), rotQ, expMult) * 0.12;
    col += samplePhoto(tex, uv + vec2( o.x,  o.y), rotQ, expMult) * 0.07;
    col += samplePhoto(tex, uv + vec2(-o.x,  o.y), rotQ, expMult) * 0.07;
    col += samplePhoto(tex, uv + vec2( o.x, -o.y), rotQ, expMult) * 0.07;
    col += samplePhoto(tex, uv + vec2(-o.x, -o.y), rotQ, expMult) * 0.07;
    return col;
  }

  float rectMaskAA(vec2 d, vec2 halfSize, vec2 aa) {
    vec2 edge = smoothstep(halfSize + aa, halfSize - aa, d);
    return edge.x * edge.y;
  }

  vec3 computeBackground(sampler2D t0, vec2 s0, float r0, float e0, vec2 screenUv, float easeP, float canvasAspect, bool parallax, bool filmstrip) {
    if (uBgStyle == 1) {
      return vec3(0.008, 0.008, 0.010);
    }
    if (uBgStyle == 2) {
      // Warm archival photo paper background
      float vig = 1.0 - length((screenUv - 0.5) * vec2(0.9, 1.0)) * 0.22;
      return vec3(0.76, 0.72, 0.65) * vig;
    }
    if (uBgStyle == 3) {
      // Studio charcoal radial gradient
      float g = exp(-dot(screenUv - 0.5, screenUv - 0.5) * 3.2);
      return mix(vec3(0.025, 0.026, 0.032), vec3(0.085, 0.088, 0.10), g);
    }
    vec2 effSz = effectiveSize(s0, r0);
    float asp0 = effSz.x / max(1.0, effSz.y);
    vec2 bgPan = vec2(mix(-0.025, 0.025, easeP), 0.0) * (parallax ? 1.8 : 0.7) * uMotionIntensity;
    vec2 bgUv = coverUvWithFocal(screenUv + bgPan, asp0, canvasAspect, vec2(0.5, 0.5));
    return sampleBlurred(t0, (bgUv - 0.5) / 1.18 + 0.5, r0, e0) * (filmstrip ? 0.14 : 0.24);
  }

  // Draws one 2D or True-3D perspective photo card onto baseCol
  vec3 compositeCard(
    vec3 baseCol,
    sampler2D tex,
    vec2 texSize,
    float rotQ,
    float expMult,
    vec2 focalUi,
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
    bool defaultPolaroid
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

    float padX = isNone ? 0.0 : (isPolaroid ? 0.016 / canvasAspect : 0.009 / canvasAspect);
    float padTop = isNone ? 0.0 : (isPolaroid ? 0.018 : 0.009);
    float padBot = isNone ? 0.0 : (isPolaroid ? 0.068 : 0.009);

    vec2 cardCenterShift = vec2(0.0, (padTop - padBot) * 0.5);
    vec2 cardHalf = halfExt + vec2(padX, (padTop + padBot) * 0.5);

    vec2 dCard = abs(localP - cardCenterShift);
    float shadowDist = length(max(dCard - cardHalf, 0.0) * vec2(canvasAspect, 1.0));
    float shadow = exp(-shadowDist * (abs(yaw3d) > 0.01 ? 16.0 : 24.0)) * (abs(yaw3d) > 0.01 ? 0.62 : 0.52);
    vec3 outCol = baseCol * (1.0 - shadow);

    float outerMask = rectMaskAA(dCard, cardHalf, aa);
    if (outerMask > 0.001) {
      vec2 dImg = abs(localP);
      float innerMask = isNone ? outerMask : rectMaskAA(dImg, halfExt, aa);

      vec2 boxUv = (localP + halfExt) / max(2.0 * halfExt, vec2(0.0001));
      float effKb = 1.0 + (kbScale - 1.0) * uMotionIntensity;
      boxUv = (boxUv - 0.5) / max(1.0, effKb) + 0.5;
      vec2 effSz = effectiveSize(texSize, rotQ);
      float imgAspect = effSz.x / max(1.0, effSz.y);
      float boxAspect = (halfExt.x * canvasAspect) / max(0.0001, halfExt.y);
      vec2 sampleUv = coverUvWithFocal(boxUv, imgAspect, boxAspect, focalUi);
      vec3 photoCol = samplePhoto(tex, sampleUv, rotQ, expMult);

      vec3 borderCol = (uMotionStyle == 3 && uBorderStyle == 0)
        ? vec3(0.03, 0.03, 0.035)
        : vec3(0.86, 0.83, 0.78);

      vec3 cardCol = mix(borderCol, photoCol, innerMask) * lightShade;
      outCol = mix(outCol, cardCol, outerMask);
    }

    return outCol;
  }

  vec3 sampleScene(
    sampler2D t0, sampler2D t1, sampler2D t2, sampler2D t3,
    vec2 s0, vec2 s1, vec2 s2, vec2 s3,
    vec2 f0, vec2 f1, vec2 f2, vec2 f3,
    float r0, float r1, float r2, float r3,
    float e0, float e1, float e2, float e3,
    int layoutId, int motionDir, vec2 screenUv, float progress, int slideIdx
  ) {
    float canvasAspect = uResolution.x / max(1.0, uResolution.y);
    vec2 aa = 1.25 / max(uResolution, vec2(1.0));
    float easeP = easeInOutSine(progress);
    bool polaroid = (uMotionStyle == 2);
    bool parallax = (uMotionStyle == 1);
    bool filmstrip = (uMotionStyle == 3);
    bool gallery3d = (uMotionStyle == 5);
    bool wall3d = (uMotionStyle == 6);
    bool forceTilt3d = (motionDir == 5);
    bool is3d = gallery3d || wall3d || forceTilt3d;

    float dirSign = ((slideIdx - (slideIdx / 2) * 2) == 0) ? 1.0 : -1.0;
    float baseYaw = is3d ? mix(-0.18, 0.18, easeP) * dirSign * uMotionIntensity : 0.0;
    float basePitch = is3d ? mix(0.06, -0.05, easeP) * uMotionIntensity : 0.0;

    vec3 bg = computeBackground(t0, s0, r0, e0, screenUv, easeP, canvasAspect, parallax || is3d, filmstrip);

    // LAYOUT 1: DIPTYCH (2-up)
    if (layoutId == 1) {
      float kb1 = mix(1.0, 1.06, easeP);
      float kb2 = mix(1.06, 1.0, easeP);
      float drift = (parallax || is3d) ? mix(-0.018, 0.018, easeP) * uMotionIntensity : 0.0;
      float frameH = polaroid ? 0.72 : (is3d ? 0.76 : 0.80);
      float frameW = min(0.41, frameH * (canvasAspect < 1.0 ? 0.52 : 0.72) / canvasAspect);
      vec2 halfExt = vec2(frameW, frameH) * 0.5;
      float gap = canvasAspect < 1.0 ? 0.022 : 0.032;

      float tiltL = polaroid ? -0.045 : 0.0;
      float tiltR = polaroid ?  0.040 : 0.0;
      float z1 = wall3d ? 0.12 : (gallery3d ? 0.06 : 0.0);
      float z2 = wall3d ? -0.10 : (gallery3d ? -0.04 : 0.0);

      vec3 col = bg;
      col = compositeCard(col, t0, s0, r0, e0, f0, screenUv, vec2(0.5 - halfExt.x - gap + drift, 0.5), halfExt, tiltL, baseYaw + (is3d ? 0.11 : 0.0), basePitch, z1, kb1, canvasAspect, aa, polaroid);
      col = compositeCard(col, t1, s1, r1, e1, f1, screenUv, vec2(0.5 + halfExt.x + gap + drift, 0.5), halfExt, tiltR, baseYaw - (is3d ? 0.11 : 0.0), basePitch, z2, kb2, canvasAspect, aa, polaroid);
      return col;
    }

    // LAYOUT 2: TRIPTYCH (3-up Filmstrip / Gallery)
    if (layoutId == 2) {
      float drift = mix(-0.028, 0.028, easeP) * (filmstrip ? 1.6 : 0.8) * uMotionIntensity;
      float frameH = polaroid ? 0.64 : 0.72;
      float frameW = 0.275;
      vec2 halfExt = vec2(frameW, frameH) * 0.5;
      float spacing = 0.305;

      vec3 col = bg;
      if (filmstrip) {
        float barMask = smoothstep(0.42, 0.415, abs(screenUv.y - 0.5));
        col = mix(col, vec3(0.018, 0.018, 0.02), barMask * 0.92);
      }

      float zSide = wall3d ? -0.14 : 0.0;
      float zMid = wall3d ? 0.14 : 0.0;
      col = compositeCard(col, t0, s0, r0, e0, f0, screenUv, vec2(0.5 - spacing + drift, 0.5), halfExt, polaroid ? -0.035 : 0.0, baseYaw + (is3d ? 0.14 : 0.0), basePitch, zSide, mix(1.0, 1.05, easeP), canvasAspect, aa, polaroid);
      col = compositeCard(col, t1, s1, r1, e1, f1, screenUv, vec2(0.5 + drift, 0.5), halfExt, 0.0, baseYaw, basePitch, zMid, mix(1.05, 1.0, easeP), canvasAspect, aa, polaroid);
      col = compositeCard(col, t2, s2, r2, e2, f2, screenUv, vec2(0.5 + spacing + drift, 0.5), halfExt, polaroid ? 0.035 : 0.0, baseYaw - (is3d ? 0.14 : 0.0), basePitch, zSide, mix(1.0, 1.05, easeP), canvasAspect, aa, polaroid);
      return col;
    }

    // LAYOUT 3: MOSAIC 4-UP (2x2 Grid / 3D Photo Wall)
    if (layoutId == 3) {
      vec2 halfExt = vec2(0.215, 0.205);
      float gx = 0.232;
      float gy = 0.228;
      float drift = mix(-0.012, 0.012, easeP) * uMotionIntensity;
      float zA = wall3d ? 0.16 : 0.0;
      float zB = wall3d ? -0.10 : 0.0;

      vec3 col = bg;
      col = compositeCard(col, t0, s0, r0, e0, f0, screenUv, vec2(0.5 - gx + drift, 0.5 + gy), halfExt, 0.0, baseYaw + (wall3d ? 0.08 : 0.0), basePitch, zA, mix(1.0, 1.06, easeP), canvasAspect, aa, false);
      col = compositeCard(col, t1, s1, r1, e1, f1, screenUv, vec2(0.5 + gx - drift, 0.5 + gy), halfExt, 0.0, baseYaw - (wall3d ? 0.08 : 0.0), basePitch, zB, mix(1.06, 1.0, easeP), canvasAspect, aa, false);
      col = compositeCard(col, t2, s2, r2, e2, f2, screenUv, vec2(0.5 - gx - drift, 0.5 - gy), halfExt, 0.0, baseYaw + (wall3d ? 0.08 : 0.0), -basePitch, zB, mix(1.06, 1.0, easeP), canvasAspect, aa, false);
      col = compositeCard(col, t3, s3, r3, e3, f3, screenUv, vec2(0.5 + gx + drift, 0.5 - gy), halfExt, 0.0, baseYaw - (wall3d ? 0.08 : 0.0), -basePitch, zA, mix(1.0, 1.06, easeP), canvasAspect, aa, false);
      return col;
    }

    // LAYOUT 0: SINGLE PHOTO
    vec2 effSz0 = effectiveSize(s0, r0);
    float asp0 = effSz0.x / max(1.0, effSz0.y);
    bool isPortrait = asp0 < 0.95;

    if (polaroid || parallax || is3d || (isPortrait && uPortraitMode == 0 && canvasAspect > 1.05)) {
      float kbScale = mix(1.0, 1.07, easeP);
      float frameH = polaroid ? 0.74 : (is3d ? 0.78 : (parallax ? 0.80 : 0.86));
      float targetAsp = isPortrait ? asp0 : min(asp0, 1.65);
      float frameW = min(0.84, frameH * targetAsp / canvasAspect);
      vec2 halfExt = vec2(frameW, frameH) * 0.5;
      float tilt = polaroid ? (dirSign * -0.032) : 0.0;
      vec2 fgDrift = (parallax || is3d)
        ? vec2(mix(0.02, -0.02, easeP), mix(-0.008, 0.008, easeP)) * uMotionIntensity
        : vec2(0.0);
      float zSingle = is3d ? mix(-0.08, 0.14, easeP) * uMotionIntensity : 0.0;

      return compositeCard(bg, t0, s0, r0, e0, f0, screenUv, vec2(0.5) + fgDrift, halfExt, tilt, baseYaw, basePitch, zSingle, kbScale, canvasAspect, aa, polaroid);
    }

    vec2 kbUv = applyKenBurns(screenUv, progress, slideIdx, motionDir);
    vec2 uv = coverUvWithFocal(kbUv, asp0, canvasAspect, f0);
    return samplePhoto(t0, uv, r0, e0);
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

  vec3 evalA(vec2 uv) {
    return sampleScene(
      uTexA0, uTexA1, uTexA2, uTexA3,
      uSizeA0, uSizeA1, uSizeA2, uSizeA3,
      uFocalA0, uFocalA1, uFocalA2, uFocalA3,
      uRotA0, uRotA1, uRotA2, uRotA3,
      uExpA0, uExpA1, uExpA2, uExpA3,
      uLayoutA, uMotionDirA, uv, uProgressA, uSlideIndexA
    );
  }

  vec3 evalB(vec2 uv) {
    return sampleScene(
      uTexB0, uTexB1, uTexB2, uTexB3,
      uSizeB0, uSizeB1, uSizeB2, uSizeB3,
      uFocalB0, uFocalB1, uFocalB2, uFocalB3,
      uRotB0, uRotB1, uRotB2, uRotB3,
      uExpB0, uExpB1, uExpB2, uExpB3,
      uLayoutB, uMotionDirB, uv, uProgressB, uSlideIndexB
    );
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
  // taps in ONE loop, so sampleScene is inlined only twice in the compiled shader.
  // Calling evalA/evalB directly in each transition (~50 call sites) made the
  // Windows D3D shader compiler inline sampleScene ~50 times and freeze the app.
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
    // (if/else, not ?: — HLSL evaluates both sides of a ternary.)
    for (int i = 0; i < gTapCount; i++) {
      float w = gTapW[i];
      if (w <= 0.00001) continue;
      if (gTapSrc[i] == 0) {
        outCol += evalA(gTapUv[i]) * w;
      } else {
        outCol += evalB(gTapUv[i]) * w;
      }
    }

    // Add deterministic Linear HDR Bokeh / Dust Motes (glows cleanly in Pass 2 Bloom/Halation)
    outCol += computeBokehOverlay(vUv, uTimeSec, uBokeh, canvasAspect);

    gl_FragColor = vec4(outCol, 1.0);
  }
`;

/**
 * Pass 3 (Linear RGBA16F -> sRGB 8-bit output):
 * Master Film Look Shader supporting all 12 Film Look Presets + Clean Mode:
 * - Deterministic Gate Weave & Flicker
 * - VHS Chroma Bleed & Scanlines
 * - Film Color Grade (Warm Shift, Contrast, Saturation, Sepia, Fade, Filmic Shoulder)
 * - Custom .cube 3D LUT trilinear lookup (with DOMAIN_MIN/MAX)
 * - Procedural Organic Film Grain, Film Dust & Vertical Scratches, Ambient Light Leak
 * - Vignette, Rounded Corners, Cinematic Aspect Mask (2.39:1 / 2.00:1 / 4:3) & Sprocket Holes
 * - Before/After & Split-Screen Comparison (Preview only)
 * - Vietnamese Text / Date Stamp Overlay with smooth Fade
 * - Video Fade In / Fade Out & Triangular 1-LSB Dithering
 */
export const SUPER8_LOOK_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform sampler2D uInputTex;
  uniform sampler2D uLutTex;
  uniform sampler2D uTextTex;
  uniform vec2 uResolution;
  uniform float uFrameIndex;
  uniform float uDitherFrame;
  uniform float uTimeSec;

  uniform float uEnabled;        // 0 or 1
  uniform float uIntensity;      // 0..1
  uniform float uGrain;          // 0..1
  uniform float uGrainSize;      // 0.8..2.5
  uniform float uGateWeave;      // 0..1
  uniform float uFlicker;        // 0..1
  uniform float uVignette;       // 0..1
  uniform float uRoundedCorners; // 0..0.15
  uniform float uWarmShift;      // -1..1
  uniform float uFade;           // 0..0.35
  uniform float uContrast;       // 0.7..1.45
  uniform float uSaturation;     // 0..1.5
  uniform float uSepia;          // 0..1
  uniform float uScanlines;      // 0..1
  uniform float uChromaBleed;    // 0..1
  uniform float uDustScratches;  // 0..1
  uniform float uAmbientLeak;    // 0..1
  uniform int uAspectMask;       // 0=none, 1=2.39:1, 2=2.00:1, 3=4:3
  uniform float uSprockets;      // 0 or 1

  uniform float uHasLut;         // 0 or 1
  uniform float uLutSize;        // 17, 33, 65
  uniform float uLutIntensity;   // 0..1
  uniform vec3 uLutDomainMin;
  uniform vec3 uLutDomainMax;
  uniform float uHasText;        // 0 or 1
  uniform float uTextAlpha;      // 0..1
  uniform vec2 uTextOffset;      // dragged position + slide-up, in uv units (y up)
  uniform float uVideoFade;      // 0..1
  uniform int uCompareMode;      // 0=normal, 1=before(clean), 2=split-screen

  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec3 linearToSRGB(vec3 lin) {
    vec3 clamped = max(lin, vec3(0.0));
    vec3 low = clamped * 12.92;
    vec3 high = 1.055 * pow(clamped, vec3(1.0 / 2.4)) - 0.055;
    return mix(low, high, step(vec3(0.0031308), clamped));
  }

  vec3 filmicCurve(vec3 x) {
    vec3 a = max(vec3(0.0), x);
    return (a * (2.51 * a + 0.03)) / (a * (2.43 * a + 0.59) + 0.14);
  }

  vec3 filmicToneMap(vec3 x) {
    float whiteScale = 1.0 / ((2.6 * (2.51 * 2.6 + 0.03)) / (2.6 * (2.43 * 2.6 + 0.59) + 0.14));
    vec3 mapped = filmicCurve(x) * whiteScale;
    return mix(clamp(x, 0.0, 1.0), clamp(mapped, 0.0, 1.0), 0.65);
  }

  vec3 applyCubeLut(vec3 srgb, float size) {
    vec3 span = max(uLutDomainMax - uLutDomainMin, vec3(0.0001));
    vec3 c = clamp((srgb - uLutDomainMin) / span, 0.0, 1.0);
    float maxIdx = size - 1.0;
    float bScaled = c.b * maxIdx;
    float b0 = floor(bScaled);
    float b1 = min(maxIdx, b0 + 1.0);
    float bFrac = bScaled - b0;

    float invW = 1.0 / (size * size);
    float invH = 1.0 / size;

    float u0 = (b0 * size + c.r * maxIdx + 0.5) * invW;
    float u1 = (b1 * size + c.r * maxIdx + 0.5) * invW;
    float v  = (c.g * maxIdx + 0.5) * invH;

    vec3 col0 = texture2D(uLutTex, vec2(u0, v)).rgb;
    vec3 col1 = texture2D(uLutTex, vec2(u1, v)).rgb;
    return mix(col0, col1, bFrac);
  }

  float roundedBoxSDF(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    bool showCleanOnly = (uCompareMode == 1) || (uCompareMode == 2 && vUv.x < 0.5);
    float eff = showCleanOnly ? 0.0 : (uEnabled * clamp(uIntensity, 0.0, 1.0));

    vec2 uv = vUv;
    if (eff > 0.001 && uGateWeave > 0.001) {
      float jx = (hash11(uFrameIndex * 1.37 + 11.7) - 0.5) * 0.0045 * uGateWeave * eff;
      float jy = (hash11(uFrameIndex * 2.91 + 53.3) - 0.5) * 0.0060 * uGateWeave * eff;
      float scale = 1.0 + 0.012 * uGateWeave * eff;
      uv = (uv - 0.5) / scale + 0.5 + vec2(jx, jy);
    }

    vec3 cleanLin = texture2D(uInputTex, clamp(uv, 0.001, 0.999)).rgb;
    vec3 cleanSrgb = clamp(linearToSRGB(cleanLin), 0.0, 1.0);
    vec3 finalCol = cleanSrgb;

    if (eff > 0.001) {
      vec2 fromCenter = uv - 0.5;
      vec2 caOffset = fromCenter * (0.0020 * eff) + vec2(uChromaBleed * 0.0055 * eff, 0.0);
      vec3 col;
      col.r = texture2D(uInputTex, clamp(uv + caOffset, 0.001, 0.999)).r;
      col.g = cleanLin.g;
      col.b = texture2D(uInputTex, clamp(uv - caOffset, 0.001, 0.999)).b;

      // Projector Flicker
      float flickerDelta = (hash11(uFrameIndex * 3.73 + 97.1) - 0.5) * 0.14 * uFlicker;
      col *= (1.0 + flickerDelta);

      // Warm / Cool Shift
      vec3 warmMult = uWarmShift >= 0.0
        ? mix(vec3(1.0), vec3(1.12, 1.01, 0.84), uWarmShift)
        : mix(vec3(1.0), vec3(0.88, 0.99, 1.12), -uWarmShift);
      col *= warmMult;

      // Subtle film shadow tint
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 shadowTint = vec3(0.006, 0.012, 0.014) * (1.0 - smoothstep(0.0, 0.35, luma));
      col += shadowTint;

      vec3 gradedSrgb = linearToSRGB(filmicToneMap(col));

      // Contrast
      gradedSrgb = (gradedSrgb - 0.5) * uContrast + 0.5;

      // Saturation (0 = B&W)
      float gray = dot(gradedSrgb, vec3(0.299, 0.587, 0.114));
      gradedSrgb = mix(vec3(gray), gradedSrgb, uSaturation);

      // Sepia vintage tone
      if (uSepia > 0.001) {
        vec3 sep = vec3(
          dot(gradedSrgb, vec3(0.393, 0.769, 0.189)),
          dot(gradedSrgb, vec3(0.349, 0.686, 0.168)),
          dot(gradedSrgb, vec3(0.272, 0.534, 0.131))
        );
        gradedSrgb = mix(gradedSrgb, sep, uSepia);
      }

      // Lifted faded blacks
      gradedSrgb = gradedSrgb * (1.0 - uFade) + vec3(uFade * 0.92, uFade * 0.88, uFade * 0.82);

      // VHS Scanlines
      if (uScanlines > 0.001) {
        float scan = 0.5 + 0.5 * sin(gl_FragCoord.y * 1.55);
        gradedSrgb *= 1.0 - (1.0 - scan) * uScanlines * 0.24;
      }

      // Procedural Organic Film Grain
      if (uGrain > 0.001) {
        vec2 grainCoord = floor(gl_FragCoord.xy / max(0.8, uGrainSize));
        float n1 = hash12(grainCoord + vec2(uFrameIndex * 13.7, uFrameIndex * 7.3));
        float n2 = hash12(grainCoord + vec2(uFrameIndex * 29.1 + 17.0, uFrameIndex * 5.9 + 3.0));
        float grainNoise = (n1 + n2 - 1.0);
        float lumaSrgb = dot(gradedSrgb, vec3(0.299, 0.587, 0.114));
        float grainWeight = mix(1.0, 0.35, smoothstep(0.55, 0.98, lumaSrgb));
        gradedSrgb += vec3(grainNoise * uGrain * 0.11 * grainWeight);
      }

      // Vintage Film Dust & Vertical Emulsion Scratches
      if (uDustScratches > 0.001) {
        // 2 intermittent vertical scratches
        float s1x = hash11(floor(uFrameIndex * 0.5) * 19.7 + 3.1);
        float s1Active = step(0.45, hash11(floor(uFrameIndex * 0.35) * 7.3));
        float scratch1 = exp(-pow((vUv.x - s1x) * 750.0, 2.0)) * s1Active;

        float s2x = hash11(floor(uFrameIndex * 0.25) * 41.3 + 9.7);
        float s2Active = step(0.62, hash11(floor(uFrameIndex * 0.2) * 13.9));
        float scratch2 = exp(-pow((vUv.x - s2x) * 900.0, 2.0)) * s2Active;

        // Occasional film dust specks
        vec2 speckCell = floor(vUv * vec2(48.0, 27.0));
        float speckSeed = hash12(speckCell + vec2(uFrameIndex * 1.31, uFrameIndex * 2.17));
        float speck = step(0.9965 - uDustScratches * 0.003, speckSeed);
        vec2 localSpeck = fract(vUv * vec2(48.0, 27.0)) - 0.5;
        float speckDot = smoothstep(0.24, 0.05, length(localSpeck)) * speck;

        gradedSrgb += vec3(0.42, 0.39, 0.34) * (scratch1 * 0.55 + scratch2 * 0.4 + speckDot * 0.65) * uDustScratches;
      }

      // Ambient continuous warm edge Light Leak
      if (uAmbientLeak > 0.001) {
        float drift = sin(uTimeSec * 0.45) * 0.18;
        float leftGlow = exp(-pow((vUv.x - (0.04 + drift * 0.35)) * 3.2, 2.0)) * (0.55 + 0.45 * sin(vUv.y * 2.6 + uTimeSec * 0.7));
        float cornerGlow = exp(-length(vUv - vec2(0.95, 0.88 + drift * 0.2)) * 2.8);
        vec3 leakCol = vec3(0.95, 0.42, 0.12) * leftGlow * 0.48 + vec3(1.0, 0.68, 0.28) * cornerGlow * 0.35;
        gradedSrgb += leakCol * uAmbientLeak * 0.65;
      }

      // Vignette
      float dist = length((vUv - 0.5) * vec2(1.18, 1.0));
      float vig = 1.0 - smoothstep(0.38, 0.92, dist) * (uVignette * 0.72);
      gradedSrgb *= vig;

      finalCol = mix(cleanSrgb, clamp(gradedSrgb, 0.0, 1.0), eff);
    }

    // Custom DaVinci Resolve .cube 3D LUT (bypassed on Clean side of Before/After)
    if (!showCleanOnly && uHasLut > 0.5 && uLutIntensity > 0.001 && uLutSize >= 2.0) {
      vec3 lutCol = applyCubeLut(finalCol, uLutSize);
      finalCol = mix(finalCol, lutCol, clamp(uLutIntensity, 0.0, 1.0));
    }

    // Film Gate Rounded Corners
    if (eff > 0.001 && uRoundedCorners > 0.001) {
      float aspect = uResolution.x / max(1.0, uResolution.y);
      vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
      vec2 halfBox = vec2(aspect * 0.492, 0.492);
      float sdf = roundedBoxSDF(p, halfBox, uRoundedCorners * eff);
      float gateMask = 1.0 - smoothstep(-0.004, 0.004, sdf);
      finalCol *= gateMask;
    }

    // Optional Film Projector Sprocket Holes on left/right margins
    if (eff > 0.001 && uSprockets > 0.5) {
      float edgeX = min(vUv.x, 1.0 - vUv.x);
      if (edgeX < 0.055) {
        finalCol *= 0.12;
        float cellY = fract(vUv.y * 6.0 + fract(uFrameIndex * 0.08));
        bool inHole = (edgeX > 0.015 && edgeX < 0.042 && cellY > 0.25 && cellY < 0.75);
        if (inHole) {
          finalCol = vec3(0.02, 0.02, 0.025);
        }
      }
    }

    // Cinematic Aspect Mask / Letterbox (2.39:1, 2.00:1, 4:3)
    if (uAspectMask > 0) {
      float canvasAspect = uResolution.x / max(1.0, uResolution.y);
      float targetAspect = uAspectMask == 1 ? 2.39 : (uAspectMask == 2 ? 2.00 : 1.3333);
      if (targetAspect > canvasAspect) {
        float barH = (1.0 - canvasAspect / targetAspect) * 0.5;
        if (vUv.y < barH || vUv.y > 1.0 - barH) finalCol = vec3(0.0);
      } else {
        float barW = (1.0 - targetAspect / canvasAspect) * 0.5;
        if (vUv.x < barW || vUv.x > 1.0 - barW) finalCol = vec3(0.0);
      }
    }

    // Vietnamese Text / Date Stamp Overlay with smooth Fade
    if (uHasText > 0.5 && uTextAlpha > 0.001) {
      vec2 tUv = vUv - uTextOffset;
      if (tUv.x >= 0.0 && tUv.x <= 1.0 && tUv.y >= 0.0 && tUv.y <= 1.0) {
        vec4 txt = texture2D(uTextTex, tUv);
        finalCol = mix(finalCol, txt.rgb, txt.a * uTextAlpha);
      }
    }

    // Split-Screen divider line in Compare Mode
    if (uCompareMode == 2 && abs(vUv.x - 0.5) < 0.0018) {
      finalCol = vec3(0.96, 0.72, 0.16);
    }

    // Video Fade In / Fade Out
    finalCol *= clamp(uVideoFade, 0.0, 1.0);

    // Triangular 1-LSB Dithering
    float rA = hash12(gl_FragCoord.xy + vec2(uDitherFrame * 1.13, 0.0));
    float rB = hash12(gl_FragCoord.xy + vec2(0.0, uDitherFrame * 2.17 + 19.3));
    float triDither = (rA + rB - 1.0) / 255.0;
    finalCol = clamp(finalCol + triDither, 0.0, 1.0);

    gl_FragColor = vec4(finalCol, 1.0);
  }
`;

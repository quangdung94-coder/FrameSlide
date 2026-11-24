/**
 * Pass 2 (Linear RGBA16F):
 * Optical Halation (red-orange emulsion scatter around bright highlights)
 * + Soft Bloom using a lightweight 13-tap dual-ring kernel.
 */
export const OPTICAL_PASS_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform sampler2D uInputTex;
  uniform vec2 uResolution;
  uniform float uHalation;  // 0..1
  uniform float uBloom;     // 0..1
  uniform float uEnabled;   // 0 or 1

  vec3 highlightExtract(vec3 c, float threshold) {
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float weight = smoothstep(threshold, threshold + 0.45, luma);
    return c * weight;
  }

  void main() {
    vec3 base = texture2D(uInputTex, vUv).rgb;
    if (uEnabled < 0.5 || (uHalation <= 0.001 && uBloom <= 0.001)) {
      gl_FragColor = vec4(base, 1.0);
      return;
    }

    vec2 texel = 1.0 / max(uResolution, vec2(1.0));
    // Two concentric rings for wide, organic optical scatter without banding
    vec2 r1 = texel * 6.5;
    vec2 r2 = texel * 16.0;

    vec3 hSum = highlightExtract(base, 0.55) * 0.16;
    vec3 bSum = highlightExtract(base, 0.45) * 0.16;

    // Inner ring (4 cardinal + 4 diagonal)
    vec2 offsets1[8];
    offsets1[0] = vec2( r1.x,  0.0);
    offsets1[1] = vec2(-r1.x,  0.0);
    offsets1[2] = vec2( 0.0,  r1.y);
    offsets1[3] = vec2( 0.0, -r1.y);
    offsets1[4] = vec2( r1.x,  r1.y) * 0.7071;
    offsets1[5] = vec2(-r1.x,  r1.y) * 0.7071;
    offsets1[6] = vec2( r1.x, -r1.y) * 0.7071;
    offsets1[7] = vec2(-r1.x, -r1.y) * 0.7071;

    for (int i = 0; i < 8; i++) {
      vec3 s = texture2D(uInputTex, clamp(vUv + offsets1[i], 0.001, 0.999)).rgb;
      hSum += highlightExtract(s, 0.55) * 0.065;
      bSum += highlightExtract(s, 0.45) * 0.065;
    }

    // Outer ring (4 wider samples)
    vec2 offsets2[4];
    offsets2[0] = vec2( r2.x,  r2.y) * 0.7071;
    offsets2[1] = vec2(-r2.x,  r2.y) * 0.7071;
    offsets2[2] = vec2( r2.x, -r2.y) * 0.7071;
    offsets2[3] = vec2(-r2.x, -r2.y) * 0.7071;

    for (int i = 0; i < 4; i++) {
      vec3 s = texture2D(uInputTex, clamp(vUv + offsets2[i], 0.001, 0.999)).rgb;
      hSum += highlightExtract(s, 0.58) * 0.08;
      bSum += highlightExtract(s, 0.48) * 0.08;
    }

    // Halation is strongly red-orange biased (film base reflection)
    vec3 halationTint = vec3(1.0, 0.24, 0.04);
    vec3 outCol = base + hSum * halationTint * (uHalation * 0.85) + bSum * (uBloom * 0.45);

    gl_FragColor = vec4(outCol, 1.0);
  }
`;

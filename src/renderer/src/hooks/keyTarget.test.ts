import { describe, expect, it } from 'vitest';
import { classifyKeyTarget } from './keyTarget';

describe('classifyKeyTarget', () => {
  it('treats the scrubber and other sliders as controls, not text fields', () => {
    expect(classifyKeyTarget({ tagName: 'INPUT', type: 'range' })).toBe('control');
    expect(classifyKeyTarget({ tagName: 'input', type: 'checkbox' })).toBe('control');
    expect(classifyKeyTarget({ tagName: 'SELECT' })).toBe('control');
    expect(classifyKeyTarget({ tagName: 'BUTTON' })).toBe('control');
  });

  it('keeps real text fields as typing targets', () => {
    expect(classifyKeyTarget({ tagName: 'INPUT', type: 'text' })).toBe('typing');
    expect(classifyKeyTarget({ tagName: 'INPUT', type: 'number' })).toBe('typing');
    expect(classifyKeyTarget({ tagName: 'INPUT' })).toBe('typing');
    expect(classifyKeyTarget({ tagName: 'TEXTAREA' })).toBe('typing');
    expect(classifyKeyTarget({ tagName: 'DIV', isContentEditable: true })).toBe('typing');
  });

  it('returns none for plain elements or no focus', () => {
    expect(classifyKeyTarget(null)).toBe('none');
    expect(classifyKeyTarget({ tagName: 'DIV' })).toBe('none');
    expect(classifyKeyTarget({ tagName: 'BODY' })).toBe('none');
  });
});

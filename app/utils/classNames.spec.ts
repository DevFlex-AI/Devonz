import { describe, expect, it } from 'vitest';
import { classNames } from './classNames';

describe('classNames', () => {
  describe('string inputs', () => {
    it('should return empty string for no arguments', () => {
      expect(classNames()).toBe('');
    });

    it('should return single class', () => {
      expect(classNames('foo')).toBe('foo');
    });

    it('should join multiple string classes', () => {
      expect(classNames('foo', 'bar')).toBe('foo bar');
    });

    it('should join three classes', () => {
      expect(classNames('foo', 'bar', 'baz')).toBe('foo bar baz');
    });

    it('should handle empty strings', () => {
      expect(classNames('foo', '', 'bar')).toBe('foo bar');
    });
  });

  describe('number inputs', () => {
    it('should convert numbers to strings', () => {
      expect(classNames(42)).toBe('42');
    });

    it('should handle zero', () => {
      expect(classNames(0)).toBe('0');
    });

    it('should mix numbers and strings', () => {
      expect(classNames('foo', 123, 'bar')).toBe('foo 123 bar');
    });
  });

  describe('falsy inputs', () => {
    it('should ignore null', () => {
      expect(classNames('foo', null, 'bar')).toBe('foo bar');
    });

    it('should ignore undefined', () => {
      expect(classNames('foo', undefined, 'bar')).toBe('foo bar');
    });

    it('should ignore false', () => {
      expect(classNames('foo', false, 'bar')).toBe('foo bar');
    });

    it('should ignore true (boolean)', () => {
      expect(classNames('foo', true, 'bar')).toBe('foo bar');
    });
  });

  describe('object inputs', () => {
    it('should include keys with truthy values', () => {
      expect(classNames({ foo: true })).toBe('foo');
    });

    it('should exclude keys with falsy values', () => {
      expect(classNames({ foo: false })).toBe('');
    });

    it('should handle mixed truthy and falsy values', () => {
      expect(classNames({ foo: true, bar: false, baz: true })).toBe('foo baz');
    });

    it('should handle object with string as truthy value', () => {
      expect(classNames({ foo: 'truthy' as unknown as boolean })).toBe('foo');
    });

    it('should combine objects and strings', () => {
      expect(classNames('base', { active: true, disabled: false })).toBe('base active');
    });
  });

  describe('array inputs', () => {
    it('should flatten arrays', () => {
      expect(classNames(['foo', 'bar'])).toBe('foo bar');
    });

    it('should handle nested arrays', () => {
      expect(classNames(['foo', ['bar', 'baz']])).toBe('foo bar baz');
    });

    it('should handle arrays with mixed types', () => {
      expect(classNames(['foo', { bar: true }, ['baz']])).toBe('foo bar baz');
    });

    it('should handle empty arrays', () => {
      expect(classNames('foo', [], 'bar')).toBe('foo bar');
    });
  });

  describe('complex combinations', () => {
    it('should handle real-world usage', () => {
      const isActive = true;
      const isDisabled = false;
      expect(classNames('btn', { 'btn-active': isActive, 'btn-disabled': isDisabled }, 'extra')).toBe(
        'btn btn-active extra',
      );
    });

    it('should handle conditional classes with ternary', () => {
      const variant = 'primary';
      expect(classNames('btn', variant === 'primary' && 'btn-primary')).toBe('btn btn-primary');
    });

    it('should handle all falsy values together', () => {
      expect(classNames(null, undefined, false, '', 0)).toBe('0');
    });
  });
});

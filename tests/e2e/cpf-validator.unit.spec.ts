import { test, expect } from '@playwright/test';
import { cleanCpf, formatCpf, isValidCpf, maskCpf } from '../../src/lib/cpfValidator';

test.describe('cpfValidator @unit', () => {
  test('cleanCpf remove máscara', () => {
    expect(cleanCpf('529.982.247-25')).toBe('52998224725');
  });

  test('isValidCpf aceita CPF válido', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
  });

  test('isValidCpf rejeita inválidos', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('12345678901')).toBe(false);
    expect(isValidCpf('')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });

  test('formatCpf e maskCpf', () => {
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(maskCpf('52998224725')).toBe('***.***.***-25');
  });
});

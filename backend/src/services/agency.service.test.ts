import { AgencyService } from './agency.service';

describe('AgencyService.sanitizeSlug', () => {
  it('convierte a lowercase', () => {
    expect(AgencyService.sanitizeSlug('RIMATUR')).toBe('rimatur');
  });

  it('reemplaza espacios con guiones', () => {
    expect(AgencyService.sanitizeSlug('Rimatur SA')).toBe('rimatur-sa');
  });

  it('elimina caracteres especiales', () => {
    expect(AgencyService.sanitizeSlug('Rimatur SA!')).toBe('rimatur-sa');
  });

  it('elimina guiones duplicados', () => {
    expect(AgencyService.sanitizeSlug('rimatur--sa')).toBe('rimatur-sa');
  });

  it('elimina guiones al inicio y fin', () => {
    expect(AgencyService.sanitizeSlug('-rimatur-')).toBe('rimatur');
  });

  it('maneja string con solo caracteres especiales', () => {
    expect(AgencyService.sanitizeSlug('!!!')).toBe('');
  });

  it('mantiene números', () => {
    expect(AgencyService.sanitizeSlug('agencia123')).toBe('agencia123');
  });
});

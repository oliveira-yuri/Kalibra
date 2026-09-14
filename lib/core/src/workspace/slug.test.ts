import { describe, it, expect } from 'vitest';
import { slugify, uniqueSlug } from './slug';

describe('slugify', () => {
  it('reproduz o comportamento atual da tela', () => {
    expect(slugify('Concurso SETEC Campinas')).toBe('concurso-setec-campinas');
  });

  it('remove acentos', () => {
    expect(slugify('Analista Técnico de Informática')).toBe('analista-tecnico-de-informatica');
    expect(slugify('Educação Física')).toBe('educacao-fisica');
  });

  it('colapsa separadores e apara as pontas', () => {
    expect(slugify('  Banco   do  Brasil — Escriturário  ')).toBe('banco-do-brasil-escriturario');
  });

  it('devolve string vazia quando não sobra nada', () => {
    expect(slugify('—  ')).toBe('');
    expect(slugify('')).toBe('');
  });
});

describe('uniqueSlug', () => {
  it('usa o slug direto quando está livre', () => {
    expect(uniqueSlug('Prova X', [])).toBe('prova-x');
  });

  it('sufixa quando já existe', () => {
    expect(uniqueSlug('Prova X', ['prova-x'])).toBe('prova-x-2');
  });

  it('incrementa até achar um livre', () => {
    expect(uniqueSlug('Prova X', ['prova-x', 'prova-x-2', 'prova-x-3'])).toBe('prova-x-4');
  });

  it('não colide quando o título não gera slug', () => {
    expect(uniqueSlug('—', [])).toBe('workspace');
    expect(uniqueSlug('—', ['workspace'])).toBe('workspace-2');
  });
});

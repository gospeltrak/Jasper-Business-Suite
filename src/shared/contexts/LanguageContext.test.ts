import { afterEach, describe, expect, it, vi } from 'vitest';
import { translateNode, translateString } from './LanguageContext';
import { SWAHILI_UI_TRANSLATIONS } from '../utils/swahiliUiTranslations';

afterEach(() => vi.unstubAllGlobals());

describe('complete Swahili UI phrases', () => {
  it('translates purchase details without English fragments', () => {
    expect(translateString('VIEW PURCHASE DETAILS', 'sw')).toBe('MAELEZO YA MANUNUZI');
    expect(translateString('Read-Only Purchase Record', 'sw')).toBe('Kumbukumbu ya manunuzi ya kusoma tu');
    expect(translateString('Full order delivered', 'sw')).toBe('Bidhaa zote zimewasilishwa');
  });
  it('covers every reviewed phrase with its full translation', () => {
    for (const [source, target] of Object.entries(SWAHILI_UI_TRANSLATIONS)) {
      expect(translateString(source, 'sw'), source).toBe(target);
    }
  });
  it('localizes dates and progress/error messages', () => {
    expect(translateString('Oct 17, 2026', 'sw')).toBe('Oktoba 17, 2026');
    expect(translateString('Saving…', 'sw')).toBe('Inahifadhi…');
    expect(translateString('Your role does not allow expense edits.', 'sw')).toBe('Jukumu lako halina ruhusa ya kuhariri matumizi.');
  });
  it('keeps surrounding whitespace and punctuation for adjacent React nodes', () => {
    expect(translateString('  Transfer funds: ', 'sw')).toBe('  Hamisha fedha: ');
    expect(translateString('s', 'sw')).toBe('');
  });
  it('preserves addresses and references even beside translated labels', () => {
    for (const value of ['https://shop.orvix.africa/sales', 'www.store.example.com', 'sales@business.com', 'PC-SALES-2026']) {
      expect(translateString(value, 'sw')).toBe(value);
    }
  });
  it('uses complete phrases before individual words and does not translate the result again', () => {
    const expected = 'Kumbukumbu ya manunuzi ya kusoma tu';
    for (let i = 0; i < 20; i++) expect(translateString('Read-Only Purchase Record', 'sw')).toBe(expected);
    expect(translateString(expected, 'sw')).toBe(expected);
    expect(translateString('Read-Only Purchase Record', 'en')).toBe('Read-Only Purchase Record');
  });
});

describe('translation leaves registered business data intact', () => {
  const element = (text: string, protect = false) => ({ nodeType: 1, tagName: 'SPAN', className: '',
    childNodes: [{ nodeType: 3, nodeValue: text }], getAttribute: (name: string) => name === 'translate' && protect ? 'no' : null,
    setAttribute: vi.fn() });
  const constants = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
  it('preserves product names, account names and reference codes', () => {
    vi.stubGlobal('Node', constants);
    for (const name of ['Viakal Limescale Spray', 'Ariel Power Gel 100', 'Main Store Account', 'PC-AMZECW0RP']) {
      const node = element(name, true);
      translateNode(node as unknown as Node, 'sw');
      expect(node.childNodes[0].nodeValue).toBe(name);
    }
  });
  it('restores English from the original text when language changes', () => {
    vi.stubGlobal('Node', constants);
    const node = element('View Purchase Details');
    translateNode(node as unknown as Node, 'sw');
    expect(node.childNodes[0].nodeValue).toBe('Maelezo ya manunuzi');
    translateNode(node as unknown as Node, 'en');
    expect(node.childNodes[0].nodeValue).toBe('View Purchase Details');
  });
});

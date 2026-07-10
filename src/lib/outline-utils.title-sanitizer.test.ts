import { describe, it, expect } from 'vitest';
import { stripMarkdownFromTitle } from './outline-utils';

describe('stripMarkdownFromTitle', () => {
  const cases: Array<[string, string]> = [
    ['**Key Findings**', 'Key Findings'],
    ['*emphasis*', 'emphasis'],
    ['__bold__', 'bold'],
    ['_under_', 'under'],
    ['# Heading', 'Heading'],
    ['### Deep heading', 'Deep heading'],
    ['> Quoted title', 'Quoted title'],
    ['- List item title', 'List item title'],
    ['1. Numbered title', 'Numbered title'],
    ['`code title`', 'code title'],
    ['**Unclosed bold title', 'Unclosed bold title'],
    ['~~struck~~', 'struck'],
    ['[Linked text](https://example.com)', 'Linked text'],
    ['  **  Spaced Bold  **  ', 'Spaced Bold'],
    ['## **Nested Bold Heading**', 'Nested Bold Heading'],
  ];

  it.each(cases)('%s -> %s', (input, expected) => {
    expect(stripMarkdownFromTitle(input)).toBe(expected);
  });

  it('preserves interior # like a language name', () => {
    expect(stripMarkdownFromTitle('C# basics')).toBe('C# basics');
  });

  it('leaves clean titles untouched', () => {
    expect(stripMarkdownFromTitle('Introduction to Biology')).toBe('Introduction to Biology');
  });

  it('handles empty input safely', () => {
    expect(stripMarkdownFromTitle('')).toBe('');
  });
});

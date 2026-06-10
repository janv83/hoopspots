import { describe, expect, it } from 'vitest';
import { commonsPageUrl, commonsThumbUrl, parseGeosearch } from '../api/commons';
import { formatArea } from '../api/nominatim';

describe('commons helpers', () => {
  it('builds thumb and page URLs from a File: tag', () => {
    expect(commonsThumbUrl('File:Court 1.jpg', 640)).toBe(
      'https://commons.wikimedia.org/wiki/Special:FilePath/Court%201.jpg?width=640',
    );
    expect(commonsPageUrl('File:Court 1.jpg')).toBe(
      'https://commons.wikimedia.org/wiki/File%3ACourt_1.jpg',
    );
  });

  it('picks the closest usable photo from a geosearch response', () => {
    const photo = parseGeosearch({
      query: {
        pages: {
          '2': {
            title: 'File:Map.svg',
            index: 0,
            imageinfo: [{ thumburl: 'https://t/svg', descriptionurl: 'https://p/svg' }],
          },
          '1': {
            title: 'File:Court.jpg',
            index: 1,
            imageinfo: [{ thumburl: 'https://t/jpg', descriptionurl: 'https://p/jpg' }],
          },
        },
      },
    });
    expect(photo).toEqual({ thumbUrl: 'https://t/jpg', pageUrl: 'https://p/jpg', nearby: true });
  });

  it('returns null for empty or malformed responses', () => {
    expect(parseGeosearch({})).toBeNull();
    expect(parseGeosearch({ query: { pages: {} } })).toBeNull();
    expect(parseGeosearch({ query: { pages: { '1': { title: 'File:NoInfo.jpg' } } } })).toBeNull();
  });
});

describe('formatArea', () => {
  it('joins the most specific parts', () => {
    expect(formatArea({ suburb: 'Lehen', city: 'Salzburg', country: 'Österreich' })).toBe(
      'Lehen, Salzburg, Österreich',
    );
  });

  it('falls back through place levels', () => {
    expect(formatArea({ village: 'Anif', country: 'Österreich' })).toBe('Anif, Österreich');
  });

  it('returns null when nothing is known', () => {
    expect(formatArea({})).toBeNull();
  });
});

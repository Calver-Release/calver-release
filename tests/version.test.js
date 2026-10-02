jest.mock('child_process', () => ({ execSync: jest.fn() }));

const { execSync } = require('child_process');
const fs = require('fs');
const { generateCalVerVersion } = require('../src/release-core');

describe.each(['YY.MM.PATCH', 'YY.MM.MINOR.PATCH', 'YYYY.MM.PATCH', 'YYYY.MM.MINOR.PATCH'])('%s calendar months', versionFormat => {
  const version = (month, patch = 1) => {
    const yearMonth = versionFormat.startsWith('YYYY') ? `20${month}` : month;
    return versionFormat.endsWith('MINOR.PATCH') ? `${yearMonth}.0.${patch}` : `${yearMonth}.${patch}`;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    execSync.mockReset();
  });

  test.each([
    ['September to October', 2026, 10, '26.9', ['26.9'], false, true, '26.10'],
    ['padded September to October', 2026, 10, '26.09', ['26.09'], true, true, '26.10'],
    ['October stays ahead of March', 2026, 3, '26.10', ['26.10'], false, true, '26.10', 8],
    ['year rollover', 2027, 1, '26.12', ['26.12'], false, true, '27.1'],
    ['same month with padded tags', 2026, 9, '26.9', ['26.09'], false, true, '26.9', 8],
    ['same month with unpadded tags', 2026, 9, '26.09', ['26.9'], true, true, '26.09', 8],
    ['January excludes October tags', 2026, 1, '26.1', ['26.10', '26.1'], false, true, '26.1', 8],
    ['manual October bump', 2026, 10, '26.10', ['26.9'], false, false, '26.10'],
    ['automatic October retry', 2026, 10, '26.9', ['26.10', '26.9'], false, true, '26.10', 8],
    ['automatic updates disabled', 2026, 10, '26.9', ['26.9'], false, false, '26.9', 8],
  ])('%s', (_, year, month, packageMonth, tagMonths, padMonth, autoUpdateMonth, expectedMonth, expectedPatch = 1) => {
    jest.setSystemTime(new Date(year, month - 1, 2, 12));
    fs.readFileSync.mockReturnValue(JSON.stringify({ version: version(packageMonth, 7) }));
    execSync.mockReturnValue(tagMonths.map(month => `v-${version(month, 7)}`).join('\n'));

    expect(generateCalVerVersion('patch', '.', { versionFormat, padMonth, autoUpdateMonth }))
      .toBe(version(expectedMonth, expectedPatch));
  });

  test('increments the highest patch across padded and unpadded tags', () => {
    fs.readFileSync.mockReturnValue(JSON.stringify({ version: version('26.9', 7) }));
    execSync.mockReturnValue(`v-${version('26.9', 7)}\nv-${version('26.09', 8)}`);

    expect(generateCalVerVersion('patch', '.', { versionFormat }))
      .toBe(version('26.9', 9));
  });
});

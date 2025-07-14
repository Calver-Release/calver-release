const calverRelease = require('../dist/src/index').default;
const { detectMonorepoConfig } = require('../dist/src/index');

// Mock environment variables for tests
process.env.GITHUB_TOKEN = 'test-token';
process.env.GITLAB_ACCESS_TOKEN = 'test-token';

describe('calver-release', () => {
  describe('main function', () => {
    test('should be a function', () => {
      expect(typeof calverRelease).toBe('function');
    });

    test('should return a promise', () => {
      const result = calverRelease({ dryRun: true });
      expect(result).toBeInstanceOf(Promise);
    });

    test('should handle dry run mode', async () => {
      const result = await calverRelease({ dryRun: true });
      expect(result).toHaveProperty('released');
    });
  });

  describe('detectMonorepoConfig', () => {
    test('should detect single package mode', () => {
      const config = detectMonorepoConfig();
      expect(config).toHaveProperty('type');
      expect(config.type).toBe('single'); // In this test environment
    });
  });

  describe('configuration', () => {
    test('should accept options', async () => {
      const options = {
        dryRun: true,
        debug: true,
        branches: ['main']
      };
      
      const result = await calverRelease(options);
      expect(result).toBeDefined();
    });
  });
});

// Mock process.exit for tests
const originalExit = process.exit;
beforeAll(() => {
  process.exit = jest.fn();
});

afterAll(() => {
  process.exit = originalExit;
});
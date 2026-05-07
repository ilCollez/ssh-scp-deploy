const {
    setInputs,
    clearActionEnv,
    restoreEnv,
    capture,
    fakeFetch,
    failingFetch,
} = require('./helpers.js');

const { input, log, isSilent, getLatestVersion, fail, API_URL, boolInput } = require('../../lib/utils.js');

describe('utils.input', () => {
    beforeEach(() => clearActionEnv());
    afterEach(() => restoreEnv());

    test('returns the input value when set', () => {
        setInputs({ foo: 'bar' });
        expect(input('foo')).toBe('bar');
    });

    test('returns undefined when input is empty string', () => {
        setInputs({ foo: '' });
        expect(input('foo')).toBeUndefined();
    });

    test('returns undefined when input is missing', () => {
        expect(input('missing')).toBeUndefined();
    });

    test('throws when required input is missing', () => {
        expect(() => input('missing', { required: true })).toThrow();
    });
});

describe('utils.boolInput', () => {
    beforeEach(() => clearActionEnv());
    afterEach(() => restoreEnv());

    test('returns the parsed value when valid', () => {
        setInputs({ flag: 'true' });
        expect(boolInput('flag')).toBe(true);
    });

    test('returns the default when input is missing', () => {
        expect(boolInput('absent', true)).toBe(true);
        expect(boolInput('absent', false)).toBe(false);
    });

    test('returns the default on invalid value', () => {
        setInputs({ flag: 'maybe' });
        expect(boolInput('flag', false)).toBe(false);
    });
});

describe('utils.isSilent', () => {
    beforeEach(() => clearActionEnv());
    afterEach(() => restoreEnv());

    test('returns false by default', () => {
        expect(isSilent()).toBe(false);
    });

    test('returns true when silent=true', () => {
        setInputs({ silent: 'true' });
        expect(isSilent()).toBe(true);
    });

    test('returns false when silent=false', () => {
        setInputs({ silent: 'false' });
        expect(isSilent()).toBe(false);
    });

    test('returns false on invalid value (does not throw)', () => {
        setInputs({ silent: 'maybe' });
        expect(isSilent()).toBe(false);
    });
});

describe('utils.log', () => {
    beforeEach(() => clearActionEnv());
    afterEach(() => restoreEnv());

    test('writes to stdout when not silent', async () => {
        const { stdout } = await capture(async () => log('hello'));
        expect(stdout).toMatch(/hello/);
    });

    test('does not write when silent', async () => {
        setInputs({ silent: 'true' });
        const { stdout } = await capture(async () => log('hello'));
        expect(stdout).toBe('');
    });
});

describe('utils.fail', () => {
    beforeEach(() => clearActionEnv());
    afterEach(() => restoreEnv());

    test('calls process.exit with code 1', async () => {
        const { exitCode } = await capture(async () => fail('boom'));
        expect(exitCode).toBe(1);
    });

    test('handles Error objects', async () => {
        const { exitCode } = await capture(async () => fail(new Error('explosion')));
        expect(exitCode).toBe(1);
    });
});

describe('utils.getLatestVersion', () => {
    test('returns tag_name from the first release', async () => {
        const v = await getLatestVersion({
            fetchImpl: fakeFetch({ body: [{ tag_name: 'v9.9.9' }, { tag_name: 'v8.0.0' }] }),
        });
        expect(v).toBe('v9.9.9');
    });

    test('returns null when releases array is empty', async () => {
        const v = await getLatestVersion({ fetchImpl: fakeFetch({ body: [] }) });
        expect(v).toBeNull();
    });

    test('returns null when response is not ok', async () => {
        const v = await getLatestVersion({
            fetchImpl: fakeFetch({ ok: false, status: 500, body: [] }),
        });
        expect(v).toBeNull();
    });

    test('returns null when fetch throws', async () => {
        const v = await getLatestVersion({ fetchImpl: failingFetch() });
        expect(v).toBeNull();
    });

    test('returns null when payload is not an array', async () => {
        const v = await getLatestVersion({
            fetchImpl: fakeFetch({ body: { message: 'rate limited' } }),
        });
        expect(v).toBeNull();
    });

    test('returns null when first release has no tag_name', async () => {
        const v = await getLatestVersion({ fetchImpl: fakeFetch({ body: [{}] }) });
        expect(v).toBeNull();
    });

    test('aborts on timeout', async () => {
        const slowFetch = (_url, opts) =>
            new Promise((_, reject) => {
                opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
            });
        const v = await getLatestVersion({ fetchImpl: slowFetch, timeoutMs: 10 });
        expect(v).toBeNull();
    });

    test('exports the GitHub API URL', () => {
        expect(API_URL).toMatch(/api\.github\.com\/repos\/.+\/releases$/);
    });
});

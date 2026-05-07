const {
    setInputs,
    clearActionEnv,
    restoreEnv,
    capture,
} = require('./helpers.js');

const {
    run,
    checkUpdate,
    runBeforeUpload,
    runAfterUpload,
    cleanRemote,
    uploadFiles,
    shellEscape,
} = require('../../lib/run.js');

function makeDeployer(overrides = {}) {
    const calls = { run: [], upload: [], connect: [], disconnect: 0 };
    return {
        connect: vi.fn(async (opts) => {
            calls.connect.push(opts);
        }),
        run: vi.fn(async (cmd) => {
            calls.run.push(cmd);
            return { stdout: 'ok', stderr: '', code: 0 };
        }),
        upload: vi.fn(async (patterns) => {
            calls.upload.push(patterns);
            return patterns.length;
        }),
        disconnect: vi.fn(() => {
            calls.disconnect += 1;
        }),
        isConnected: () => true,
        _calls: calls,
        ...overrides,
    };
}

function deployerClassFor(instance) {
    return class {
        constructor(...args) {
            Object.assign(this, instance);
            this.constructorArgs = args;
            instance.constructorArgs = args;
        }
    };
}

describe('shellEscape', () => {
    test('wraps a plain word in single quotes', () => {
        expect(shellEscape('foo')).toBe(`'foo'`);
    });

    test('escapes embedded single quotes', () => {
        expect(shellEscape(`it's`)).toBe(`'it'\\''s'`);
    });

    test('coerces non-strings', () => {
        expect(shellEscape(42)).toBe(`'42'`);
    });
});

describe('checkUpdate (smoke)', () => {
    beforeEach(() => clearActionEnv());
    afterEach(() => restoreEnv());

    test('does not throw on unreachable network', async () => {
        await expect(checkUpdate('1.0.0')).resolves.not.toThrow();
    });
});

describe('runBeforeUpload', () => {
    beforeEach(() => clearActionEnv());
    afterEach(() => restoreEnv());

    test('skips when no commands provided', async () => {
        const deployer = makeDeployer();
        await runBeforeUpload(deployer);
        expect(deployer._calls.run).toHaveLength(0);
    });

    test('runs the multiline before-upload script', async () => {
        setInputs({ 'before-upload': 'echo a\necho b' });
        const deployer = makeDeployer();
        await capture(() => runBeforeUpload(deployer));
        expect(deployer._calls.run).toHaveLength(1);
        expect(deployer._calls.run[0]).toEqual(['echo a', 'echo b']);
    });
});

describe('runAfterUpload', () => {
    beforeEach(() => clearActionEnv());
    afterEach(() => restoreEnv());

    test('skips when no commands provided', async () => {
        const deployer = makeDeployer();
        await runAfterUpload(deployer);
        expect(deployer._calls.run).toHaveLength(0);
    });

    test('runs the multiline after-upload script', async () => {
        setInputs({ 'after-upload': 'pm2 restart svc' });
        const deployer = makeDeployer();
        await capture(() => runAfterUpload(deployer));
        expect(deployer._calls.run[0]).toEqual(['pm2 restart svc']);
    });
});

describe('cleanRemote', () => {
    beforeEach(() => clearActionEnv());
    afterEach(() => restoreEnv());

    test('does nothing when clean=false', async () => {
        setInputs({ clean: 'false' });
        const deployer = makeDeployer();
        await cleanRemote(deployer);
        expect(deployer._calls.run).toHaveLength(0);
    });

    test('runs a single delete when clean=true with no excludes', async () => {
        setInputs({ clean: 'true' });
        const deployer = makeDeployer();
        await capture(() => cleanRemote(deployer));
        expect(deployer._calls.run).toHaveLength(1);
        expect(deployer._calls.run[0]).toMatch(/find . ! -name '\*\.exclude' -delete/);
    });

    test('moves excludes aside, deletes, then restores', async () => {
        setInputs({ clean: 'true', 'clean-exclude': '.env\nlogs' });
        const deployer = makeDeployer();
        await capture(() => cleanRemote(deployer));
        // 2 rename-out + 1 delete + 2 rename-back = 5 calls
        expect(deployer._calls.run).toHaveLength(5);
        expect(deployer._calls.run[0]).toMatch(/find . -name '\.env' -exec mv \{\} \{\}\.exclude/);
        expect(deployer._calls.run[1]).toMatch(/find . -name 'logs' -exec mv \{\} \{\}\.exclude/);
        expect(deployer._calls.run[2]).toMatch(/find . ! -name '\*\.exclude' -delete/);
        expect(deployer._calls.run[3]).toMatch(/find . -name '\.env\.exclude' -exec mv \{\} '\.env'/);
        expect(deployer._calls.run[4]).toMatch(/find . -name 'logs\.exclude' -exec mv \{\} 'logs'/);
    });

    test('escapes single-quotes in exclude filenames', async () => {
        setInputs({ clean: 'true', 'clean-exclude': `it's.log` });
        const deployer = makeDeployer();
        await capture(() => cleanRemote(deployer));
        const renameOut = deployer._calls.run[0];
        const restore = deployer._calls.run[deployer._calls.run.length - 1];
        expect(renameOut).toMatch(/'it'\\''s\.log'/);
        expect(restore).toMatch(/'it'\\''s\.log\.exclude'/);
        expect(restore).toMatch(/mv \{\} 'it'\\''s\.log'/);
    });
});

describe('uploadFiles', () => {
    beforeEach(() => clearActionEnv());
    afterEach(() => restoreEnv());

    test('skips when no files provided', async () => {
        const deployer = makeDeployer();
        await uploadFiles(deployer);
        expect(deployer._calls.upload).toHaveLength(0);
    });

    test('passes the multiline file list to deployer.upload', async () => {
        setInputs({ files: '*.json\ndist/**' });
        const deployer = makeDeployer();
        await capture(() => uploadFiles(deployer));
        expect(deployer._calls.upload[0]).toEqual(['*.json', 'dist/**']);
    });
});

describe('run (full flow)', () => {
    beforeEach(() => clearActionEnv());
    afterEach(() => restoreEnv());

    test('fails fast when no auth method is provided', async () => {
        setInputs({
            host: 'h',
            username: 'u',
            'check-update': 'false',
        });
        const deployer = makeDeployer();
        const { exitCode } = await capture(() =>
            run({ version: '1.0.0', DeployerClass: deployerClassFor(deployer) })
        );
        expect(exitCode).toBe(1);
        expect(deployer._calls.connect).toHaveLength(0);
    });

    test('connects, uploads, runs hooks, and disconnects', async () => {
        setInputs({
            host: 'h',
            port: '2222',
            username: 'u',
            password: 'p',
            files: 'a.txt',
            'before-upload': 'echo before',
            'after-upload': 'echo after',
            'check-update': 'false',
            'remote-path': '/srv',
        });
        const deployer = makeDeployer();
        await capture(() =>
            run({ version: '1.0.0', DeployerClass: deployerClassFor(deployer) })
        );

        expect(deployer._calls.connect).toHaveLength(1);
        expect(deployer._calls.connect[0]).toMatchObject({
            host: 'h',
            port: 2222,
            username: 'u',
            password: 'p',
        });
        expect(deployer._calls.upload).toHaveLength(1);
        expect(deployer._calls.upload[0]).toEqual(['a.txt']);
        // before-upload + after-upload
        expect(deployer._calls.run).toHaveLength(2);
        expect(deployer._calls.disconnect).toBe(1);
    });

    test('defaults port to 22 when not numeric', async () => {
        setInputs({
            host: 'h',
            username: 'u',
            password: 'p',
            'check-update': 'false',
        });
        const deployer = makeDeployer();
        await capture(() =>
            run({ version: '1.0.0', DeployerClass: deployerClassFor(deployer) })
        );
        expect(deployer._calls.connect[0].port).toBe(22);
    });

    test('accepts key-only auth', async () => {
        setInputs({
            host: 'h',
            username: 'u',
            key: '----BEGIN PRIVATE KEY----',
            'check-update': 'false',
        });
        const deployer = makeDeployer();
        await capture(() =>
            run({ version: '1.0.0', DeployerClass: deployerClassFor(deployer) })
        );
        expect(deployer._calls.connect).toHaveLength(1);
        expect(deployer._calls.connect[0].privateKey).toBe('----BEGIN PRIVATE KEY----');
    });

    test('accepts key-path-only auth', async () => {
        setInputs({
            host: 'h',
            username: 'u',
            'key-path': '/tmp/id_rsa',
            'check-update': 'false',
        });
        const deployer = makeDeployer();
        await capture(() =>
            run({ version: '1.0.0', DeployerClass: deployerClassFor(deployer) })
        );
        expect(deployer._calls.connect).toHaveLength(1);
        expect(deployer._calls.connect[0].privateKeyPath).toBe('/tmp/id_rsa');
    });

    test('exits with 1 when connect fails', async () => {
        setInputs({
            host: 'h',
            username: 'u',
            password: 'p',
            'check-update': 'false',
        });
        const deployer = makeDeployer({
            connect: vi.fn(async () => {
                throw new Error('auth failed');
            }),
        });
        const { exitCode } = await capture(() =>
            run({ version: '1.0.0', DeployerClass: deployerClassFor(deployer) })
        );
        expect(exitCode).toBe(1);
        expect(deployer._calls.disconnect).toBe(1);
    });

    test('runs clean step when clean=true', async () => {
        setInputs({
            host: 'h',
            username: 'u',
            password: 'p',
            clean: 'true',
            'check-update': 'false',
        });
        const deployer = makeDeployer();
        await capture(() =>
            run({ version: '1.0.0', DeployerClass: deployerClassFor(deployer) })
        );
        // exactly one find ! -name -delete call
        const deletes = deployer._calls.run.filter((c) => /-delete/.test(c));
        expect(deletes).toHaveLength(1);
    });
});

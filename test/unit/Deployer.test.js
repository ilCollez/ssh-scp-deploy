const path = require('node:path');

const Deployer = require('../../lib/Deployer.js');

const FIXTURES = path.resolve(__dirname, '..', 'fixtures');

function fakeSshClient(overrides = {}) {
    const calls = {
        connect: [],
        execCommand: [],
        putFile: [],
        putDirectory: [],
        dispose: 0,
    };
    const client = {
        connect: vi.fn(async (opts) => {
            calls.connect.push(opts);
        }),
        execCommand: vi.fn(async (cmd, opts) => {
            calls.execCommand.push({ cmd, opts });
            return { stdout: 'ok', stderr: '', code: 0 };
        }),
        putFile: vi.fn(async (local, remote) => {
            calls.putFile.push({ local, remote });
        }),
        putDirectory: vi.fn(async (local, remote, opts) => {
            calls.putDirectory.push({ local, remote, opts });
            return true;
        }),
        dispose: vi.fn(() => {
            calls.dispose += 1;
        }),
        isConnected: vi.fn(() => true),
        ...overrides,
    };
    return { client, calls };
}

describe('Deployer.constructor', () => {
    test('resolves relative cwd against process.cwd()', () => {
        const { client } = fakeSshClient();
        const d = new Deployer('rel/dir', '/remote', { sshClient: client });
        expect(d.cwd).toBe(path.join(process.cwd(), 'rel/dir'));
        expect(d.rwd).toBe('/remote');
    });

    test('keeps absolute cwd as-is', () => {
        const { client } = fakeSshClient();
        const d = new Deployer('/abs/path', '/remote', { sshClient: client });
        expect(d.cwd).toBe('/abs/path');
    });
});

describe('Deployer.connect', () => {
    test('forwards options to the underlying ssh client', async () => {
        const { client, calls } = fakeSshClient();
        const d = new Deployer('/x', '/r', { sshClient: client });
        await d.connect({ host: 'h', username: 'u', password: 'p' });
        expect(calls.connect[0]).toEqual({ host: 'h', username: 'u', password: 'p' });
        expect(client.connect).toHaveBeenCalledOnce();
    });

    test('rejects when ssh client throws', async () => {
        const { client } = fakeSshClient({
            connect: vi.fn(async () => {
                throw new Error('refused');
            }),
        });
        const d = new Deployer('/x', '/r', { sshClient: client });
        await expect(d.connect({})).rejects.toThrow(/refused/);
    });
});

describe('Deployer.run', () => {
    let client, calls, deployer;
    beforeEach(() => {
        ({ client, calls } = fakeSshClient());
        deployer = new Deployer('/x', '/remote', { sshClient: client });
    });

    test('runs a single string command as-is (no shell wrapper)', async () => {
        const r = await deployer.run('ls -la');
        expect(r.code).toBe(0);
        expect(calls.execCommand[0].cmd).toBe('ls -la');
        expect(calls.execCommand[0].opts.cwd).toBe('/remote');
        expect(calls.execCommand[0].opts.stdin).toBeUndefined();
    });

    test('runs array commands as a bash -s script piped via stdin', async () => {
        await deployer.run(['cd /tmp', 'ls', 'pwd']);
        expect(calls.execCommand[0].cmd).toBe('bash -s');
        expect(calls.execCommand[0].opts.cwd).toBe('/remote');
        expect(calls.execCommand[0].opts.stdin).toBe(
            'set -euo pipefail\ncd /tmp\nls\npwd\n'
        );
    });

    test('preserves cd state across lines (single bash invocation)', async () => {
        await deployer.run(['cd /var/www', 'pwd']);
        // The two commands are sent in the SAME bash process via stdin,
        // so `cd` persists into the next line — that's the whole point.
        expect(calls.execCommand[0].cmd).toBe('bash -s');
        const lines = calls.execCommand[0].opts.stdin.split('\n');
        expect(lines).toContain('cd /var/www');
        expect(lines).toContain('pwd');
    });

    test('preserves shell comments (no &&-mangling)', async () => {
        await deployer.run(['# deploy step', 'echo hello']);
        expect(calls.execCommand[0].opts.stdin).toContain('# deploy step\necho hello');
    });

    test('does not escape special characters in script lines', async () => {
        await deployer.run([`echo "it's a $USER quote"`]);
        expect(calls.execCommand[0].opts.stdin).toContain(
            `echo "it's a $USER quote"`
        );
    });

    test('uses set -euo pipefail (strict mode)', async () => {
        await deployer.run(['true', 'false', 'echo never']);
        expect(calls.execCommand[0].opts.stdin.startsWith('set -euo pipefail\n')).toBe(true);
    });

    test('merges extra options for string commands', async () => {
        await deployer.run('ls', { cwd: '/override', execOptions: { env: { X: '1' } } });
        expect(calls.execCommand[0].opts.cwd).toBe('/override');
        expect(calls.execCommand[0].opts.execOptions).toEqual({ env: { X: '1' } });
    });

    test('options can override cwd for array commands but never stdin', async () => {
        await deployer.run(['ls'], { cwd: '/elsewhere', stdin: 'IGNORED' });
        expect(calls.execCommand[0].opts.cwd).toBe('/elsewhere');
        expect(calls.execCommand[0].opts.stdin).toBe('set -euo pipefail\nls\n');
    });
});

describe('Deployer.upload', () => {
    test('uploads matching files using putFile', async () => {
        const { client, calls } = fakeSshClient();
        const d = new Deployer(FIXTURES, '/remote', { sshClient: client });
        const count = await d.upload(['*.txt']);
        expect(count).toBe(1);
        expect(calls.putFile).toHaveLength(1);
        expect(calls.putFile[0].local).toBe(path.join(FIXTURES, 'a.txt'));
        expect(calls.putFile[0].remote).toBe('/remote/a.txt');
    });

    test('uploads directories using putDirectory', async () => {
        const { client, calls } = fakeSshClient();
        const d = new Deployer(FIXTURES, '/remote', { sshClient: client });
        await d.upload(['dir']);
        expect(calls.putDirectory).toHaveLength(1);
        expect(calls.putDirectory[0].local).toBe(path.join(FIXTURES, 'dir'));
        expect(calls.putDirectory[0].remote).toBe('/remote/dir');
        expect(typeof calls.putDirectory[0].opts.validate).toBe('function');
        expect(calls.putDirectory[0].opts.validate('whatever')).toBe(true);
    });

    test('matches dotfiles by default', async () => {
        const { client, calls } = fakeSshClient();
        const d = new Deployer(FIXTURES, '/remote', { sshClient: client });
        await d.upload(['.hiddenfile']);
        expect(calls.putFile).toHaveLength(1);
        expect(calls.putFile[0].remote).toBe('/remote/.hiddenfile');
    });

    test('returns 0 and uploads nothing when no files match', async () => {
        const { client, calls } = fakeSshClient();
        const d = new Deployer(FIXTURES, '/remote', { sshClient: client });
        const count = await d.upload(['no-such-file-*.zzz']);
        expect(count).toBe(0);
        expect(calls.putFile).toHaveLength(0);
        expect(calls.putDirectory).toHaveLength(0);
    });

    test('builds POSIX-style remote paths', async () => {
        const { client, calls } = fakeSshClient();
        const d = new Deployer(FIXTURES, '/remote', { sshClient: client });
        await d.upload(['dir/**/*.txt']);
        for (const { remote } of calls.putFile) {
            expect(remote).not.toContain('\\');
            expect(remote.startsWith('/remote/')).toBe(true);
        }
    });
});

describe('Deployer.disconnect', () => {
    test('calls dispose on the ssh client', () => {
        const { client, calls } = fakeSshClient();
        const d = new Deployer('/x', '/r', { sshClient: client });
        d.disconnect();
        expect(calls.dispose).toBe(1);
        expect(client.dispose).toHaveBeenCalledOnce();
    });
});

describe('Deployer.isConnected', () => {
    test('reflects underlying client state', () => {
        const { client } = fakeSshClient({ isConnected: () => false });
        const d = new Deployer('/x', '/r', { sshClient: client });
        expect(d.isConnected()).toBe(false);
    });
});

/**
 * Test helpers for setting up GitHub Action env vars and capturing console output.
 */

const ORIGINAL_ENV = { ...process.env };

function clearActionEnv() {
    for (const key of Object.keys(process.env)) {
        if (key.startsWith('INPUT_') || key === 'GITHUB_OUTPUT' || key === 'GITHUB_STATE') {
            delete process.env[key];
        }
    }
}

/**
 * Set @actions/core inputs via env vars (as the runner would).
 * Pass an object whose keys are action-input names.
 */
function setInputs(inputs) {
    clearActionEnv();
    for (const [key, value] of Object.entries(inputs)) {
        if (value === undefined || value === null) continue;
        const envKey = `INPUT_${key.replace(/ /g, '_').toUpperCase()}`;
        process.env[envKey] = String(value);
    }
}

function restoreEnv() {
    for (const key of Object.keys(process.env)) {
        if (!(key in ORIGINAL_ENV)) delete process.env[key];
    }
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
        process.env[key] = value;
    }
}

/**
 * Capture stdout/stderr and process.exit while running fn.
 * Returns { stdout, stderr, exitCode, value }.
 */
async function capture(fn) {
    const out = [];
    const err = [];
    let exitCode;

    const origLog = console.log;
    const origErr = console.error;
    const origExit = process.exit;
    const origExitCode = process.exitCode;

    console.log = (...args) => out.push(args.map(String).join(' '));
    console.error = (...args) => err.push(args.map(String).join(' '));
    process.exit = (code) => {
        exitCode = code;
        throw new Error(`__exit_${code}__`);
    };

    let value;
    let thrown;
    try {
        value = await fn();
    } catch (e) {
        if (!String(e?.message ?? '').startsWith('__exit_')) thrown = e;
    } finally {
        console.log = origLog;
        console.error = origErr;
        process.exit = origExit;
        // @actions/core's setFailed mutates process.exitCode; reset it so the
        // test process doesn't exit non-zero when every test actually passed.
        process.exitCode = origExitCode;
    }

    if (thrown) throw thrown;
    return { stdout: out.join('\n'), stderr: err.join('\n'), exitCode, value };
}

/** Build a fake fetch that returns a fixed response. */
function fakeFetch({ ok = true, status = 200, body = [] } = {}) {
    return async () => ({
        ok,
        status,
        json: async () => body,
    });
}

/** Build a fake fetch that throws. */
function failingFetch(error = new Error('network')) {
    return async () => {
        throw error;
    };
}

module.exports = {
    setInputs,
    clearActionEnv,
    restoreEnv,
    capture,
    fakeFetch,
    failingFetch,
};

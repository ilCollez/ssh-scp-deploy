const {
    getInput,
    setFailed,
    getBooleanInput,
} = require('@actions/core');

const fail = (message) => {
    const text = message instanceof Error ? message.message : String(message);
    setFailed(`❌ Fatal error: ${text}`);
    process.exit(1);
};

const input = (key, opts = {}) => {
    const val = getInput(key, opts);
    return val === '' ? undefined : val;
};

const boolInput = (name, defaultValue = false) => {
    try {
        return getBooleanInput(name);
    } catch {
        return defaultValue;
    }
};

const isSilent = () => boolInput('silent', false);

const log = (message) => {
    if (!isSilent()) {
        console.log(message);
    }
};

const API_URL = 'https://api.github.com/repos/ilCollez/ssh-scp-deploy/releases';

const getLatestVersion = async ({ fetchImpl = fetch, timeoutMs = 5000 } = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetchImpl(API_URL, {
            headers: { Accept: 'application/vnd.github+json' },
            signal: controller.signal,
        });

        if (!res.ok) return null;

        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            return data[0].tag_name ?? null;
        }
        return null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
};

module.exports = {
    fail,
    input,
    log,
    isSilent,
    boolInput,
    getLatestVersion,
    API_URL,
};

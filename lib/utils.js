const {
    getInput,
    setFailed,
    getBooleanInput
} = require('@actions/core');

const fail = (message) => {
    setFailed(message);
    process.exit(1);
};

const input = (key, opts = {}) => {
    const val = getInput(key, opts);
    return val === '' ? undefined : val;
}

const silent = getBooleanInput('silent');
const log = (message) => {
    if (!silent) {
        console.log(message);
    }
}

module.exports = {
    fail,
    input,
    log
}
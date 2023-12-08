const {
    getInput,
    setFailed,
    getBooleanInput
} = require('@actions/core');

const axios = require('axios').default;

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

const API_URL = "https://api.github.com/repos/ilCollez/ssh-scp-deploy/releases";
const getLatestVersion = async () => {
    const res = await axios.get(API_URL)
        .catch(() => { data: [] });

    if (Array.isArray(res?.data) && res.data.length > 0) {
        return res.data[0].tag_name
    } else {
        return null;
    }
}

module.exports = {
    fail,
    input,
    log,
    getLatestVersion
}
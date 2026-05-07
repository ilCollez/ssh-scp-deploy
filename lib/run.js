const {
    getInput,
    getMultilineInput,
    setSecret,
    notice,
} = require('@actions/core');

const semver = require('semver');

const { log, fail, input, getLatestVersion, boolInput } = require('./utils.js');
const Deployer = require('./Deployer.js');

const shellEscape = (str) => `'${String(str).replace(/'/g, `'\\''`)}'`;

async function checkUpdate(currentVersion) {
    log('🔄 Checking for updates...');

    const latestVersion = await getLatestVersion();

    if (latestVersion === null) {
        log('Could not check for a newer version');
        return;
    }

    if (semver.valid(latestVersion) === null) {
        log(`Could not check for a newer version: ${latestVersion} is not a valid semantic version`);
        return;
    }

    if (semver.valid(currentVersion) === null) {
        log(`Could not check for a newer version: ${currentVersion} is not a valid semantic version`);
        return;
    }

    if (semver.gt(latestVersion, currentVersion)) {
        log('✅ A new version is available!');
        notice(`A new version (${latestVersion}) of ssh-scp-deploy is available! Go check the new features!`);
    } else {
        log('✅ Already the latest version!');
    }
}

async function runBeforeUpload(deployer) {
    const beforeUpload = getMultilineInput('before-upload');
    if (!beforeUpload.length) return;

    log('📄 Executing before-upload script...');

    const cmd = await deployer.run(beforeUpload);
    log(cmd.stdout);
    if (cmd.code !== 0) log(cmd.stderr);

    log('✅ Successfully executed before-upload');
}

async function runAfterUpload(deployer) {
    const afterUpload = getMultilineInput('after-upload');
    if (!afterUpload.length) return;

    log('📄 Executing after-upload script...');

    const cmd = await deployer.run(afterUpload);
    log(cmd.stdout);
    if (cmd.code !== 0) log(cmd.stderr);

    log('✅ Successfully executed after-upload');
}

async function cleanRemote(deployer) {
    if (!boolInput('clean', false)) return;

    const excludeList = getMultilineInput('clean-exclude');

    for (const file of excludeList) {
        await deployer.run(`find . -name ${shellEscape(file)} -exec mv {} {}.exclude \\;`);
    }

    log('🗑 Cleaning remote directory...');
    await deployer.run("find . ! -name '*.exclude' -delete");
    log('✅ Successfully cleaned remote path');

    for (const file of excludeList) {
        await deployer.run(
            `find . -name ${shellEscape(`${file}.exclude`)} -exec mv {} ${shellEscape(file)} \\;`
        );
    }
}

async function uploadFiles(deployer) {
    const files = getMultilineInput('files');
    if (!files.length) return;

    log('📂 Uploading files...');
    await deployer.upload(files);
    log('✅ Files uploaded successfully');
}

async function run({ version, DeployerClass = Deployer } = {}) {
    const password = input('password');
    const privateKey = input('key');
    const privateKeyPath = input('key-path');
    const passphrase = input('passphrase');

    if (password) setSecret(password);
    if (privateKey) setSecret(privateKey);
    if (passphrase) setSecret(passphrase);

    if (!password && !(privateKey || privateKeyPath)) {
        fail('You must provide either a password, a private key or a private key path');
        return;
    }

    const deployer = new DeployerClass(
        getInput('local-path') || process.cwd(),
        getInput('remote-path') || '/'
    );

    const disconnect = (success) => {
        log(success ? '🚀 All done! disconnecting...' : '🚀 Disconnecting...');
        try {
            deployer.disconnect();
        } catch {
            /* ignore */
        }
    };

    try {
        if (boolInput('check-update', true)) {
            await checkUpdate(version);
        }

        log('🚀 Connecting...');
        await deployer.connect({
            host: getInput('host', { required: true }),
            port: parseInt(getInput('port'), 10) || 22,
            username: getInput('username', { required: true }),
            password,
            privateKey,
            privateKeyPath,
            passphrase,
        });
        log('✅ Successfully connected');

        await runBeforeUpload(deployer);
        await cleanRemote(deployer);
        await uploadFiles(deployer);
        await runAfterUpload(deployer);

        disconnect(true);
    } catch (err) {
        disconnect(false);
        fail(err);
    }
}

module.exports = {
    run,
    checkUpdate,
    runBeforeUpload,
    runAfterUpload,
    cleanRemote,
    uploadFiles,
    shellEscape,
};

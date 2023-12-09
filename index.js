const {
    getInput,
    getMultilineInput,
    setSecret,
    getBooleanInput,
    notice,
} = require('@actions/core');

const semver = require('semver');
const { version } = require("./package.json");

const { log, fail, input, getLatestVersion } = require('./lib/utils.js');

const Deployer = require('./lib/Deployer.js');

const password = input('password');
const privateKey = input('key');
const privateKeyPath = input('key-path');
const passphrase = input('passphrase');

setSecret(password);
setSecret(privateKey);
setSecret(privateKeyPath);
setSecret(passphrase);

if (!password && !(privateKey || privateKeyPath)) {
    fail('You must provide either a password, a private key or a private key path');
}

const deployer = new Deployer(
    getInput('local-path') || process.cwd(),
    getInput('remote-path')
);

process.on('exit', (code) => {
    if (code === 0) {
        log('🚀 All done! disconnecting...');
    } else {
        log('🚀 Disconnecting...');
    }

    deployer.disconnect();
});

(async () => {
    if (getBooleanInput('check-update')) {
        log('🔄 Checking for updates...');
        
        const latestVersion = await getLatestVersion()
            .catch(fail) ?? version;

        if (semver.valid(latestVersion) === null) {
            log(`Could not check for a newer version: ${latestVersion} is not a valid semantic version`);
        } else if (semver.valid(version) === null) {
            log(`Could not check for a newer version: ${version} is not a valid semantic version`);
        } else {
            if (semver.gt(latestVersion, version)) {
                log('✅ A new version is available!');
                notice(`A new version (${latestVersion}) of ssh-scp-deploy is available! Go check the new features!`);
            } else {
                log('✅ Already the latest version!');
            }
        }
    }

    log('🚀 Connecting...');

    await deployer
        .connect({
            host: getInput('host', { required: true }),
            port: parseInt(getInput('port')),
            username: getInput('username', { required: true }),
            password,
            privateKey,
            privateKeyPath,
            passphrase,
        })
        .catch(fail);

    log('✅ Successfully connected');

    const beforeUpload = getMultilineInput('before-upload');
    if (beforeUpload.length) {
        log('📄 Executing before-upload script...');
                
        const cmd = await deployer
            .run(beforeUpload)
            .catch(fail);

        log(cmd.stdout);
        if (cmd.code !== 0) log(cmd.stderr);

        log('✅ Successfully executed before-upload');
    }

    if (getBooleanInput('clean')) {
        const excludeList = getMultilineInput('clean-exclude');

        if (excludeList.length) {
            for (const file of excludeList) {
                await deployer.run(`find . -name '${file}' -exec mv {} {}.exclude \\;`).catch(fail);
            }
        }

        log('🗑 Cleaning remote directory...');
        await deployer.run('find . ! -name \'*.exclude\' -delete').catch(fail);
        log('✅ Successfully cleaned remote path');

        if (excludeList.length) {
            for (const file of excludeList) {
                await deployer.run(`find . -name '${file}.exclude' -exec mv {} ${file} \\;`).catch(fail);
            }
        }

        const c = await deployer.run('ls').catch(fail);
        console.log(c.stdout);
    }

    const files = getMultilineInput('files');
    if (files.length) {
        log('📂 Uploading files...');
        await deployer.upload(files).catch(fail);
        log('✅ Files uploaded successfully');
    }

    const afterUpload = getMultilineInput('after-upload');
    if (afterUpload.length) {
        log('📄 Executing after-upload script...');
        
        const cmd = await deployer
            .run(afterUpload)
            .catch(fail);

        log(cmd.stdout);
        if (cmd.code !== 0) log(cmd.stderr);

        log('✅ Successfully executed after-upload');
    }

    process.exit(0);
})();
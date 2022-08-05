const {
    getInput,
    getMultilineInput,
    setFailed,
    setSecret,
    getBooleanInput,
} = require('@actions/core');

const Deployer = require('./lib/Deployer.js');

const deployer = new Deployer();

const fail = (message) => {
    setFailed(message);
    deployer.disconnect();
    process.exit(1);
};

const input = (key, opts = {}) => {
    const val = getInput(key, opts);
    return val === '' ? undefined : val;
}

const password = input('password');
const privateKey = input('key');
const privateKeyPath = input('key-path');
const passphrase = input('passphrase');

setSecret(password);
setSecret(privateKey);
setSecret(privateKeyPath);
setSecret(passphrase);

if (!password && !(privateKey || privateKeyPath))
    fail('You must provide either a password, a private key or a private key path');

(async () => {
    console.log('🚀 Connecting...');

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

    console.log('✅ Successfully connected');

    deployer.cwd = getInput('remote-path');

    const beforeUpload = getMultilineInput('before-upload');
    if (beforeUpload.length) {
        console.log('📄 Executing before-upload script...');
                
        const cmd = await deployer
            .run(beforeUpload)
            .catch(fail);

        console.log(cmd.stdout);
        if (cmd.code !== 0) console.log(cmd.stderr);

        console.log('✅ Successfully executed before-upload');
    }

    if (getBooleanInput('clean')) {
        const excludeList = getMultilineInput('clean-exclude');

        if (excludeList.length) {
            for (const file of excludeList) {
                await deployer.run(`find ./* -name '${file}' -exec mv {} {}.exclude \\;`).catch(fail);
            }
        }

        console.log('🗑 Cleaning remote directory...');
        await deployer.run('find ./* ! -name \'*.exclude\' -delete').catch(fail);
        console.log('✅ Successfully cleaned remote path');

        if (excludeList.length) {
            for (const file of excludeList) {
                await deployer.run(`find ./* -name '${file}.exclude' -exec mv {} ${file} \\;`).catch(fail);
            }
        }
    }

    const files = getMultilineInput('files');
    if (files.length) {
        console.log('📂 Uploading files...');
        await deployer.upload(files, '.').catch(fail);
        console.log('✅ Files uploaded successfully');
    }

    const afterUpload = getMultilineInput('after-upload');
    if (afterUpload.length) {
        console.log('📄 Executing after-upload script...');
        
        const cmd = await deployer
            .run(afterUpload)
            .catch(fail);

        console.log(cmd.stdout);
        if (cmd.code !== 0) console.log(cmd.stderr);

        console.log('✅ Successfully executed after-upload');
    }

    console.log('🚀 All done! disconnecting...');

    deployer.disconnect();
})();
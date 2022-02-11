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

const password = getInput('password');
const privateKey = getInput('key');
const passphrase = getInput('passphrase');

setSecret(password);
setSecret(privateKey);
setSecret(passphrase);

if (!password && !privateKey)
    fail('You must provide either a password or a private key');

(async () => {
    console.log('🚀 Connecting...');

    await deployer
        .connect({
            host: getInput('host', { required: true }),
            port: parseInt(getInput('port')),
            username: getInput('username', { required: true }),
            password,
            privateKey,
            passphrase,
        })
        .catch(fail);

    console.log('✅ Successfully connected');

    deployer.cwd = getInput('remote-path');

    const beforeUpload = getMultilineInput('before-upload');
    if (beforeUpload) {
        console.log('📄 Executing before-upload script...');
                
        const cmd = await deployer
            .run(beforeUpload)
            .catch(fail);

        console.log(cmd.stdout);
        if (cmd.code !== 0) console.log(cmd.stderr);

        console.log('✅ Successfully executed before-upload');
    }

    if (getBooleanInput('clean')) {
        console.log('🗑 Cleaning remote directory...');
        await deployer.run('rm -rf *').catch(fail);
        console.log('✅ Successfully cleaned remote path');
    }

    const files = getMultilineInput('files', { required: true });
    console.log('📂 Uploading files...');
    await deployer.upload(files, '.').catch(fail);
    console.log('✅ Files uploaded successfully');

    const afterUpload = getMultilineInput('after-upload');
    if (afterUpload) {
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
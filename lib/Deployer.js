const { NodeSSH } = require('node-ssh');
const fg = require('fast-glob');
const { join } = require('path');

module.exports = class Deployer {
    _sshClient = new NodeSSH();
    cwd = undefined;

    async connect(options) {
        await this._sshClient.connect(options);
    }

    async run(command, options) {
        if (Array.isArray(command)) {
            command = command.join('&&');
        }

        await this._sshClient.execCommand(command, {
            cwd: this.cwd,
            ...options
        });
    }

    async upload(file, remotePath) {
        const glob = await fg(file, {
            onlyFiles: false,
            markDirectories: true
        });
        
        for (const file of glob) {
            console.log(`📦 Uploading ${file}...`);

            const localPath = join(process.cwd(), file);
            const remoteFilePath = join(this.cwd || '', remotePath, file);

            if (file.endsWith('/')) {
                await this._sshClient.putDirectory(localPath, remoteFilePath);
            } else {
                await this._sshClient.putFile(localPath, remoteFilePath);
            }
        }
    }

    disconnect() {
        this._sshClient.dispose();
    }
}
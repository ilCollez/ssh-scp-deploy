const { NodeSSH } = require('node-ssh');
const { glob } = require('glob');
const { join } = require('path');

const { log } = require('./utils.js');

module.exports = class Deployer {
    constructor(cwd, rwd) {
        this._sshClient = new NodeSSH();
        this.cwd = join(process.cwd(), cwd);
        this.rwd = rwd;
    }

    async connect(options) {
        await this._sshClient.connect(options);
    }

    async run(command, options) {
        if (Array.isArray(command)) {
            command = command.join('&&');
        }

        return await this._sshClient.execCommand(command, {
            cwd: this.rwd,
            ...options
        });
    }

    async upload(patterns) {
        const files = await glob(patterns, {
            withFileTypes: true,
            cwd: this.cwd,
            dot: true
        });

        for (const file of files) {
            const relPath = file
                .fullpath()
                .substring(this.cwd.length + 1);

            log(`📦 Uploading ${relPath}...`);
            const remotePath = join(this.rwd, relPath);

            if (file.isDirectory()) {
                await this._sshClient.putDirectory(file.fullpath(), remotePath, {
                    validate: (_) => true
                });
            } else {
                await this._sshClient.putFile(file.fullpath(), remotePath);
            }
        }
    }

    disconnect() {
        this._sshClient.dispose();
    }
}
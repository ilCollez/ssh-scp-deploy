const { NodeSSH } = require('node-ssh');
const { glob } = require('glob');
const { join, isAbsolute, posix } = require('path');

const { log } = require('./utils.js');

class Deployer {
    constructor(cwd, rwd, { sshClient } = {}) {
        this._sshClient = sshClient ?? new NodeSSH();
        this.cwd = isAbsolute(cwd) ? cwd : join(process.cwd(), cwd);
        this.rwd = rwd;
    }

    async connect(options) {
        await this._sshClient.connect(options);
    }

    async run(command, options = {}) {
        if (Array.isArray(command)) {
            // Pipe a real script to bash via stdin: zero escaping, preserves
            // newlines and comments, and `set -euo pipefail` makes the script
            // abort on the first error (including failed pipeline stages and
            // unset variables).
            const script = `set -euo pipefail\n${command.join('\n')}\n`;
            return this._sshClient.execCommand('bash -s', {
                cwd: this.rwd,
                ...options,
                stdin: script,
            });
        }

        return this._sshClient.execCommand(command, {
            cwd: this.rwd,
            ...options,
        });
    }

    async upload(patterns) {
        const files = await glob(patterns, {
            withFileTypes: true,
            cwd: this.cwd,
            dot: true,
        });

        for (const file of files) {
            const fullPath = file.fullpath();
            const relPath = fullPath.substring(this.cwd.length + 1);
            const remotePath = posix.join(this.rwd, relPath.split(/[\\/]/).join('/'));

            log(`📦 Uploading ${relPath}...`);

            if (file.isDirectory()) {
                await this._sshClient.putDirectory(fullPath, remotePath, {
                    validate: () => true,
                });
            } else {
                await this._sshClient.putFile(fullPath, remotePath);
            }
        }

        return files.length;
    }

    isConnected() {
        return Boolean(this._sshClient?.isConnected?.());
    }

    disconnect() {
        this._sshClient.dispose();
    }
}

module.exports = Deployer;

# SSH & SCP Deploy

[![CI](https://github.com/ilCollez/ssh-scp-deploy/actions/workflows/ci.yml/badge.svg)](https://github.com/ilCollez/ssh-scp-deploy/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

This GitHub Action lets you deploy your project to a remote server using SSH and SCP. Even though there are many other actions like this, I wanted to create a more customizable one.

Runs on the **Node.js 20** action runtime.

## Inputs

| Required | Name              | Description                                                            | Default       |
|----------|-------------------|------------------------------------------------------------------------|---------------|
| **YES**  | `host`            | Remote host                                                            | ""            |
|          | `port`            | Remote port                                                            | 22            |
| **YES**  | `username`        | SSH remote user                                                        | ""            |
|          | `password`        | SSH remote password                                                    | ""            |
|          | `key`             | SSH private key                                                        | ""            |
|          | `key-path`        | Path to the SSH private key                                            | ""            |
|          | `passphrase`      | SSH key passphrase                                                     | ""            |
|          | `silent`          | Whether to log the script's output to stdout                           | false         |
|          | `files`           | Files and folders to upload. You can use glob patterns.                | ""            |
|          | `remote-path`     | Remote destination path                                                | "/"           |
|          | `local-path`      | Local base path                                                        | process.cwd() |
|          | `clean`           | Whether to clean the remote path before uploading                      | false         |
|          | `clean-exclude`   | List of files to exclude when cleaning the remote path                 | ""            |
|          | `before-upload`   | Commands executed before the file transfer, on the host machine        | ""            |
|          | `after-upload`    | Commands executed after the file transfer, on the host machine        | ""            |
|          | `check-update`    | Whether to check for updates at startup                                | true          |

## Information
You can use this library even without uploading files to the remote server. To send commands only, you can use either `before-upload` or `after-upload`.

## Example Usage
**NOTE**: For security reasons, it is recommended to store passwords, ssh keys, passphrases etc. in the `Secrets` section of your GitHub repository.

### Using User & Password
```yaml
uses: ilCollez/ssh-scp-deploy@v2.0.0
with:
    host: ${{ secrets.SSH_HOST }} # "example.com"
    port: ${{ secrets.SSH_PORT }} # 22
    username: ${{ secrets.SSH_USER }} # "user"
    password: ${{ secrets.SSH_PASSWORD }} # "password"
    files: |
        *.json
        public
        dist
        lib/**/*.js
    remote-path: "/var/www/html"
    clean: true
```

### Using Private Key
```yaml
uses: ilCollez/ssh-scp-deploy@v2.0.0
with:
    host: ${{ secrets.SSH_HOST }} # "example.com"
    port: ${{ secrets.SSH_PORT }} # 22
    username: ${{ secrets.SSH_USER }} # "user"
    key: ${{ secrets.SSH_KEY }} # you can also use key-path: "~/.ssh/id_rsa"
    passphrase: ${{ secrets.SSH_PASSPHRASE }} # "passphrase"
    files: |
        *.json
        public
        dist
        lib/**/*.js
    remote-path: "/var/www/html"
```

### Using pre-upload and post-upload commands
```yaml
uses: ilCollez/ssh-scp-deploy@v2.0.0
with:
    host: ${{ secrets.SSH_HOST }} # "example.com"
    port: ${{ secrets.SSH_PORT }} # 22
    username: ${{ secrets.SSH_USER }} # "user"
    key: ${{ secrets.SSH_KEY }} # you can also use key-path: "~/.ssh/id_rsa"
    passphrase: ${{ secrets.SSH_PASSPHRASE }} # "passphrase"
    files: |
        *.json
        public
        dist
        lib/**/*.js
    remote-path: "/var/www/html"
    clean: true
    clean-exclude: |
        .env
    before-upload: |
        echo "Executed before upload"

        pm2 stop service
    after-upload: |
        echo "Executed after upload"

        npm ci --production
        npm run build
        npm test

        pm2 start service
```

## Development

This project requires **Node.js 20+**.

```bash
npm install            # install dependencies (auto-builds dist/ via prepare script)
npm test               # run the unit test suite (vitest)
npm run test:watch     # re-run tests on file changes
npm run test:coverage  # report line/branch/function coverage (v8 + lcov + html)
npm run build          # bundle everything into dist/index.js with @vercel/ncc
```

The action's `runs.main` points to `dist/index.js`, a single self-contained bundle produced by `@vercel/ncc`. **Always rebuild and commit `dist/` when you change anything under `lib/` or `index.js`** — CI verifies this.

The unit suite uses [Vitest](https://vitest.dev) and covers `lib/utils.js`, `lib/Deployer.js` and `lib/run.js` with mock SSH clients and a fake `fetch` — no network or real SSH server is required. Coverage gates are enforced (≥90% lines, ≥95% functions, ≥80% branches).

An integration test that spins up a real `openssh-server` container is also available:

```bash
npm run test:integration   # requires docker + nektos/act
```

## Contributing
Pull requests are welcome. Make sure `npm test` is green before opening a PR — CI runs the same suite on Node 20 and 22.

## What's new in v2.0.0
- Action runtime bumped to **Node 20** (Node 16 was deprecated by GitHub).
- Replaced `axios` with the native `fetch` API — one fewer dependency.
- `before-upload` and `after-upload` scripts now run in a single `bash -s` invocation with `set -euo pipefail`. Compared to the old `&&` join this means: shell comments work, `cd` and variable assignments persist across lines, no shell escaping headaches, and the script aborts on the first failed command (or failed pipeline stage, or unset variable).
- Hardened the remote-clean step against shell-injection in exclude paths.
- Fixed a bug in the update-check that always swallowed the API response.
- New full unit-test suite (Vitest, 63 tests) and CI workflow with coverage gates.

## To Do
- [ ] Add support for SSH proxy

## License
This GitHub Action is licensed under the MIT License.

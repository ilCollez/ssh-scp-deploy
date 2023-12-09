# SSH & SCP Deploy
This GitHub Action lets you deploy your project to a remote server using SSH and SCP. Even though there are many other actions like this, i wanted to create a more customizable one.

| Required | Name              | Description                                                            | Default   |
|----------|-------------------|------------------------------------------------------------------------|---------------|
| **YES**  | `host`            | Remote host                                                            | ""            |
|          | `port`            | Remote port. Default: 22                                               | 22            |
| **YES**  | `username`        | SSH remote user                                                        | ""            |
|          | `password`        | SSH remote password                                                    | ""            |
|          | `key`             | SSH private key                                                        | ""            |
|          | `key-path`        | Path to the SSH private key                                            | ""            |
|          | `passphrase`      | SSH key passphrase                                                     | ""            |
|          | `silent`          | Whether to log the script's output to stdout                           | false         |
|          | `files`           | Files and folders to upload. You can use glob patterns.                | ""            |
|          | `remote-path`     | Remote destination path.                                               | "/"           |
|          | `local-path`      | Local base path.                                                       | process.cwd() |
|          | `clean`           | Whether to clean the remote path before uploading                      | false         |
|          | `clean-exclude`   | List of files to exclude when cleaning the remote path                 | ""            |
|          | `before-upload`   | Commands to execute before the SCP file transfer, on the host machine  | ""            |
|          | `after-upload`    | Commands to execute after the SCP file transfer, on the host machine   | ""            |
|          | `check-update`    | Whether to check or not for updates at startup                         | true          |

## Information
You can use this library even without uploading files to the remote server. To send commands only, you can use either `before-upload` or `after-upload`

## Example Usage
**NOTE**: For security reasons, it is recommended to store passwords, ssh keys, passphrases etc. in the `Secrets` section of your GitHub repository.
### Using User & Password
```yaml
uses: ilCollez/ssh-scp-deploy@v1.2.0
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
uses: ilCollez/ssh-scp-deploy@v1.2.0
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
uses: ilCollez/ssh-scp-deploy@v1.2.0
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

## To Do
- [ ] Add support for SSH proxy
- [ ] Add Tests

## License
This GitHub Action is licensed under the MIT License.

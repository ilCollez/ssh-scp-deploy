# SSH & SCP Deploy
This GitHub Action lets you deploy your project to a remote server using SSH and SCP. Even though there are many other actions like this, i wanted to create a more customizable one.

## Input Variables
- `host` - [**REQUIRED**] Remote host
- `port` -  Remote port. Default: 22
- `username` - [**REQUIRED**] SSH remote user
- `password` -  SSH remote password
- `key` -  SSH private key
- `key-path` -  Path to the SSH private key
- `passphrase` -  SSH key passphrase
- `files` - [**REQUIRED**] Files and folders to upload. You can use glob patterns.
- `remote-path` -  Remote destination path
- `clean` -  Whether to clean the remote path before uploading. Default: false
- `clean-exclude` -  List of files to exclude when cleaning the remote path
- `before-upload` -  Commands to execute before the SCP file transfer, on the host machine
- `after-upload` -  Commands to execute after the SCP file transfer, on the host machine

## Example Usage
**NOTE**: For security reasons, it is recommended to store passwords, ssh keys, passphrases etc. in the `Secrets` section of your GitHub repository.
### Using User & Password
```yaml
uses: ilCollez/ssh-scp-deploy@main
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
uses: ilCollez/ssh-scp-deploy@main
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
uses: ilCollez/ssh-scp-deploy@main
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
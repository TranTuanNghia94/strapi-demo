# Airbasket Api

A quick description of Airbasket.

# Deploy to Ubuntu server

refer https://blog.strapi.io/how-to-deploy-a-strapi-application/

1. Install Nodejs

> $ curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
> $ sudo apt-get install -y nodejs

2. Check that Node has been successfully installed:
> $ node -v

- Install Mongodb
- refer https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/

3. Import the public key used by the package management system

> $ sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4

4. Create a list file for MongoDB

> $ echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.0.list

5. Reload local package database.

> $ sudo apt-get update

6. Install the MongoDB packages.

> $ sudo apt-get update && sudo apt-get install -y mongodb-org

7. Optional. Although you can specify any available version of MongoDB, apt-get will upgrade the packages when a newer version becomes available. To prevent unintended upgrades, you can pin the package at the currently installed version:
> $ echo "mongodb-org hold" | sudo dpkg --set-selections
echo "mongodb-org-server hold" | sudo dpkg --set-selections
echo "mongodb-org-shell hold" | sudo dpkg --set-selections
echo "mongodb-org-mongos hold" | sudo dpkg --set-selections
echo "mongodb-org-tools hold" | sudo dpkg --set-selections

- Run MongoDB Community Edition Production Notes
- Before deploying MongoDB in a production environment, consider the Production Notes document.
- ulimit Considerations
- Most Unix-like operating systems limit the system resources that a session may use. These limits may negatively impact MongoDB operation. See UNIX ulimit Settings for more information.
- Directories
- If you installed via the package manager, the data directory /var/lib/mongodb and the log directory /var/log/mongodb are created during the installation.

- By default, MongoDB runs using the mongodb user account. If you change the user that runs the MongoDB process, you must also modify the permission to the data and log directories to give this user access to these directories.

- Configuration File
- The official MongoDB package includes a configuration file (/etc/mongod.conf). These settings (such as the data directory and log directory specifications) take effect upon startup. That is, if you change the configuration file while the MongoDB instance is running, you must restart the instance for the changes to take effect.

8. Start MongoDB.

> $ sudo service mongod start

9. install build tool (for ubuntu)
> $ sudo apt install build-essential
> $ curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
> $ echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
> $ sudo apt-get update && sudo apt-get install yarn
> $ sudo apt-get install node-gyp
> $ mkdir ~/.npm-global
> $ npm config set prefix '~/.npm-global'
> $ nano .profile

- add: export PATH=~/.npm-global/bin:$PATH
> $ source .profile

10. Clone project

> $ cd path_to_project_folder

> $ git clone https://(abk-admin.repository)
> $ cd abk-admin
> $ yarn setup

11. Update server info in abk-api/config/environments/production/database.json and abk-api/config/environments/production/server.json

12. Install strapi
> $ sudo npm install -g strapi@beta

- if install failed add to ~/.npmrc
- unsafe-perm=true
- try again

- build development evironment
> $ cd abk-api
> $ strapi develop

13. Build with production evironment

> $ NODE_ENV=production yarn build

14. Start the server to make sure everything is going well:

> $ NODE_ENV=production npm start

15. If can't start server try reinstall package > \$ cd ! && rm -rf .node-gyp
> $ cd api-api && rm -rf node_modules && rm yarn.lock
> $ yarn setup

# Install pm2 via npm

> $ sudo npm install -g pm2

# Start with pm2 service
- cd to /abk-admin/abk-api/
> $ pm2 start --name="Strapi" npm -- start

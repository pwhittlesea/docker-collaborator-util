# Docker Collaborator Utility

When starting with Docker Hub it is common to create an account to get started.
Then, before you know it you are running all your production workloads off of a single account.

This repo allows you to [migrate to an organisation](https://success.docker.com/article/how-do-i-convert-my-docker-hub-user-account-into-an-organization-account) by
first adding other users as collaborators.

Why? Because when you switch to an organisation Docker will stop you logging in with the converted account.
This means your production system will not be able to pull images in the event of a failure.

## Building

This application is a simple NodeJS application.

Dependencies can be downloaded by running:

```bash
npm install
```

## Usage

This application has a few options that allow you to migrate to an organisation account.
See the examples section below for sample executions.

```
Usage: util.js -u [username] -p [password]

Options:
  --help               Show help                                       [boolean]
  --version            Show version number                             [boolean]
  --password, -p       Docker hub password                            [required]
  --username, -u       Docker hub username                            [required]
  --collaborators, -c  Collaborators to ensure on each repo              [array]
  --visibility, -v     The maximum visibility level allowed on projects
                                                  [choices: "public", "private"]
  --repository, -r     Check only one repository
  --dryrun, -d         Do not change the repositories, only WARN of required
                       changes                                           [count]
```

## Examples

### Ensuring a collaborator is a member of your repositories
To ensure a user is a member of your repositories:
```bash
node util.js -u DOCKER_USER -p DOCKER_PASS --collaborators user1 user2
```

**NOTE** if you want to only check that a user is a collaborator you can add the `dryrun` flag:
```bash
node util.js -u DOCKER_USER -p DOCKER_PASS --collaborators user1 user2 --dryrun
```

This will only output a warning for each repository that does not have the given collaborator:
```
warn: Repository DOCKER_USER/repo1 does not have user1 as a collaborator
warn: Repository DOCKER_USER/repo1 does not have user2 as a collaborator
warn: Repository DOCKER_USER/repo2 does not have user1 as a collaborator
```

### Checking the visibility of your containers
Not strictly related to the core purpose of this project but this application can check the visibility of your repos to ensure your containers are private.

To run this check you can run:
```bash
node util.js -u DOCKER_USER -p DOCKER_PASS --visibility private
```

This will output a warning for each repository that has public visibility:
```
warn: Repository DOCKER_USER/repo1 is public
warn: Repository DOCKER_USER/repo3 is public
```

Alternatively you can check a single repository:
```bash
node util.js -u DOCKER_USER -p DOCKER_PASS --visibility private --repository REPO_NAME_WITHOUT_USER
```

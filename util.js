var dockerHubAPI = require('docker-hub-api');
var dogapi = require("dogapi");

// Command line arguments
var argv = require('yargs')
  .usage('Usage: $0 -u [username] -p [password]')
  .option('password', {
    alias: 'p',
    describe: 'Docker hub password',
    nargs: 1
  })
  .option('username', {
    alias: 'u',
    describe: 'Docker hub username',
    nargs: 1
  })
  .option('collaborators', {
    alias: 'c',
    describe: 'Collaborators to ensure on each repo',
    array: true
  })
  .option('visibility', {
    alias: 'v',
    describe: 'The maximum visibility level allowed on projects',
    nargs: 1,
    choices: ['public', 'private']
  })
  .option('repository', {
    alias: 'r',
    describe: 'Check only one repository',
    nargs: 1
  })
  .option('dryrun', {
    alias: 'd',
    describe: 'Do not change the repositories, only WARN of required changes',
    count: true
  })
  .option('datadogKey', {
    describe: 'The datadog API key to use when sending metrics',
    nargs: 1
  })
  .option('datadogApp', {
    describe: 'The datadog Application key to use when sending metrics',
    nargs: 1
  })
  .option('verbose', {
    describe: 'Verbose output',
    count: true
  })
  .demand(['u','p'])
  .argv;

// Variables
var collaborators         = [];
var dryRun                = false;
var shouldFlagPublicRepos = false;
var shouldSendStats       = false;
var VERBOSE_LEVEL         = argv.verbose;

INFO("The application will:");

// Check if we should actually action or WARN
if (argv.d > 0) {
  dryRun = true;
}

// Check collaborators
if (argv.c != undefined) {
  collaborators = argv.c;
  if (dryRun) {
    INFO("  - Flag repositories that don't have [" + collaborators + "] as collaborators");
  } else {
    INFO("  - Ensure [" + collaborators + "] are collaborators on all projects");
  }
}

// Check if repos need to be private
if (argv.v === 'private') {
  shouldFlagPublicRepos = true;
  INFO("  - Flag repositories that are public");
}

// Check Datadog arguments
if (argv.datadogApp != undefined && argv.datadogKey != undefined) {
  shouldSendStats = true;
  INFO("  - Send metrics to Datadog");

  var options = { api_key: argv.datadogKey, app_key: argv.datadogApp };
  DEBUG("Logging into Datadog with options: [" + JSON.stringify(options) + "]");
  dogapi.initialize(options);
}

// Start by logging in and checking all the repositories
DEBUG("Logging into Docker with username/password: '" + argv.u+ "' '" + argv.p + "'");
dockerHubAPI.login(argv.u, argv.p).then(function (info) {

  // Now that we are logged in we can list the repos
  if (argv.r === undefined) {
    analyseRepositories(argv.u)
  } else {
    analyseRepo(argv.u, argv.r)
  }
  checkRegistrySettings()

}).catch(function (error) {
  ERROR("Error during login: " + error.message);
});


/**
 * Logging functions.
 */
function ERROR()  { VERBOSE_LEVEL >= 0 && console.log.apply(console, arguments); }
function WARN()   { VERBOSE_LEVEL >= 0 && console.log.apply(console, arguments); }
function INFO()   { VERBOSE_LEVEL >= 0 && console.log.apply(console, arguments); }
function DEBUG()  { VERBOSE_LEVEL >= 2 && console.log.apply(console, arguments); }


/**
 * Analyse all the repositories for a username
 *
 * @param username the Docker username to check
 */
function analyseRepositories(username) {
  dockerHubAPI.repositories(username).then(function (repos) {

    for(var repo in repos){
      analyseRepo(username, repos[repo].name);
    }

  }).catch(function (error) {
    ERROR("Error when fetching all repositories: " + error.message);
  });
}


/**
 * Analyse a Docker repository
 *
 * @param username the Docker username to check
 * @param repository the Docker repository to check
 */
function analyseRepo(username, repository) {
  var repo = null;
  var repoCollaborators = null;

  var repositoryCheck = dockerHubAPI.repository(username, repository).then(function (info) { repo = info; });
  var collaboratorCheck = dockerHubAPI.collaborators(username, repository).then(function (info) { repoCollaborators = info; });

  // Wait for both checks to finish and then run the application checks
  Promise.all([repositoryCheck, collaboratorCheck]).then(function (info) {

    // Check if the repo is private
    if (shouldFlagPublicRepos && !repo.is_private == true) {
      WARN("Repository " + repo.namespace + "/" + repo.name + " is public");
    }

    // Flatten the repo collaborators structure
    var repoCollaboratorsFlattened = [];
    for (var i in repoCollaborators){ repoCollaboratorsFlattened.push(repoCollaborators[i].user); }

    // Check all the required collaborators
    for (var i in collaborators) {
      if (repoCollaboratorsFlattened.indexOf(collaborators[i]) === -1) {
        if (dryRun) {
          WARN("Repository " + repo.namespace + "/" + repo.name + " does not have " + collaborators[i] + " as a collaborator");
        } else {
          Promise.all([dockerHubAPI.addCollaborator(username, repository, collaborators[i])]).catch(function (error) {
            ERROR("Unable to add " + collaborators[i] + " as a collaborator on " + repo.namespace + "/" + repo.name);
          });
        }
      }
    }

  }).catch(function (error) {
    ERROR("Unable to get repo details");
  });
}


function checkRegistrySettings() {

  dockerHubAPI.registrySettings().then(function (info) {

    var privateReposUsedPct = ((info.private_repo_used / info.private_repo_limit) * 100).toFixed(2);
    if (shouldFlagPublicRepos) {
      WARN(info.private_repo_used + "/" + info.private_repo_limit + " (" + privateReposUsedPct + "%) private repositories used");
    }

    if (shouldSendStats) {
      DEBUG("Sending docker.private_repos_used_pct|" + privateReposUsedPct + " to Datadog");
      dogapi.metric.send("docker.private_repos_used_pct", privateReposUsedPct, function(err, results){
        if (results.status == undefined) {
          ERROR("Error while sending data to Datadog: " + err);
          ERROR(results);
        }
      });
    }

  }).catch(function (error) {
    ERROR("Error when fetching all registry settings: " + error.message);
  });
}

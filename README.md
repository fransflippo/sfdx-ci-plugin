ci
==

Configure orgs for continuous integration and deployment

[![Version](https://img.shields.io/npm/v/ci.svg)](https://npmjs.org/package/ci)
[![CircleCI](https://circleci.com/gh/fransflippo/sfdx-ci-plugin/tree/master.svg?style=shield)](https://circleci.com/gh/fransflippo/sfdx-ci-plugin/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/fransflippo/sfdx-ci-plugin?branch=master&svg=true)](https://ci.appveyor.com/project/heroku/sfdx-ci-plugin/branch/master)
[![Codecov](https://codecov.io/gh/fransflippo/sfdx-ci-plugin/branch/master/graph/badge.svg)](https://codecov.io/gh/fransflippo/sfdx-ci-plugin)
[![Greenkeeper](https://badges.greenkeeper.io/fransflippo/sfdx-ci-plugin.svg)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/fransflippo/sfdx-ci-plugin/badge.svg)](https://snyk.io/test/github/fransflippo/sfdx-ci-plugin)
[![Downloads/week](https://img.shields.io/npm/dw/ci.svg)](https://npmjs.org/package/ci)
[![License](https://img.shields.io/npm/l/ci.svg)](https://github.com/fransflippo/sfdx-ci-plugin/blob/master/package.json)

<!-- toc -->
* [Debugging your plugin](#debugging-your-plugin)
<!-- tocstop -->
<!-- install -->
<!-- usage -->
```sh-session
$ npm install -g sfdx-ci-plugin
$ sfdx COMMAND
running command...
$ sfdx (-v|--version|version)
sfdx-ci-plugin/0.0.1 darwin-x64 node-v13.2.0
$ sfdx --help [COMMAND]
USAGE
  $ sfdx COMMAND
...
```
<!-- usagestop -->
<!-- commands -->
* [`sfdx ci:setup [-n <string>] [-p <string>] [-f] [-c <filepath>] [-d <directory>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-cisetup--n-string--p-string--f--c-filepath--d-directory--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx ci:setup [-n <string>] [-p <string>] [-f] [-c <filepath>] [-d <directory>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Sets up an org as the target of a continuous integration pipeline

```
Sets up an org as the target of a continuous integration pipeline

USAGE
  $ sfdx ci:setup [-n <string>] [-p <string>] [-f] [-c <filepath>] [-d <directory>] [-u <string>] [--apiversion 
  <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -c, --certfile=certfile
      path to the X.509 certificate to configure the connected app to use for authentication

  -d, --outputdir=outputdir
      [default: .] path to which the X.509 certificate and private key file will be written

  -f, --force
      overwrite an existing connected app

  -n, --name=name
      [default: Continuous Integration] name of the connected app to create

  -p, --permissionsetname=permissionsetname
      name of the permission set that will determine which users have access to the connected app. If not provided, the 
      permission set will have the same name as the connected app. In either case, the permission set is created if it 
      doesn't exist yet.

  -u, --targetusername=targetusername
      username or alias for the target org; overrides default target org

  --apiversion=apiversion
      override the api version used for api requests made by this command

  --json
      format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)
      [default: warn] logging level for this command invocation

EXAMPLES
  $ sfdx ci:setup --targetusername myOrg@example.com --name "Continuous Integration App" --permissionsetname "Admin 
  Access"
  $ sfdx ci:setup --targetusername myOrg@example.com --certfile mycert.pem
```

_See code: [lib/commands/ci/setup.js](https://github.com/fransflippo/sfdx-ci-plugin/blob/v0.0.1/lib/commands/ci/setup.js)_
<!-- commandsstop -->
<!-- debugging-your-plugin -->
# Debugging your plugin
We recommend using the Visual Studio Code (VS Code) IDE for your plugin development. Included in the `.vscode` directory of this plugin is a `launch.json` config file, which allows you to attach a debugger to the node process when running your commands.

To debug the `hello:org` command: 
1. Start the inspector
  
If you linked your plugin to the sfdx cli, call your command with the `dev-suspend` switch: 
```sh-session
$ sfdx hello:org -u myOrg@example.com --dev-suspend
```
  
Alternatively, to call your command using the `bin/run` script, set the `NODE_OPTIONS` environment variable to `--inspect-brk` when starting the debugger:
```sh-session
$ NODE_OPTIONS=--inspect-brk bin/run hello:org -u myOrg@example.com
```

2. Set some breakpoints in your command code
3. Click on the Debug icon in the Activity Bar on the side of VS Code to open up the Debug view.
4. In the upper left hand corner of VS Code, verify that the "Attach to Remote" launch configuration has been chosen.
5. Hit the green play button to the left of the "Attach to Remote" launch configuration window. The debugger should now be suspended on the first line of the program. 
6. Hit the green play button at the top middle of VS Code (this play button will be to the right of the play button that you clicked in step #5).
<br><img src=".images/vscodeScreenshot.png" width="480" height="278"><br>
Congrats, you are debugging!

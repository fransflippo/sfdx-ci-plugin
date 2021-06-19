sfdx-ci-plugin
==

SFDX plugin to set up a connected app usable for continuous integration with "one click".

This plugin simplifies the process of creating a connected app that you can use with `sfdx auth:jwt:grant`
to non-interactively connect SFDX to a sandbox or production org so that you can deploy your SFDX project.
It:
- creates an RSA private key and an X.509 certificate
- creates a permission set that controls access to the connected app
- creates the connected app and configures it with the X.509 certificate for digital signatures and connects it
  to the permission set

After this, you can connect to the org with a single command:

    sfdx auth:jwt:grant -u user@example.org -f privkey.pem -i <OAuth client id>


[![Version](https://img.shields.io/npm/v/sfdx-ci-plugin.svg)](https://npmjs.org/package/sfdx-ci-plugin)
[![Codecov](https://codecov.io/gh/fransflippo/sfdx-ci-plugin/branch/master/graph/badge.svg)](https://codecov.io/gh/fransflippo/sfdx-ci-plugin)
[![Known Vulnerabilities](https://snyk.io/test/github/fransflippo/sfdx-ci-plugin/badge.svg)](https://snyk.io/test/github/fransflippo/sfdx-ci-plugin)
[![Downloads/week](https://img.shields.io/npm/dw/ci.svg)](https://npmjs.org/package/sfdx-ci-plugin)
[![License](https://img.shields.io/npm/l/ci.svg)](https://github.com/fransflippo/sfdx-ci-plugin/blob/master/package.json)

<!-- toc -->

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

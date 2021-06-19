import { flags, SfdxCommand } from '@salesforce/command';
import { fs, Logger, Messages, SfdxError} from '@salesforce/core';
import {AnyJson} from '@salesforce/ts-types';
import chalk from 'chalk';
import { SaveResult } from 'jsforce';
import * as forge from 'node-forge';
import { ConnectedApp } from '../../types/connectedApp';
import { SaveErrorResult } from '../../types/metadata';
import { PermissionSet } from '../../types/permissionSet';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfdx-ci-plugin', 'setup');

const logger = Logger.childFromRoot('ci');

/**
 * Change an arbitrary string into an API name. API names:
 * - can only contain underscores and alphanumeric characters
 * - must begin with a letter
 * - must not include spaces
 * - must not end with an underscore
 * - must not contain two consecutive underscores
 * @param {string} label
 * @returns {string}
 */
function toApiName(label: string): string {
  const safeChars = label.replace(/[^A-Za-z0-9_]/g, '_');
  const noConsecutiveUnderscores = safeChars.replace(/_{2,}/g, '_');
  const startWithLetter = noConsecutiveUnderscores.replace(/^[^A-Za-z]*/g, '');
  return startWithLetter.replace(/_+$/, '');
}

export default class Setup extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    '$ sfdx ci:setup --targetusername myOrg@example.com --name "Continuous Integration App" --permissionsetname "Admin Access"',
    '$ sfdx ci:setup --targetusername myOrg@example.com --certfile mycert.pem'
  ];

  // Command line options

  protected static flagsConfig = {
    name: flags.string({
      char: 'n',
      description: messages.getMessage('nameFlagDescription'),
      default: 'Continuous Integration'
    }),
    permissionsetname: flags.string({
      char: 'p',
      description: messages.getMessage('permissionsetnameFlagDescription')
    }),
    force: flags.boolean({
      char: 'f',
      description: messages.getMessage('forceFlagDescription')
    }),
    certfile: flags.filepath({
      char: 'c',
      description: messages.getMessage('certfileFlagDescription')
    }),
    outputdir: flags.directory({
      char: 'd',
      description: messages.getMessage('outputdirFlagDescription'), default: '.'
    })
  };

  protected static requiresUsername = true;

  public async run(): Promise<AnyJson> {
    const connection = this.org.getConnection();
    const connectedAppName: string = this.flags.name;
    const permissionSetName: string = this.flags.permissionsetname || connectedAppName;
    const certfile: string = this.flags.certfile;

    let certificatePem: string;
    if (certfile != null) {
      certificatePem = await fs.readFile(certfile);
    } else {
      certificatePem = this.generateCertificate();
    }

    const results = await connection.query(`SELECT COUNT() FROM PermissionSet WHERE Name = '${permissionSetName}'`).execute();
    if (results.totalSize === 0) {
      // Permission set doesn't get exist, create
      await this.createPermissionSet(permissionSetName, connectedAppName);
    }
    // Create the ConnectedApp
    await this.createConnectedApp(connectedAppName, permissionSetName, certificatePem);

    // Return an object to be displayed with --json
    return {
      name: connectedAppName,
      certificatePem
    };
  }

  /**
   * Generates a private key and a certificate signed with that key
   * @returns {string}
   */
  private generateCertificate(): string {
    const pki = forge.pki;

    // Create key pair
    this.ux.startSpinner(chalk.whiteBright(messages.getMessage('generatingKeyPair')));
    const keys = pki.rsa.generateKeyPair(2048);
    this.ux.stopSpinner(chalk.green(messages.getMessage('ok')));
    const privateKeyPem = pki.privateKeyToPem(keys.privateKey);
    this.ux.log(chalk.gray(privateKeyPem));

    // Create certificate
    this.ux.startSpinner(chalk.whiteBright(messages.getMessage('generatingSelfSignedCert')));
    const cert = pki.createCertificate();
    cert.publicKey = keys.publicKey;

    // Sign certificate
    cert.sign(keys.privateKey);

    // Convert certificate to PEM format
    const certificatePem = pki.certificateToPem(cert);
    this.ux.stopSpinner(chalk.green(messages.getMessage('ok')));

    this.ux.log(chalk.gray(certificatePem));
    return certificatePem;
  }

  /**
   * Creates a permission set
   * @param {string} permissionSetName
   * @param {string} connectedAppName the connected app that the permission set will give access to: used to add a
   *                                  meaningful description to the permission set
   * @returns {Promise<void>}
   */
  private async createPermissionSet(permissionSetName: string, connectedAppName: string) {
    const connection = this.org.getConnection();
    this.ux.startSpinner(chalk.whiteBright(`Permission set "${permissionSetName}" doesn't exist; creating`));
    const permissionSet: PermissionSet = {
      fullName: toApiName(permissionSetName),
      label: permissionSetName,
      description: `Permission set for the ${connectedAppName} connected app`
    };
    const saveResult = await connection.metadata
      .create('PermissionSet', permissionSet)
      .catch(error => {
        return {
          fullName: permissionSetName,
          success: false,
          errors: {
            message: error.toString()
          }
        };
      });
    if (Array.isArray(saveResult)) {
      throw new Error('Expected a single SaveResult but got: ' + saveResult);
    }
    if (!saveResult.success) {
      this.ux.stopSpinner(chalk.red(messages.getMessage('failed')));
      logger.debug(JSON.stringify(saveResult));
      const errorResult = saveResult as SaveErrorResult;
      if (Array.isArray(errorResult.errors)) {
        throw new SfdxError(errorResult.errors.map(error => error.fields + ': ' + error.message).join('\n'));
      } else {
        throw new SfdxError(errorResult.errors.fields + ': ' + errorResult.errors.message);
      }
    }
    this.ux.stopSpinner(chalk.green(messages.getMessage('ok')));
  }

  /**
   * Creates a connected app
   * @param {string} connectedAppName
   * @param {string} permissionSetName
   * @param {string} certificatePem
   * @returns {Promise<void>}
   */
  private async createConnectedApp(connectedAppName: string, permissionSetName: string, certificatePem: string) {
    const conn = this.org.getConnection();
    this.ux.startSpinner(chalk.whiteBright(messages.getMessage('creatingConnectedApp')));
    const connectedApp: ConnectedApp = {
      fullName: toApiName(connectedAppName),
      label: connectedAppName,
      description: 'Connected app used by continuous integration to deploy new versions of metadata',
      contactEmail: conn.getUsername(),
      permissionSetName,
      oauthConfig: {
        callbackUrl: 'http://localhost',
        certificate: certificatePem,
        isAdminApproved: true,
        scopes: [
          'Api',
          'Full'
        ]
      },
      oauthPolicy: {
        ipRelaxation: 'BYPASS'
      }
    };
    const saveResult: SaveResult | SaveResult[] = await conn.metadata
      .create('ConnectedApp', connectedApp)
      .catch(error => {
        return {
          fullName: connectedAppName,
          success: false,
          errors: {
            message: error.toString()
          }
        };
      });
    if (Array.isArray(saveResult)) {
      throw new Error('Expected a single SaveResult but got: ' + saveResult);
    }
    if (!saveResult.success) {
      this.ux.stopSpinner(chalk.red(messages.getMessage('failed')));
      logger.debug(JSON.stringify(saveResult));
      const errorResult = saveResult as SaveErrorResult;
      if (Array.isArray(errorResult.errors)) {
        throw new SfdxError(errorResult.errors.map(error => error.fields + ': ' + error.message).join('\n'));
      } else {
        throw new SfdxError(errorResult.errors.fields + ': ' + errorResult.errors.message);
      }
    }
    this.ux.stopSpinner(chalk.green(messages.getMessage('ok')));
  }
}

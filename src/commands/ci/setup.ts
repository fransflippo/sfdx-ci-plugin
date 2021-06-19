import { flags, SfdxCommand } from '@salesforce/command';
import {fs, Logger, Messages, Org, SfdxError} from '@salesforce/core';
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

const certOutFile = 'cert.pem';
const keyOutFile = 'server.key';

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

class CertificateAndPrivateKey {
  public certificatePem: string;
  public privateKeyPem?: string;

  constructor(certificatePem: string, privateKeyPem?: string) {
    this.certificatePem = certificatePem;
    this.privateKeyPem = privateKeyPem;
  }
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
    const outputdir = this.flags.outputdir;

    // Check that connected app doesn't already exist
    let deleteExistingConnectedApp = false;
    const readResult = await connection.metadata.read('ConnectedApp', toApiName(connectedAppName));
    if (!Array.isArray(readResult) && readResult.fullName) {
      if (this.flags.force) {
        deleteExistingConnectedApp = true;  // We'll only delete it right before creating the new one
      } else {
        throw new SfdxError('Connected app "' + toApiName(connectedAppName) + '" already exists. Please choose a different name.');
      }
    }

    // Generate the certificate and private key
    let certificateAndPrivateKey: CertificateAndPrivateKey;
    if (certfile != null) {
      const certificatePem = await fs.readFile(certfile);
      certificateAndPrivateKey = new CertificateAndPrivateKey(certificatePem);
    } else {
      certificateAndPrivateKey = this.generateCertificate(outputdir);
    }

    // Create the permission set, if needed
    const permissionSetCountResults = await connection.query(`SELECT COUNT() FROM PermissionSet WHERE Name = '${toApiName(permissionSetName)}'`).execute();
    if (permissionSetCountResults.totalSize === 0) {
      // Permission set doesn't get exist, create
      await this.createPermissionSet(permissionSetName, connectedAppName);
    }
    await this.assignPermissionSet(permissionSetName);

    // Create the ConnectedApp
    const consumerKey = await this.createConnectedApp(connectedAppName, permissionSetName, certificateAndPrivateKey.certificatePem, deleteExistingConnectedApp);

    const loginUrl = this.org.getField(Org.Fields.LOGIN_URL).toString();
    this.ux.log(chalk.bold(chalk.whiteBright('\nCongratulations! Your connected app is ready for use. To connect, use the following command:\n')));
    this.ux.log(chalk.whiteBright(`    sfdx auth:jwt:grant -u ${this.org.getUsername()} -f ${outputdir}/${keyOutFile} -i ${consumerKey} -r ${loginUrl}\n`));
    this.ux.log(chalk.bold(chalk.whiteBright(`\nWe\'ve gone ahead and assigned ${this.org.getUsername()} to the ${permissionSetName} permission set,`)));
    this.ux.log(chalk.bold(chalk.whiteBright('but if you want to connect as another user, e.g. otheruser@example.org, you can give them access to')));
    this.ux.log(chalk.bold(chalk.whiteBright('the connected app by assigning the permission set using:\n')));
    this.ux.log(chalk.whiteBright(`    sfdx force:user:permset:assign -n ${toApiName(permissionSetName)} -o otheruser@example.org\n`));

    // Return an object to be displayed with --json
    return {
      connectedAppName,
      consumerKey,
      certificatePem: certificateAndPrivateKey.certificatePem,
      privateKeyPem: certificateAndPrivateKey.privateKeyPem
    };
  }

  /**
   * Generates a private key and a certificate signed with that key
   * @returns {string}
   */
  private generateCertificate(outputDir: string): CertificateAndPrivateKey {
    const pki = forge.pki;

    // Create key pair
    this.ux.startSpinner(chalk.whiteBright(messages.getMessage('generatingKeyPair')));
    const keys = pki.rsa.generateKeyPair(2048);
    this.ux.stopSpinner(chalk.green(messages.getMessage('ok')));
    const privateKeyPem = pki.privateKeyToPem(keys.privateKey);
    // this.ux.log(chalk.gray(privateKeyPem));
    fs.writeFile(`${outputDir}/${keyOutFile}`, privateKeyPem);
    this.ux.log(`Wrote private key to ${outputDir}/${keyOutFile}`);

    // Create certificate
    this.ux.startSpinner(chalk.whiteBright(messages.getMessage('generatingSelfSignedCert')));
    const cert = pki.createCertificate();
    cert.publicKey = keys.publicKey;
    const attrs = [{
      name: 'commonName',
      value: 'example.org'
    }, {
      name: 'countryName',
      value: '000'
    }, {
      shortName: 'ST',
      value: 'None'
    }, {
      name: 'localityName',
      value: 'None'
    }, {
      name: 'organizationName',
      value: 'Certificate generated by sfdx-ci-plugin using Forge'
    }, {
      shortName: 'OU',
      value: 'https://github.com/fransflippo/sfdx-ci-plugin'
    }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.version = 0;
    // Sign certificate
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // Convert certificate to PEM format
    const certificatePem = pki.certificateToPem(cert);
    this.ux.stopSpinner(chalk.green(messages.getMessage('ok')));
    // this.ux.log(chalk.gray(certificatePem));
    fs.writeFile(`${outputDir}/${certOutFile}`, certificatePem);
    this.ux.log(`Wrote certificate to ${outputDir}/${certOutFile}`);

    return new CertificateAndPrivateKey(certificatePem, privateKeyPem);
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
   * Assigns the permission set with the given name to the current user
   * @param {string} permissionSetName
   * @returns {Promise<void>}
   */
  private async assignPermissionSet(permissionSetName: string) {
    interface PermissionSetRecord {
      Id: string;
      Name: string;
    }

    const connection = this.org.getConnection();

    // Find the permission set id
    const identityInfo = await connection.identity();
    const permissionSetResults = await connection.query<PermissionSetRecord>(`SELECT Id, Name from PermissionSet WHERE Name = '${toApiName(permissionSetName)}'`);
    const permissionSetId = permissionSetResults.records[0].Id;

    // Assign current user to the permission set
    const userId = identityInfo.user_id;
    this.ux.startSpinner(chalk.whiteBright(`Assigning permission set "${permissionSetName}" to ${identityInfo.username}`));
    await connection
      .create('PermissionSetAssignment', {
        PermissionSetId: permissionSetId,
        AssigneeId: userId
      })
      .catch(error => {
        if (error.name === 'DUPLICATE_VALUE') {
          // Ignore: we just want to make sure the assignment is there, and apparently it is.
        } else {
          this.ux.stopSpinner(chalk.red(messages.getMessage('failed')));
          throw new Error(error);
        }
      });
    this.ux.stopSpinner(chalk.green(messages.getMessage('ok')));
  }

  /**
   * Creates a connected app
   * @param {string} connectedAppName
   * @param {string} permissionSetName
   * @param {string} certificatePem
   * @returns {Promise<string>} the new connected app's consumer id (OAuth client id)
   */
  private async createConnectedApp(connectedAppName: string, permissionSetName: string, certificatePem: string, replaceExistingConnectedApp: boolean): Promise<string> {
    const connection = this.org.getConnection();
    const fullName = toApiName(connectedAppName);

    if (replaceExistingConnectedApp) {
      await connection.metadata
        .delete('ConnectedApp', toApiName(connectedAppName))
        .catch(error => this.ux.warn(`Unable to delete existing connected app "${connectedAppName}". The next step will most likely fail.`));
    }

    this.ux.startSpinner(chalk.whiteBright(messages.getMessage('creatingConnectedApp')));
    const connectedApp: ConnectedApp = {
      fullName,
      label: connectedAppName,
      description: 'Connected app used by continuous integration to deploy new versions of metadata',
      contactEmail: connection.getUsername(),
      permissionSetName,
      oauthConfig: {
        callbackUrl: 'http://localhost:1717/OauthRedirect',
        certificate: certificatePem,
        isAdminApproved: true,
        isConsumerSecretOptional: true,
        scopes: [
          'Api',
          'Web',
          'RefreshToken'
        ]
      },
      oauthPolicy: {
        ipRelaxation: 'BYPASS',
        refreshTokenPolicy: 'infinite'
      }
    };
    const saveResult: SaveResult | SaveResult[] = await connection.metadata
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

    // Get the new connected app's client id
    const readResult = await connection.metadata.read('ConnectedApp', fullName);
    const readConnectedApp = readResult as ConnectedApp;
    return readConnectedApp.oauthConfig.consumerKey;
  }
}

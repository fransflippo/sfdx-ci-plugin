import { flags, SfdxCommand } from '@salesforce/command';
import {fs, Messages, Org, SfdxError} from '@salesforce/core';
import {AnyJson} from '@salesforce/ts-types';
import chalk from 'chalk';
import {CertificateAndPrivateKey} from '../../shared/certificateGenerator';
import certificateGenerator from '../../shared/certificateGenerator';
import connectedAppHelper from '../../shared/connectedAppHelper';
import permissionSetHelper from '../../shared/permissionSetHelper';
import { toApiName } from '../../shared/sfdx-utils';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfdx-ci-plugin', 'setup');

const certOutFile = 'cert.pem';
const keyOutFile = 'server.key';

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
    const connectedAppName: string = this.flags.name;
    const permissionSetName: string = this.flags.permissionsetname || connectedAppName;
    const certfile: string = this.flags.certfile;
    const outputdir = this.flags.outputdir;

    // Check that connected app doesn't already exist
    let deleteExistingConnectedApp = false;
    if (await connectedAppHelper.connectedAppExists(this.org, connectedAppName)) {
      if (this.flags.force) {
        deleteExistingConnectedApp = true;  // We'll only delete it right before creating the new one
      } else {
        throw new SfdxError(messages.getMessage('connectedAppExists', [ toApiName(connectedAppName) ]));
      }
    }

    // Generate the certificate and private key and write to files
    let certificateAndPrivateKey: CertificateAndPrivateKey;
    if (certfile != null) {
      const buffer = await fs.readFile(certfile);
      const certificatePem = buffer.toString();
      certificateAndPrivateKey = new CertificateAndPrivateKey(certificatePem);
    } else {
      certificateAndPrivateKey = await certificateGenerator.generateCertificateAndPrivateKey({
        beforeGeneratePrivateKey: async function() {
          this.ux.startSpinner(chalk.whiteBright(messages.getMessage('generatingKeyPair')));
        }.bind(this),
        onGeneratePrivateKey: async function(privateKeyPem: string) {
          this.ux.stopSpinner(chalk.green(messages.getMessage('ok')));
          // this.ux.log(chalk.gray(privateKeyPem));
          const keyOutPath = outputdir + '/' + keyOutFile;
          this.ux.startSpinner(messages.getMessage('writingPrivateKey', [ keyOutPath ]));
          await fs.writeFile(keyOutPath, privateKeyPem);
          this.ux.stopSpinner(chalk.green(messages.getMessage('ok')));
        }.bind(this),
        beforeGenerateCertificate: async function() {
          this.ux.startSpinner(chalk.whiteBright(messages.getMessage('generatingSelfSignedCert')));
        }.bind(this),
        onGenerateCertificate: async function(certificatePem: string) {
          this.ux.stopSpinner(chalk.green(messages.getMessage('ok')));
          // this.ux.log(chalk.gray(certificatePem));
          const certOutPath = outputdir + '/' + certOutFile;
          this.ux.startSpinner(messages.getMessage('writingCertificate', [ certOutPath ]));
          await fs.writeFile(certOutPath, certificatePem);
          this.ux.stopSpinner(chalk.green(messages.getMessage('ok')));
        }.bind(this)
      });
    }

    // Create the permission set, if needed
    this.ux.startSpinner(chalk.whiteBright(`Creating permission set "${permissionSetName}"`));
    await permissionSetHelper
      .createPermissionSet(this.org, permissionSetName, connectedAppName)
      .catch(e => {
        this.ux.stopSpinner(chalk.red(messages.getMessage('failed')));
        throw e;
      })
      .then(created => {
        if (created) {
          this.ux.stopSpinner(chalk.green(messages.getMessage('ok')));
        } else {
          this.ux.stopSpinner(chalk.yellow(messages.getMessage('alreadyExists')));
        }
      });
    // Assign permission set to current user
    const identityInfo = await this.org.getConnection().identity();
    const userId = identityInfo.user_id;
    this.ux.startSpinner(chalk.whiteBright(messages.getMessage('assigningPermissionSet', [ permissionSetName, identityInfo.username ])));
    await permissionSetHelper
      .assignPermissionSet(this.org, permissionSetName, userId)
      .catch(e => {
        this.ux.stopSpinner(chalk.red(messages.getMessage('failed')));
        throw e;
      })
      .then(() => {
        this.ux.stopSpinner(chalk.green(messages.getMessage('ok')));
      });

    // Create the ConnectedApp
    this.ux.startSpinner(chalk.whiteBright(messages.getMessage('creatingConnectedApp')));
    const consumerKey = await connectedAppHelper
      .createConnectedApp(this.org, connectedAppName, permissionSetName, certificateAndPrivateKey.certificatePem, deleteExistingConnectedApp)
      .catch(e => {
        this.ux.stopSpinner(chalk.red(messages.getMessage('failed')));
        throw e;
      })
      .then(returnValue => {
        this.ux.stopSpinner(chalk.green(messages.getMessage('ok')));
        return returnValue;
      });

    const loginUrl = this.org.getField(Org.Fields.LOGIN_URL).toString();
    this.ux.log(chalk.bold(chalk.whiteBright('\nCongratulations! Your connected app is ready for use. To connect, use the following command:\n')));
    this.ux.log(
      chalk.yellowBright('    sfdx') +
      chalk.green(' auth:jwt:grant') +
      chalk.cyan(' -u ') + chalk.magenta(this.org.getUsername()) +
      chalk.cyan(' -f ') + chalk.magenta(`${outputdir}/${keyOutFile}`) +
      chalk.cyan(' -i ') + chalk.magenta(consumerKey) +
      chalk.cyan(' -r ') + chalk.magenta(loginUrl));
    this.ux.log(chalk.bold(chalk.whiteBright('\nWe\'ve gone ahead and assigned ')) +
      chalk.magenta(this.org.getUsername()) + chalk.bold(chalk.whiteBright(' to the ')) +
      chalk.magenta(permissionSetName)  + chalk.bold(chalk.whiteBright(' permission set,'))
    );
    this.ux.log(chalk.bold(chalk.whiteBright('but if you want to connect as another user, e.g. otheruser@example.org, you can give them access to')));
    this.ux.log(chalk.bold(chalk.whiteBright('the connected app by assigning the permission set using:\n')));
    this.ux.log(
      chalk.yellowBright('    sfdx') +
      chalk.green(' force:user:permset:assign') +
      chalk.cyan(' -n ') + chalk.magenta(toApiName(permissionSetName)) +
      chalk.cyan(' -o ') + chalk.magenta('otheruser@example.org'));
    this.ux.log(chalk.bold(chalk.whiteBright('\nYou\'ll want to store the ' + chalk.magentaBright(`${outputdir}/${keyOutFile}`) + chalk.whiteBright(' private key in your continuous integration tool\'s'))));
    this.ux.log(chalk.bold(chalk.whiteBright('secrets (e.g. Jenkins\'s "Credentials"), or encrypt it using a third-party tool like Ansible Vault')));
    this.ux.log(chalk.bold(chalk.whiteBright('and store the third party tool\'s encryption key in your continuous integration tool\'s secrets.')));
    this.ux.log(chalk.bold(chalk.yellowBright(chalk.underline('\nMake sure you don\'t check the private key in to version control in clear text!\n'))));

    // Return an object to be displayed with --json
    return {
      connectedAppName,
      permissionSetName,
      consumerKey,
      certificatePem: certificateAndPrivateKey.certificatePem,
      privateKeyPem: certificateAndPrivateKey.privateKeyPem
    };
  }

}

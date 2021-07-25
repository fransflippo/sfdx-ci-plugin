import {$$, expect, test} from '@salesforce/command/lib/test';
import {stubMethod} from '@salesforce/ts-sinon';
import chai = require('chai');
import * as fs from 'fs';
import {Connection, IdentityInfo} from 'jsforce';
import Metadata = require('jsforce/lib/api/metadata');
import sinon = require('sinon');
import {SinonStub} from 'sinon';
import sinonChai = require('sinon-chai');
import stripAnsi = require('strip-ansi');
import certificateGenerator from '../../../lib/helpers/certificateGenerator';
import requireForNyc = require('../../../src/commands/ci/setup');
import {GenerateCertificateCallback} from '../../../src/helpers/certificateGenerator';

chai.use(sinonChai);

describe('ci:setup', () => {
  let metadataReadStub: SinonStub;
  let metadataCreateStub: SinonStub;
  let metadataDeleteStub: SinonStub;
  let connectionQueryStub: SinonStub;
  let connectionIdentityStub: SinonStub;
  let connectionCreateStub: SinonStub;

  const userId = 'user123';
  const username = 'User 123';

  test
    .withOrg({ username: 'user@example.org' }, true)
    .do(ctx => {
      connectionIdentityStub = stubMethod($$.SANDBOX, Connection.prototype, 'identity');
      connectionCreateStub = stubMethod($$.SANDBOX, Connection.prototype, 'create');
      metadataReadStub = stubMethod($$.SANDBOX, Metadata.prototype, 'read');
      metadataCreateStub = stubMethod($$.SANDBOX, Metadata.prototype, 'create');
      connectionQueryStub = stubMethod($$.SANDBOX, Connection.prototype, 'query');
      connectionIdentityStub.resolves({ user_id: userId, username } as IdentityInfo);
      metadataReadStub.withArgs('ConnectedApp', 'Continuous_Integration').onFirstCall().resolves({});
      metadataCreateStub.withArgs('PermissionSet', { fullName: 'Continuous_Integration', label: 'Continuous Integration', description: 'Permission set for the Continuous Integration connected app'}).resolves({success: true, fullName: 'Continuous_Integration'});
      connectionQueryStub.withArgs("SELECT Id, Name from PermissionSet WHERE Name = 'Continuous_Integration'").resolves({ done: true, totalSize: 1, records: [ { Id: 'PermissionSetId' } ]});
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      connectionCreateStub.withArgs('PermissionSetAssignment', { PermissionSetId: 'PermissionSetId', AssigneeId: 'user123'}).resolves({ success: true });
      metadataCreateStub.withArgs('ConnectedApp', sinon.match.any).resolves({success: true });
      metadataReadStub.withArgs('ConnectedApp', 'Continuous_Integration').onSecondCall().resolves({
        oauthConfig: {
          consumerKey: 'APPKEY'
        }
      });
      stubMethod($$.SANDBOX, certificateGenerator, 'generateCertificateAndPrivateKey').callsFake(async (callback: GenerateCertificateCallback) => {
        await callback.beforeGeneratePrivateKey();
        await callback.onGeneratePrivateKey('KEY');
        await callback.beforeGenerateCertificate();
        await callback.onGenerateCertificate('CERT');
        return Promise.resolve({
          certificatePem: 'CERT',
          privateKeyPem: 'KEY'
        });
      });
    })
    .stdout()
    .stderr()
    .command(['ci:setup', '--targetusername', 'user@example.org'])
    .it('should generate a certificate and configure a connected app', ctx => {
      expect(stripAnsi(ctx.stdout)).to.contain(`
Congratulations! Your connected app is ready for use. To connect, use the following command:

    sfdx auth:jwt:grant -u user@example.org -f ./server.key -i APPKEY -r https://login.salesforce.com

We've gone ahead and assigned user@example.org to the Continuous Integration permission set,
but if you want to connect as another user, e.g. otheruser@example.org, you can give them access to
the connected app by assigning the permission set using:

    sfdx force:user:permset:assign -n Continuous_Integration -o otheruser@example.org
`);

      // Verify that the connected app was created
      expect(metadataCreateStub).to.have.been.calledWith('ConnectedApp', {
        fullName: 'Continuous_Integration',
        label: 'Continuous Integration',
        description: 'Connected app used by continuous integration to deploy new versions of metadata',
        contactEmail: 'user@example.org',
        permissionSetName: 'Continuous Integration',
        oauthConfig: {
          callbackUrl: 'http://localhost:1717/OauthRedirect',
          certificate: 'CERT',
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
      });
      const keyData = fs.readFileSync('./server.key').toString();
      const certData = fs.readFileSync('./cert.pem').toString();
      expect(keyData).to.equal('KEY');
      expect(certData).to.equal('CERT');
    });

  test
    .withOrg({ username: 'user@example.org' }, true)
    .do(ctx => {
      connectionIdentityStub = stubMethod($$.SANDBOX, Connection.prototype, 'identity');
      metadataReadStub = stubMethod($$.SANDBOX, Metadata.prototype, 'read');
      connectionQueryStub = stubMethod($$.SANDBOX, Connection.prototype, 'query');
      metadataCreateStub = stubMethod($$.SANDBOX, Metadata.prototype, 'create');
      connectionIdentityStub.resolves({ user_id: userId, username } as IdentityInfo);
      metadataReadStub.withArgs('ConnectedApp', 'Continuous_Integration').onFirstCall().resolves({});
      metadataCreateStub.withArgs('PermissionSet', { fullName: 'Continuous_Integration', label: 'Continuous Integration', description: 'Permission set for the Continuous Integration connected app'}).resolves({success: true, fullName: 'Continuous_Integration'});
      connectionQueryStub.withArgs("SELECT Id, Name from PermissionSet WHERE Name = 'Continuous_Integration'").resolves({ done: true, totalSize: 1, records: [ { Id: 'PermissionSetId' } ]});
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      stubMethod($$.SANDBOX, Connection.prototype, 'create').withArgs('PermissionSetAssignment', { PermissionSetId: 'PermissionSetId', AssigneeId: 'user123'}).resolves({ success: true });
      metadataCreateStub.withArgs('ConnectedApp', sinon.match.any).resolves({success: true });
      metadataReadStub.withArgs('ConnectedApp', 'Continuous_Integration').onSecondCall().resolves({
        oauthConfig: {
          consumerKey: 'APPKEY'
        }
      });
      // Instead of faking fs.readFile, rather just put an actual file in place
      fs.writeFileSync('mycert.pem', Buffer.from('MYCERT'));
    })
    .stdout()
    .stderr()
    .command(['ci:setup', '--targetusername', 'user@example.org', '--certfile', 'mycert.pem'])
    .it('should use an existing certificate when provided and configure a connected app', ctx => {
      expect(stripAnsi(ctx.stdout)).to.contain(`
Congratulations! Your connected app is ready for use. To connect, use the following command:

    sfdx auth:jwt:grant -u user@example.org -f ./server.key -i APPKEY -r https://login.salesforce.com

We've gone ahead and assigned user@example.org to the Continuous Integration permission set,
but if you want to connect as another user, e.g. otheruser@example.org, you can give them access to
the connected app by assigning the permission set using:

    sfdx force:user:permset:assign -n Continuous_Integration -o otheruser@example.org
`);

      // Verify that the connected app was created
      expect(metadataCreateStub).to.have.been.calledWith('ConnectedApp', {
        fullName: 'Continuous_Integration',
        label: 'Continuous Integration',
        description: 'Connected app used by continuous integration to deploy new versions of metadata',
        contactEmail: 'user@example.org',
        permissionSetName: 'Continuous Integration',
        oauthConfig: {
          callbackUrl: 'http://localhost:1717/OauthRedirect',
          certificate: 'MYCERT',
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
      });
    });

  test
    .withOrg({ username: 'user@example.org' }, true)
    .do(() => {
      expect(requireForNyc).to.not.be.null;
    })
    .do(ctx => {
      metadataReadStub = stubMethod($$.SANDBOX, Metadata.prototype, 'read');
      metadataReadStub.withArgs('ConnectedApp', 'Continuous_Integration').resolves({fullName: 'Continuous_Integration'});
    })
    .stdout()
    .stderr()
    .command(['ci:setup', '--targetusername', 'user@example.org'])
    .it('should report an error when the connected app already exists', ctx => {
      expect(ctx.stderr).to.contain('Connected app "Continuous_Integration" already exists. Please choose a different name.');
    });

  test
    .withOrg({ username: 'user@example.org' }, true)
    .do(() => {
      expect(requireForNyc).to.not.be.null;
    })
    .do(ctx => {
      metadataReadStub = stubMethod($$.SANDBOX, Metadata.prototype, 'read');
      metadataCreateStub = stubMethod($$.SANDBOX, Metadata.prototype, 'create');
      connectionQueryStub = stubMethod($$.SANDBOX, Connection.prototype, 'query');
      connectionIdentityStub = stubMethod($$.SANDBOX, Connection.prototype, 'identity');
      metadataReadStub.withArgs('ConnectedApp', 'Continuous_Integration').onFirstCall().resolves({fullName: 'Continuous_Integration'});
      connectionIdentityStub.resolves({ user_id: userId, username } as IdentityInfo);
      metadataCreateStub.withArgs('PermissionSet', { fullName: 'Continuous_Integration', label: 'Continuous Integration', description: 'Permission set for the Continuous Integration connected app'}).resolves({success: true, fullName: 'Continuous_Integration'});
      connectionQueryStub.withArgs("SELECT Id, Name from PermissionSet WHERE Name = 'Continuous_Integration'").resolves({ done: true, totalSize: 1, records: [ { Id: 'PermissionSetId' } ]});
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      stubMethod($$.SANDBOX, Connection.prototype, 'create').withArgs('PermissionSetAssignment', { PermissionSetId: 'PermissionSetId', AssigneeId: 'user123'}).resolves({ success: true });
      metadataCreateStub.withArgs('ConnectedApp', sinon.match.any).resolves({success: true });
      metadataReadStub.withArgs('ConnectedApp', 'Continuous_Integration').onSecondCall().resolves({
        oauthConfig: {
          consumerKey: 'APPKEY'
        }
      });
      stubMethod($$.SANDBOX, certificateGenerator, 'generateCertificateAndPrivateKey').callsFake(async (callback: GenerateCertificateCallback) => {
        await callback.beforeGeneratePrivateKey();
        await callback.onGeneratePrivateKey('KEY');
        await callback.beforeGenerateCertificate();
        await callback.onGenerateCertificate('CERT');
        return Promise.resolve({
          certificatePem: 'CERT',
          privateKeyPem: 'KEY'
        });
      });
      metadataDeleteStub = stubMethod($$.SANDBOX, Metadata.prototype, 'delete');
      metadataDeleteStub.withArgs('ConnectedApp', 'Continuous_Integration').resolves({success: true});
    })
    .stdout()
    .stderr()
    .command(['ci:setup', '--targetusername', 'user@example.org', '-f'])
    .it('should replace an existing connected app when explicitly requested', ctx => {
      expect(stripAnsi(ctx.stdout)).to.contain(`
Congratulations! Your connected app is ready for use. To connect, use the following command:

    sfdx auth:jwt:grant -u user@example.org -f ./server.key -i APPKEY -r https://login.salesforce.com

We've gone ahead and assigned user@example.org to the Continuous Integration permission set,
but if you want to connect as another user, e.g. otheruser@example.org, you can give them access to
the connected app by assigning the permission set using:

    sfdx force:user:permset:assign -n Continuous_Integration -o otheruser@example.org
`);
      // Verify that the existing connected app was deleted
      expect(metadataDeleteStub).to.have.been.calledWith('ConnectedApp', 'Continuous_Integration');
      // Verify that the connected app was created
      expect(metadataCreateStub).to.have.been.calledWith('ConnectedApp', {
        fullName: 'Continuous_Integration',
        label: 'Continuous Integration',
        description: 'Connected app used by continuous integration to deploy new versions of metadata',
        contactEmail: 'user@example.org',
        permissionSetName: 'Continuous Integration',
        oauthConfig: {
          callbackUrl: 'http://localhost:1717/OauthRedirect',
          certificate: 'CERT',
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
      });
    });

  test
    .withOrg({ username: 'user@example.org' }, true)
    .do(() => {
      expect(requireForNyc).to.not.be.null;
    })
    .do(ctx => {
      metadataReadStub = stubMethod($$.SANDBOX, Metadata.prototype, 'read');
      metadataCreateStub = stubMethod($$.SANDBOX, Metadata.prototype, 'create');
      connectionQueryStub = stubMethod($$.SANDBOX, Connection.prototype, 'query');
      connectionIdentityStub = stubMethod($$.SANDBOX, Connection.prototype, 'identity');
      metadataReadStub.withArgs('ConnectedApp', 'Continuous_Integration').onFirstCall().resolves({});
      connectionIdentityStub.resolves({ user_id: userId, username } as IdentityInfo);
      const error = new Error();
      error.name = 'DUPLICATE_VALUE';
      metadataCreateStub.withArgs('PermissionSet', { fullName: 'Continuous_Integration', label: 'Continuous Integration', description: 'Permission set for the Continuous Integration connected app'}).rejects(error);
      connectionQueryStub.withArgs("SELECT Id, Name from PermissionSet WHERE Name = 'Continuous_Integration'").resolves({ done: true, totalSize: 1, records: [ { Id: 'PermissionSetId' } ]});
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      stubMethod($$.SANDBOX, Connection.prototype, 'create').withArgs('PermissionSetAssignment', { PermissionSetId: 'PermissionSetId', AssigneeId: 'user123'}).resolves({ success: true });
      metadataCreateStub.withArgs('ConnectedApp', sinon.match.any).resolves({success: true });
      metadataReadStub.withArgs('ConnectedApp', 'Continuous_Integration').onSecondCall().resolves({
        oauthConfig: {
          consumerKey: 'APPKEY'
        }
      });
      stubMethod($$.SANDBOX, certificateGenerator, 'generateCertificateAndPrivateKey').callsFake(async (callback: GenerateCertificateCallback) => {
        await callback.beforeGeneratePrivateKey();
        await callback.onGeneratePrivateKey('KEY');
        await callback.beforeGenerateCertificate();
        await callback.onGenerateCertificate('CERT');
        return Promise.resolve({
          certificatePem: 'CERT',
          privateKeyPem: 'KEY'
        });
      });
    })
    .stdout()
    .stderr()
    .command(['ci:setup', '--targetusername', 'user@example.org', '-f'])
    .it('should ignore when the permission set already exists', ctx => {
      expect(stripAnsi(ctx.stdout)).to.contain(`
Congratulations! Your connected app is ready for use. To connect, use the following command:

    sfdx auth:jwt:grant -u user@example.org -f ./server.key -i APPKEY -r https://login.salesforce.com

We've gone ahead and assigned user@example.org to the Continuous Integration permission set,
but if you want to connect as another user, e.g. otheruser@example.org, you can give them access to
the connected app by assigning the permission set using:

    sfdx force:user:permset:assign -n Continuous_Integration -o otheruser@example.org
`);
      // Verify that the existing connected app was deleted
      expect(metadataDeleteStub).to.have.been.calledWith('ConnectedApp', 'Continuous_Integration');
      // Verify that the connected app was created
      expect(metadataCreateStub).to.have.been.calledWith('ConnectedApp', {
        fullName: 'Continuous_Integration',
        label: 'Continuous Integration',
        description: 'Connected app used by continuous integration to deploy new versions of metadata',
        contactEmail: 'user@example.org',
        permissionSetName: 'Continuous Integration',
        oauthConfig: {
          callbackUrl: 'http://localhost:1717/OauthRedirect',
          certificate: 'CERT',
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
      });
    });

  // This doesn't work, waiting for feedback on https://github.com/forcedotcom/cli/issues/1082
  // to understand the "proper" way to reset Sinon mocks so the regular unit tests don't fail
  // when run in the same mocha run
  $$.SANDBOX.restore();
  $$.SANDBOXES.CONNECTION.restore();
});

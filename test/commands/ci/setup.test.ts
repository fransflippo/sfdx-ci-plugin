import {$$, expect, test} from '@salesforce/command/lib/test';
import {Connection, IdentityInfo} from 'jsforce';
import Metadata = require('jsforce/lib/api/metadata');
import sinon = require('sinon');
import stripAnsi = require('strip-ansi');
import requireForNyc = require('../../../src/commands/ci/setup');

describe('ci:setup', () => {
  test
    .withOrg({ username: 'user@example.org' }, true)
    .do(() => {
      expect(requireForNyc).to.not.be.null;
    })
    .do(ctx => {
      $$.SANDBOX.stub(Metadata.prototype, 'read').withArgs('ConnectedApp', 'Continuous_Integration').resolves({fullName: 'Continuous_Integration'});
    })
    .stdout()
    .stderr()
    .command(['ci:setup', '--targetusername', 'user@example.org'])
    .it('should report an error when the connected app already exists  ', ctx => {
      expect(ctx.stderr).to.contain('Connected app "Continuous_Integration" already exists. Please choose a different name.');
    });
  test
    .withOrg({ username: 'user@example.org' }, true)
    .do(ctx => {
      const metadataReadStub = $$.SANDBOX.stub(Metadata.prototype, 'read');
      metadataReadStub.withArgs('ConnectedApp', 'Continuous_Integration').resolves({});
      const metadataCreateStub = $$.SANDBOX.stub(Metadata.prototype, 'create');
      metadataCreateStub.withArgs('PermissionSet', { fullName: 'Continuous_Integration', label: 'Continuous Integration', description: 'Permission set for the Continuous Integration connected app'}).resolves({success: true, fullName: 'Continuous_Integration'});
      const connectionQueryStub = $$.SANDBOX.stub(Connection.prototype, 'query');
      connectionQueryStub.withArgs("SELECT COUNT() FROM PermissionSet WHERE Name = 'Continuous_Integration'").resolves({done: true, totalSize: 0, records: []});
      connectionQueryStub.withArgs("SELECT Id, Name from PermissionSet WHERE Name = 'Continuous_Integration'").resolves({ done: true, totalSize: 1, records: [ { Id: 'PermissionSetId' } ]});
      $$.SANDBOX.stub(Connection.prototype, 'identity').resolves({ user_id: 'user123', username: 'User 123' } as IdentityInfo);
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      $$.SANDBOX.stub(Connection.prototype, 'create').withArgs('PermissionSetAssignment', { PermissionSetId: 'PermissionSetId', AssigneeId: 'user123'}).resolves({ success: true });
      metadataCreateStub.withArgs('ConnectedApp', sinon.match.any).resolves({success: true });
      metadataReadStub.withArgs('ConnectedApp', 'Continuous_Integration').resolves({
        oauthConfig: {
          consumerKey: 'APPKEY'
        }
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

      // TODO Verify that metadataCreateStub was called with the correct ConnectedApp definition
    });
  $$.SANDBOX.restore();
  $$.SANDBOXES.CONNECTION.restore();
});

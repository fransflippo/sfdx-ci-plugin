import {Connection} from '@salesforce/core';
import {expect} from 'chai';
import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
import Metadata = require('jsforce/lib/api/metadata');
import sinon = require('sinon');
import sinonChai = require('sinon-chai');
import connectedAppHelper from '../../src/helpers/connectedAppHelper';
chai.use(sinonChai);
chai.use(chaiAsPromised);

// Extend Connection because we need a class with no constructor to be able to createStubInstance
describe('ConnectedAppHelper', () => {
  describe('createConnectedApp', () => {
    it('should create a connected app', async () => {
      // Given
      const certificatePem = 'CERT';
      const connectionStub = sinon.createStubInstance(Connection);
      const connection = connectionStub as unknown as Connection;
      const metadataStub = sinon.createStubInstance<Metadata>(Metadata);
      const metadata = metadataStub as unknown as Metadata;
      connection.metadata = metadata;
      connectionStub.getUsername.returns('user@example.org');
      metadataStub.create.withArgs('ConnectedApp', sinon.match.any).returns(Promise.resolve({
          success: true,
          fullName: 'My_App'
      }));
      const connectedApp = {
        oauthConfig: {
          consumerKey: 'CONSUMERKEY'
        }
      };
      metadataStub.read.withArgs('ConnectedApp', 'My_App').returns(Promise.resolve(connectedApp));

      // When
      const consumerKey = await connectedAppHelper.createConnectedApp(connection, 'My App', 'My Permission Set', certificatePem, false);

      // Then
      expect(metadata.create).to.have.been.calledWith('ConnectedApp', {
       fullName: 'My_App',
        label: 'My App',
        description: 'Connected app used by continuous integration to deploy new versions of metadata',
        contactEmail: 'user@example.org',
        permissionSetName: 'My Permission Set',
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
      });
      expect(consumerKey).to.equal('CONSUMERKEY');
    });

    it('should return an error when connected app cannot be created', async () => {
      // Given
      const certificatePem = 'CERT';
      const connectionStub = sinon.createStubInstance(Connection);
      const connection = connectionStub as unknown as Connection;
      const metadataStub = sinon.createStubInstance<Metadata>(Metadata);
      connection.metadata = metadataStub as unknown as Metadata;
      connectionStub.getUsername.returns('user@example.org');
      metadataStub.create.returns(Promise.reject('Failed to create ConnectedApp'));

      // When / Then
      return expect(
        connectedAppHelper.createConnectedApp(connection, 'My App', 'My Permission Set', certificatePem, false)
      ).to.eventually.be.rejectedWith(Error, ': Failed to create ConnectedApp');
    });
    it('should delete an existing connected app before creating the new one if requested', async () => {
      // Given
      const certificatePem = 'CERT';
      const connectionStub = sinon.createStubInstance(Connection);
      const connection = connectionStub as unknown as Connection;
      const metadataStub = sinon.createStubInstance<Metadata>(Metadata);
      const metadata = metadataStub as unknown as Metadata;
      connection.metadata = metadata;
      connectionStub.getUsername.returns('user@example.org');
      metadataStub.create.withArgs('ConnectedApp', sinon.match.any).returns(Promise.resolve({
        success: true,
        fullName: 'My_App'
      }));
      const connectedApp = {
        oauthConfig: {
          consumerKey: 'CONSUMERKEY'
        }
      };
      metadataStub.read.withArgs('ConnectedApp', 'My_App').returns(Promise.resolve(connectedApp));

      // When
      const consumerKey = await connectedAppHelper.createConnectedApp(connection, 'My App', 'My Permission Set', certificatePem, true);

      // Then
      expect(metadata.delete).to.have.been.calledWith('ConnectedApp', 'My_App');
      expect(metadata.create).to.have.been.calledWith('ConnectedApp', {
        fullName: 'My_App',
        label: 'My App',
        description: 'Connected app used by continuous integration to deploy new versions of metadata',
        contactEmail: 'user@example.org',
        permissionSetName: 'My Permission Set',
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
      });
      expect(consumerKey).to.equal('CONSUMERKEY');
    });
  });

  describe('connectedAppExists', () => {
    it('should return true if the connected app exists', async () => {
      // Given
      const connectionStub = sinon.createStubInstance(Connection);
      const connection = connectionStub as unknown as Connection;
      const metadataStub = sinon.createStubInstance<Metadata>(Metadata);
      connection.metadata = metadataStub as unknown as Metadata;
      const connectedApp = {
        fullName: 'My_App'
      };
      metadataStub.read.withArgs('ConnectedApp', 'My_App').returns(Promise.resolve(connectedApp));

      // When
      const exists = await connectedAppHelper.connectedAppExists(connection, 'My App');

      // Then
      return expect(exists).to.be.true;
    });

    it('should return false if the connected app doesn\t exist', async () => {
      // Given
      const connectionStub = sinon.createStubInstance(Connection);
      const connection = connectionStub as unknown as Connection;
      const metadataStub = sinon.createStubInstance<Metadata>(Metadata);
      connection.metadata = metadataStub as unknown as Metadata;
      metadataStub.read.withArgs('ConnectedApp', 'My_App').returns(Promise.resolve({ }));

      // When
      const exists = await connectedAppHelper.connectedAppExists(connection, 'My App');

      // Then
      return expect(exists).to.be.false;
    });
  });
});

import {Connection} from '@salesforce/core';
import {expect} from 'chai';
import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
import {RecordResult} from 'jsforce';
import Metadata = require('jsforce/lib/api/metadata');
import Query = require('jsforce/lib/query');
import {QueryResult} from 'jsforce/query';
import sinon = require('sinon');
import sinonChai = require('sinon-chai');
import permissionSetHelper from '../../src/helpers/permissionSetHelper';
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('PermissionSetHelper', () => {
  describe('createPermissionSet', () => {
    it('should create a permission set if it doesn\'t yet exist', async () => {
      // Given
      const connectionStub = sinon.createStubInstance(Connection);
      const connection = connectionStub as unknown as Connection;
      const metadataStub = sinon.createStubInstance<Metadata>(Metadata);
      const metadata = metadataStub as unknown as Metadata;
      connection.metadata = metadata;
      metadata.create.withArgs('PermissionSet', sinon.match.any).returns(Promise.resolve({
        success: true,
        fullName: 'My_Permissions'
      }));

      // When
      const created = await permissionSetHelper.createPermissionSet(connection, 'My Permissions', 'This is my permission set');

      // Then
      expect(created).to.be.true;
      expect(metadata.create).to.have.been.calledWith('PermissionSet', {
        fullName: 'My_Permissions',
        label: 'My Permissions',
        description: 'This is my permission set'
      });
    });
    it('should ignore the error if a permission set already exists', async () => {
      // Given
      const connectionStub = sinon.createStubInstance(Connection);
      const connection = connectionStub as unknown as Connection;
      const metadataStub = sinon.createStubInstance<Metadata>(Metadata);
      const metadata = metadataStub as unknown as Metadata;
      connection.metadata = metadata;
      const error = new Error();
      error.name = 'DUPLICATE_VALUE';
      metadata.create.withArgs('PermissionSet', sinon.match.any).returns(Promise.reject(error));

      // When
      const created = await permissionSetHelper.createPermissionSet(connection, 'My Permissions', 'This is my permission set');

      // Then
      expect(created).to.be.false;
      expect(metadata.create).to.have.been.called;
    });
    it('should throw an error result if creating a permission set fails', async () => {
      // Given
      const connectionStub = sinon.createStubInstance(Connection);
      const connection = connectionStub as unknown as Connection;
      const metadataStub = sinon.createStubInstance<Metadata>(Metadata);
      const metadata = metadataStub as unknown as Metadata;
      connection.metadata = metadata;
      const query = Promise.resolve({ totalSize: 0 }) as Query<QueryResult<object>>;
      // Not great, if we change one letter in our query, the test will fail...
      connectionStub.query.withArgs("SELECT COUNT() FROM PermissionSet WHERE Name = 'My_Permissions'").returns(query);
      metadata.create.withArgs('PermissionSet', sinon.match.any).returns(Promise.reject('Computer says no'));

      // When / Then
      return expect(
        permissionSetHelper.createPermissionSet(connection, 'My Permissions', 'This is my permission set')
      ).to.eventually.be.rejectedWith(Error, 'Computer says no');
    });
  });

  describe('assignPermissionSet', () => {
    it('should assign a permission set', async () => {
      // Given
      const connectionStub = sinon.createStubInstance(Connection);
      const connection = connectionStub as unknown as Connection;
      const metadataStub = sinon.createStubInstance<Metadata>(Metadata);
      const metadata = metadataStub as unknown as Metadata;
      connection.metadata = metadata;
      const query = Promise.resolve({
        totalSize: 1,
        records: [{
          Id: 'permset123',
          Name: 'My_Permissions'
        }]}) as Query<QueryResult<object>>;
      // Not great, if we change one letter in our query, the test will fail...
      connectionStub.query.withArgs("SELECT Id, Name from PermissionSet WHERE Name = 'My_Permissions'").returns(query);
      connectionStub.create.withArgs(sinon.match.same('PermissionSetAssignment'), sinon.match.any).returns(Promise.resolve({} as RecordResult));

      // When
      await permissionSetHelper.assignPermissionSet(connection, 'My Permissions', 'user1');

      // Then
      expect(connection.create).to.have.been.calledWith('PermissionSetAssignment', {
        PermissionSetId: 'permset123',
        AssigneeId: 'user1'
      });
    });
    it('should assign a permission set and ignore duplicate errors', async () => {
      // Given
      const connectionStub = sinon.createStubInstance(Connection);
      const connection = connectionStub as unknown as Connection;
      const metadataStub = sinon.createStubInstance<Metadata>(Metadata);
      const metadata = metadataStub as unknown as Metadata;
      connection.metadata = metadata;
      const query = Promise.resolve({
        totalSize: 1,
        records: [{
          Id: 'permset123',
          Name: 'My_Permissions'
        }]}) as Query<QueryResult<object>>;
      // Not great, if we change one letter in our query, the test will fail...
      connectionStub.query.withArgs("SELECT Id, Name from PermissionSet WHERE Name = 'My_Permissions'").returns(query);
      connectionStub.create.withArgs(sinon.match.same('PermissionSetAssignment'), sinon.match.any).returns(Promise.reject({ name: 'DUPLICATE_VALUE'}));

      // When
      await permissionSetHelper.assignPermissionSet(connection, 'My Permissions', 'user1');

      // Then
      expect(connection.create).to.have.been.calledWith('PermissionSetAssignment', {
        PermissionSetId: 'permset123',
        AssigneeId: 'user1'
      });
    });
    it('should throw an error if assigning a permission set fails', async () => {
      // Given
      const connectionStub = sinon.createStubInstance(Connection);
      const connection = connectionStub as unknown as Connection;
      const metadataStub = sinon.createStubInstance<Metadata>(Metadata);
      const metadata = metadataStub as unknown as Metadata;
      connection.metadata = metadata;
      const query = Promise.resolve({
        totalSize: 1,
        records: [{
          Id: 'permset123',
          Name: 'My_Permissions'
        }]}) as Query<QueryResult<object>>;
      // Not great, if we change one letter in our query, the test will fail...
      connectionStub.query.withArgs("SELECT Id, Name from PermissionSet WHERE Name = 'My_Permissions'").returns(query);
      connectionStub.create.withArgs(sinon.match.same('PermissionSetAssignment'), sinon.match.any).returns(Promise.reject({ name: 'REQUIRED_FIELD_MISSING', message: 'Required field missing'}));

      // When / Then
      expect(
        permissionSetHelper.assignPermissionSet(connection, 'My Permissions', 'user1')
      ).to.eventually.be.rejectedWith(Error, 'Required field missing');
    });
  });
});

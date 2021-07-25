import {Connection} from '@salesforce/core';
import {SaveError} from 'jsforce';
import {PermissionSet} from '../types/permissionSet';
import {handleSaveResultError, toApiName} from './sfdx-utils';

export class PermissionSetHelper {

  /**
   * Creates a permission set
   * @param {Connection} connection the connection on which to create the permission set
   * @param {string} permissionSetName
   * @param {string} description description to assign the the permission set
   * @returns {Promise<boolean>} true if the permission set was created, false if it already existed
   */
  public async createPermissionSet(connection: Connection, permissionSetName: string, description: string): Promise<boolean> {
    const permissionSetApiName = toApiName(permissionSetName);

    // Permission set doesn't exist yet, create
    const permissionSet: PermissionSet = {
      fullName: permissionSetApiName,
      label: permissionSetName,
      description
    };
    const saveResult = await connection.metadata
      .create('PermissionSet', permissionSet)
      .catch(error => {
        // Synthesize a SaveResult that contains the error information so that all errors are handled in the same way
        return {
          fullName: permissionSetApiName,
          success: false,
          errors: {
            fields: '',
            message: error.toString(),
            statusCode: ''
          }
        };
      });
    if (Array.isArray(saveResult)) {
      throw new Error('Expected a single SaveResult but got: ' + saveResult);
    }
    if (saveResult.success) {
      return true;
    }
    let errors: SaveError[];
    if (!Array.isArray(saveResult.errors)) {
      errors = [saveResult.errors as SaveError];
    } else {
      errors = saveResult.errors as SaveError[];
    }
    for (const i in errors) {
      if (errors[i].statusCode === 'DUPLICATE_DEVELOPER_NAME') {
        // Duplicate API name: we can safely ignore this
        return false;
      }
    }
    // Report error
    if (!saveResult.success) {
      handleSaveResultError(saveResult);
    }
  }

  /**
   * Assigns the permission set with the given name to a user
   * @param {Connection} connection the connection on which to assign the permission set
   * @param {string} permissionSetName the name of the permission set tot assign. Will be translated to an API name
   *                                   using the standard rules for label-to-API-name translation
   * @param {string} userId the id (not username) of the user to assign the permission set to
   * @returns {Promise<void>}
   */
  public async assignPermissionSet(connection: Connection, permissionSetName: string, userId: string) {
    interface PermissionSetRecord {
      Id: string;
      Name: string;
    }

    // Find the permission set id
    const permissionSetResults = await connection.query<PermissionSetRecord>(`SELECT Id, Name from PermissionSet WHERE Name = '${toApiName(permissionSetName)}'`);
    const permissionSetId = permissionSetResults.records[0].Id;

    // Assign current user to the permission set
    await connection
      .create('PermissionSetAssignment', {
        PermissionSetId: permissionSetId,
        AssigneeId: userId
      })
      .catch(error => {
        if (error.name === 'DUPLICATE_VALUE') {
          // Ignore: we just want to make sure the assignment is there, and apparently it is.
        } else {
          throw new Error(error.message);
        }
      });
  }
}

export default new PermissionSetHelper();

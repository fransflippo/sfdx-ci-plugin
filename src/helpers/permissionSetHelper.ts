import {Connection} from '@salesforce/core';
import {SaveError} from 'jsforce';
import {PermissionSet} from '../types/permissionSet';
import {toApiName} from './sfdx-utils';

export class PermissionSetHelper {

  /**
   * Creates a permission set
   * @param {Connection} connection the connection on which to create the permission set
   * @param {string} permissionSetName
   * @param {string} connectedAppName the connected app that the permission set will give access to: used to add a
   *                                  meaningful description to the permission set
   * @returns {Promise<boolean>} true if the permission set was created, false if it already existed
   */
  public async createPermissionSet(connection: Connection, permissionSetName: string, connectedAppName: string): Promise<boolean> {
    // Check whether the permission set already exists
    const permissionSetApiName = toApiName(permissionSetName);
    const permissionSetCountResults = await connection.query(`SELECT COUNT() FROM PermissionSet WHERE Name = '${permissionSetApiName}'`);
    if (permissionSetCountResults.totalSize > 0) {
      return false;
    }

    // Permission set doesn't exist yet, create
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
      if (Array.isArray(saveResult.errors)) {
        throw new Error(saveResult.errors.map(error => error.fields + ': ' + error.message).join('\n'));
      } else {
        throw new Error((saveResult.errors as SaveError).fields + ': ' + (saveResult.errors as SaveError).message);
      }
    }
    return true;
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
          throw new Error(error);
        }
      });
  }
}

export default new PermissionSetHelper();

import {Connection} from '@salesforce/core';
import {SaveResult} from 'jsforce';
import {ConnectedApp} from '../types/connectedApp';
import {handleSaveResultError, toApiName} from './sfdx-utils';

export class ConnectedAppHelper {

  public async connectedAppExists(connection: Connection, connectedAppName: string): Promise<boolean> {
    const readResult = await connection.metadata.read('ConnectedApp', toApiName(connectedAppName));
    return (!Array.isArray(readResult) && readResult.fullName !== undefined);
  }

  /**
   * Creates a connected app
   * @param {Connection} connection the connection on which to create the connected app
   * @param {string} connectedAppName the display name of the connected app
   * @param {string} permissionSetName the display name of the permission set that will control access to the connected app
   * @param {string} certificatePem the certificate that will be used to verify digital signatures
   * @param {boolean} replaceExistingConnectedApp whether to replace an existing connected app with the same name
   * @returns {Promise<string>} the new connected app's consumer id (OAuth client id)
   */
  public async createConnectedApp(connection: Connection, connectedAppName: string, permissionSetName: string, certificatePem: string, replaceExistingConnectedApp: boolean): Promise<string> {
    const fullName = toApiName(connectedAppName);

    if (replaceExistingConnectedApp) {
      await connection.metadata.delete('ConnectedApp', toApiName(connectedAppName));
    }

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
            fields: '',
            message: error.toString(),
            statusCode: ''
          }
        };
      });
    if (Array.isArray(saveResult)) {
      throw new Error('Expected a single SaveResult but got: ' + saveResult);
    }
    if (!saveResult.success) {
      handleSaveResultError(saveResult);
    }

    // Get the new connected app's client id
    const readResult = await connection.metadata.read('ConnectedApp', fullName);
    const readConnectedApp = readResult as ConnectedApp;
    return readConnectedApp.oauthConfig.consumerKey;
  }
}

export default new ConnectedAppHelper();

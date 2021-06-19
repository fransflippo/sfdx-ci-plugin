import { MetadataInfo } from 'jsforce';

export interface ConnectedApp extends MetadataInfo {
  label: string;
  description: string;
  contactEmail: string;
  permissionSetName: string;
  oauthConfig: ConnectedAppOAuthConfig;
  oauthPolicy: ConnectedAppOAuthPolicy;
}

export interface ConnectedAppOAuthConfig {
  callbackUrl: string;
  certificate: string;
  isAdminApproved: boolean;
  scopes: string[];
}

export interface ConnectedAppOAuthPolicy {
  ipRelaxation: string;
}

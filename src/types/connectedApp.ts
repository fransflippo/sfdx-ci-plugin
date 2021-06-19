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
  consumerKey?: string;
  callbackUrl: string;
  certificate: string;
  isAdminApproved: boolean;
  isConsumerSecretOptional: boolean;
  scopes: string[];
}

export interface ConnectedAppOAuthPolicy {
  ipRelaxation: string;
  refreshTokenPolicy: string;
}

import { MetadataInfo } from 'jsforce';

export interface PermissionSet extends MetadataInfo {
  label: string;
  description: string;
}

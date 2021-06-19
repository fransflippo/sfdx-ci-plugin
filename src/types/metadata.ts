import { SaveResult } from 'jsforce';

export interface SaveErrorResult extends SaveResult {
  errors: MetadataError|MetadataError[];
}

export interface MetadataError {
  fields: string|string[];
  message: string;
  statusCode: string;
}

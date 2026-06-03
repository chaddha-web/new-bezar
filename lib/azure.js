import { generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } from '@azure/storage-blob';

export function signAzureUrl(url) {
  if (!url || !url.includes('.blob.core.windows.net/')) return url;
  
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) return url;
  
  const matches = connectionString.match(/AccountName=([^;]+);AccountKey=([^;]+)/);
  if (!matches) return url;
  
  const accountName = matches[1];
  const accountKey = matches[2];
  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  if (pathParts.length < 2) return url;
  
  const containerName = pathParts[0];
  const blobName = decodeURIComponent(pathParts.slice(1).join('/'));

  const sasOptions = {
    containerName,
    blobName,
    permissions: BlobSASPermissions.parse("r"),
    startsOn: new Date(),
    expiresOn: new Date(new Date().valueOf() + 2 * 60 * 60 * 1000), // 2 hours validity
  };
  
  const sasToken = generateBlobSASQueryParameters(sasOptions, credential).toString();
  return `${url}?${sasToken}`;
}

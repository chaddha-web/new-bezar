import { NextResponse } from 'next/server';
import { 
  BlobServiceClient, 
  generateBlobSASQueryParameters, 
  BlobSASPermissions, 
  StorageSharedKeyCredential 
} from '@azure/storage-blob';
import { verifyAdminToken, verifyCmsToken } from '@/lib/auth';

export async function POST(request) {
  try {
    let isAuthorized = false;
    const adminSession = request.cookies.get('bezar_admin_session');
    if (adminSession && adminSession.value && await verifyAdminToken(adminSession.value)) {
      isAuthorized = true;
    } else {
      const cmsSession = request.cookies.get('bezar_cms_session');
      if (cmsSession && cmsSession.value && await verifyCmsToken(cmsSession.value)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filename, filetype } = await request.json();
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_CONTAINER_NAME || 'bezar-media';

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    if (!connectionString || connectionString.includes('your_account')) {
      console.warn('Azure Connection String is not set. Generating fallback mockup upload URL.');
      // Return a mockup direct link for testing purposes
      return NextResponse.json({
        uploadUrl: `https://mock-azure-storage.bezar.in/media/${filename}?sig=mock_token_active_60m`,
        blobUrl: `/videos/${filename}`,
        mock: true
      });
    }

    // Extract Account Name and Key from Connection String
    const matches = connectionString.match(/AccountName=([^;]+);AccountKey=([^;]+)/);
    if (!matches) {
      return NextResponse.json({ error: 'Invalid Connection String format' }, { status: 500 });
    }
    const accountName = matches[1];
    const accountKey = matches[2];

    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Ensure the media container exists
    await containerClient.createIfNotExists({ access: 'blob' });

    const blobName = `${Date.now()}-${filename}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Set SAS token properties
    const sasOptions = {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse("w"), // Write permissions only
      startsOn: new Date(),
      expiresOn: new Date(new Date().valueOf() + 60 * 60 * 1000), // Valid for 60 minutes
    };

    const sasToken = generateBlobSASQueryParameters(sasOptions, credential).toString();
    const uploadUrl = `${blockBlobClient.url}?${sasToken}`;
    const blobUrl = blockBlobClient.url; // This is the final public URL of the uploaded media file

    return NextResponse.json({
      uploadUrl,
      blobUrl,
      mock: false
    });
  } catch (error) {
    console.error('Failed to generate Azure SAS Token:', error);
    return NextResponse.json({ error: 'Failed to generate SAS token' }, { status: 500 });
  }
}

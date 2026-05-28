import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");

  if (!filename) {
    return NextResponse.json({ error: "Missing filename parameter" }, { status: 400 });
  }

  const bucketName = "bucket-d4d96s";
  const fallbackUrl = `https://${bucketName}.s3.us-east-1.amazonaws.com/${encodeURIComponent(filename)}`;

  // If AWS credentials are provided, generate a secure pre-signed URL
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try {
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: filename,
      });

      // URL expires in 1 hour (3600 seconds)
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return NextResponse.json({ url: signedUrl, source: "s3-presigned" });
    } catch (error) {
      console.error("Error generating pre-signed S3 URL:", error);
      // Fallback if signing fails
      return NextResponse.json({ url: fallbackUrl, source: "fallback-error" });
    }
  }

  // Fallback to direct public S3 URL
  return NextResponse.json({ url: fallbackUrl, source: "fallback-public" });
}

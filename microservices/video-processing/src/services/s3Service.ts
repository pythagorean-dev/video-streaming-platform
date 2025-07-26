import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export class S3Service {
  private s3: AWS.S3;
  private bucketName: string;
  
  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    this.bucketName = process.env.S3_BUCKET_NAME || 'video-streaming-platform';
  }
  
  async uploadFile(filePath: string, key: string): Promise<string> {
    try {
      const fileContent = fs.readFileSync(filePath);
      const contentType = this.getContentType(filePath);
      
      const params: AWS.S3.PutObjectRequest = {
        Bucket: this.bucketName,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
        CacheControl: this.getCacheControl(filePath)
      };
      
      // Set appropriate ACL based on file type
      if (this.isPublicFile(filePath)) {
        params.ACL = 'public-read';
      }
      
      const result = await this.s3.upload(params).promise();
      
      logger.info(`Uploaded file to S3: ${key}`);
      return result.Location;
      
    } catch (error) {
      logger.error(`Error uploading file to S3: ${key}`, error);
      throw error;
    }
  }
  
  async uploadBuffer(buffer: Buffer, key: string, contentType: string): Promise<string> {
    try {
      const params: AWS.S3.PutObjectRequest = {
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read'
      };
      
      const result = await this.s3.upload(params).promise();
      
      logger.info(`Uploaded buffer to S3: ${key}`);
      return result.Location;
      
    } catch (error) {
      logger.error(`Error uploading buffer to S3: ${key}`, error);
      throw error;
    }
  }
  
  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3.deleteObject({
        Bucket: this.bucketName,
        Key: key
      }).promise();
      
      logger.info(`Deleted file from S3: ${key}`);
      
    } catch (error) {
      logger.error(`Error deleting file from S3: ${key}`, error);
      throw error;
    }
  }
  
  async deleteFiles(keys: string[]): Promise<void> {
    try {
      const deleteParams = {
        Bucket: this.bucketName,
        Delete: {
          Objects: keys.map(key => ({ Key: key }))
        }
      };
      
      await this.s3.deleteObjects(deleteParams).promise();
      
      logger.info(`Deleted ${keys.length} files from S3`);
      
    } catch (error) {
      logger.error('Error deleting files from S3:', error);
      throw error;
    }
  }
  
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Expires: expiresIn
      };
      
      const url = await this.s3.getSignedUrlPromise('getObject', params);
      return url;
      
    } catch (error) {
      logger.error(`Error generating signed URL for: ${key}`, error);
      throw error;
    }
  }
  
  async copyFile(sourceKey: string, destinationKey: string): Promise<string> {
    try {
      const params = {
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey
      };
      
      await this.s3.copyObject(params).promise();
      
      const url = `https://${this.bucketName}.s3.amazonaws.com/${destinationKey}`;
      logger.info(`Copied file in S3: ${sourceKey} -> ${destinationKey}`);
      
      return url;
      
    } catch (error) {
      logger.error(`Error copying file in S3: ${sourceKey} -> ${destinationKey}`, error);
      throw error;
    }
  }
  
  async listFiles(prefix: string): Promise<AWS.S3.Object[]> {
    try {
      const params = {
        Bucket: this.bucketName,
        Prefix: prefix
      };
      
      const result = await this.s3.listObjectsV2(params).promise();
      return result.Contents || [];
      
    } catch (error) {
      logger.error(`Error listing files with prefix: ${prefix}`, error);
      throw error;
    }
  }
  
  async getFileMetadata(key: string): Promise<AWS.S3.HeadObjectOutput> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key
      };
      
      const result = await this.s3.headObject(params).promise();
      return result;
      
    } catch (error) {
      logger.error(`Error getting file metadata: ${key}`, error);
      throw error;
    }
  }
  
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const contentTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.m3u8': 'application/vnd.apple.mpegurl',
      '.ts': 'video/mp2t',
      '.mpd': 'application/dash+xml',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }
  
  private getCacheControl(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    // Video files and manifests should be cached differently
    if (['.mp4', '.webm', '.mov'].includes(ext)) {
      return 'public, max-age=31536000'; // 1 year for video files
    } else if (['.m3u8', '.mpd'].includes(ext)) {
      return 'public, max-age=300'; // 5 minutes for manifests
    } else if (['.ts'].includes(ext)) {
      return 'public, max-age=86400'; // 1 day for segments
    } else if (['.jpg', '.png', '.webp'].includes(ext)) {
      return 'public, max-age=2592000'; // 30 days for images
    }
    
    return 'public, max-age=3600'; // 1 hour default
  }
  
  private isPublicFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    
    // Make video files, manifests, and thumbnails public
    const publicExtensions = ['.mp4', '.webm', '.mov', '.m3u8', '.mpd', '.ts', '.jpg', '.png', '.webp'];
    return publicExtensions.includes(ext);
  }
}
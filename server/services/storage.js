
import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME || 'finmanager-attachments';
const bucket = storage.bucket(bucketName);

/**
 * Faz o upload de arquivos para o GCS e retorna as URLs públicas.
 */
export const uploadFiles = async (files, userId) => {
    if (!files || files.length === 0) return [];

    const uploadPromises = files.map(file => {
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `attachments/${userId}/${crypto.randomUUID()}-${cleanName}`;
        const blob = bucket.file(fileName);
        
        const blobStream = blob.createWriteStream({
            resumable: false,
            metadata: { 
                contentType: file.mimetype,
                cacheControl: 'public, max-age=31536000'
            }
        });

        return new Promise((resolve, reject) => {
            blobStream.on('error', err => reject(err));
            blobStream.on('finish', async () => {
                try {
                    await blob.makePublic();
                    resolve(`https://storage.googleapis.com/${bucketName}/${fileName}`);
                } catch (e) {
                    // Se falhar o makePublic, ainda retornamos a URL (pode depender de permissões do bucket)
                    resolve(`https://storage.googleapis.com/${bucketName}/${fileName}`);
                }
            });
            blobStream.end(file.buffer);
        });
    });

    return Promise.all(uploadPromises);
};

"use strict";
const {Storage} = require("@google-cloud/storage");
const sharp = require('sharp');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
//destination bucket
const bucketName = 'doki-storage'
const storage = new Storage();

const MAX_WIDTH = 1024;
const MAX_HEIGHT = 1024;

exports.resizeImage = async (data, context) => {
    const file = data;
    if (!file.contentType.includes('image')) {
        console.log('This is not an image file.');
        return false;
    }

    const bucket = storage.bucket(bucketName);
    const workingDir = path.join(os.tmpdir(), '/');
    const tmpFilePath = path.join(workingDir, file.name);

    // 임시 디렉토리 생성
    await fs.ensureDir(workingDir);

    // 파일을 임시 위치로 다운로드
    await bucket.file(file.name).download({
        destination: tmpFilePath
    });

    const [width, height] = await sharp(tmpFilePath).metadata().then(metadata => [metadata.width, metadata.height]);

    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const resizedImagePath = path.join(workingDir, 'resized-' + file.name);

        // 리사이징
        await sharp(tmpFilePath)
            .resize(MAX_WIDTH, MAX_HEIGHT, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .toFile(resizedImagePath);

        // 리사이징된 이미지 업로드
        await bucket.upload(resizedImagePath, {
            destination: file.name.replace(path.basename(file.name), 'resized-' + path.basename(file.name)),
            metadata: {
                contentType: file.contentType,
                cacheControl: 'public, max-age=3600'
            }
        });

        // 임시 파일 삭제
        await fs.remove(workingDir);
    } else {
        // 이미지가 지정된 최대 크기보다 작거나 같으면, 아무 작업도 하지 않음
        console.log('No resizing needed.');
        return false;
    }

    console.log('Image resized and uploaded successfully');
    return true;
};
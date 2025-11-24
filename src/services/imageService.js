// services/imageService.js
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import Image from '../models/image.js';
import { AppError } from '../middlewares/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImageService {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads');
    this.initializeDirectories();
  }

  // Initialize upload directories
  async initializeDirectories() {
    const dirs = [
      path.join(this.uploadDir, 'images/products'),
      path.join(this.uploadDir, 'images/thumbnails'),
      path.join(this.uploadDir, 'images/users'),
      path.join(this.uploadDir, 'images/reviews'),
      path.join(this.uploadDir, 'images/temp'),
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Failed to create directory ${dir}:`, error);
      }
    }
  }

  // Generate organized file path based on date
  generateFilePath(category, fileName) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return path.join('images', category, year.toString(), month, fileName);
  }

  // Generate unique filename with UUID
  generateUniqueFileName(originalName) {
    const uuid = uuidv4();
    const ext = path.extname(originalName);
    return `${uuid}${ext}`;
  }

  // Get image dimensions
  async getImageDimensions(filePath) {
    try {
      const metadata = await sharp(filePath).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
      };
    } catch (error) {
      console.error('Error getting image dimensions:', error);
      return { width: null, height: null };
    }
  }

  // Process and optimize image
  async processImage(inputPath, outputPath, options = {}) {
    try {
      let sharpInstance = sharp(inputPath);

      if (options.width || options.height) {
        sharpInstance = sharpInstance.resize({
          width: options.width,
          height: options.height,
          fit: options.fit || 'inside',
          withoutEnlargement: true,
        });
      }

      if (options.quality) {
        if (outputPath.endsWith('.jpg') || outputPath.endsWith('.jpeg')) {
          sharpInstance = sharpInstance.jpeg({ quality: options.quality });
        } else if (outputPath.endsWith('.png')) {
          sharpInstance = sharpInstance.png({ quality: options.quality });
        } else if (outputPath.endsWith('.webp')) {
          sharpInstance = sharpInstance.webp({ quality: options.quality });
        }
      }

      sharpInstance = sharpInstance.rotate();

      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await sharpInstance.toFile(outputPath);

      return outputPath;
    } catch (error) {
      console.error('Error processing image:', error);
      throw new AppError('Failed to process image', 500);
    }
  }

  // Generate thumbnails
  async generateThumbnails(originalPath, fileName, category) {
    const thumbnails = [];
    const thumbSizes = [
      { name: 'small', width: 150, height: 150 },
      { name: 'medium', width: 300, height: 300 },
      { name: 'large', width: 600, height: 600 },
    ];

    for (const size of thumbSizes) {
      try {
        const thumbFileName = `${path.parse(fileName).name}_${size.name}${path.extname(fileName)}`;
        const thumbPath = this.generateFilePath('thumbnails', thumbFileName);
        const fullThumbPath = path.join(this.uploadDir, thumbPath);

        await this.processImage(originalPath, fullThumbPath, {
          width: size.width,
          height: size.height,
          quality: 85,
          fit: 'cover',
        });

        thumbnails.push({
          size: size.name,
          path: thumbPath,
          fileName: thumbFileName,
        });
      } catch (error) {
        console.error(`Error generating ${size.name} thumbnail:`, error);
      }
    }

    return thumbnails;
  }

  // Upload single image
  async uploadImage(file, options = {}) {
    try {
      const {
        category = 'product',
        productId = null,
        userId = null,
        generateThumbs = true,
        optimize = true,
      } = options;

      const fileName = this.generateUniqueFileName(file.originalname);
      const filePath = this.generateFilePath(category, fileName);
      const fullPath = path.join(this.uploadDir, filePath);

      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      if (optimize) {
        await this.processImage(file.path, fullPath, { quality: 90 });
      } else {
        await fs.copyFile(file.path, fullPath);
      }

      const dimensions = await this.getImageDimensions(fullPath);

      const imageRecord = await Image.create({
        originalName: file.originalname,
        fileName,
        filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        width: dimensions.width,
        height: dimensions.height,
        category,
        productId,
        userId,
      });

      let thumbnails = [];
      if (generateThumbs && category === 'product') {
        thumbnails = await this.generateThumbnails(fullPath, fileName, category);
      }

      try {
        await fs.unlink(file.path);
      } catch (err) {
        console.error('Error cleaning up temp file:', err);
      }

      return {
        id: imageRecord.id,
        fileName,
        filePath,
        url: `/uploads/${filePath}`,
        originalName: file.originalname,
        size: file.size,
        dimensions,
        thumbnails,
        category,
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new AppError('Failed to upload image', 500);
    }
  }

  // Upload multiple images
  async uploadMultipleImages(files, options = {}) {
    const results = [];
    const errors = [];

    for (const file of files) {
      try {
        const result = await this.uploadImage(file, options);
        results.push(result);
      } catch (error) {
        errors.push({ fileName: file.originalname, error: error.message });
      }
    }

    return {
      successful: results,
      failed: errors,
      count: {
        total: files.length,
        successful: results.length,
        failed: errors.length,
      },
    };
  }

  // Get image by ID
  async getImageById(id) {
    const image = await Image.findById(id);
    if (!image) throw new AppError('Image not found', 404);
    return image;
  }

  // Delete image
  async deleteImage(id) {
    const image = await this.getImageById(id);
    const fullPath = path.join(this.uploadDir, image.filePath);

    try {
      await fs.unlink(fullPath);
    } catch (err) {
      console.error('Error deleting file:', err);
    }

    if (image.category === 'product') {
      const thumbSizes = ['small', 'medium', 'large'];
      for (const size of thumbSizes) {
        try {
          const thumbFileName = `${path.parse(image.fileName).name}_${size}${path.extname(image.fileName)}`;
          const thumbPath = path.join(this.uploadDir, 'images/thumbnails', thumbFileName);
          await fs.unlink(thumbPath);
        } catch {}
      }
    }

    await image.deleteOne();
    return { success: true };
  }

  // Get images by product ID
  async getImagesByProductId(productId) {
    return await Image.find({
      productId,
      isActive: true
    })
    .sort({ createdAt: 1 });
  }

  // Convert base64 to file
  async convertBase64ToFile(base64Data, options = {}) {
    const { category = 'product', productId = null, userId = null } = options;

    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) throw new AppError('Invalid base64 data', 400);

    const mimeType = matches[1];
    const base64 = matches[2];
    const ext = mimeType.split('/')[1];
    const fileName = `${uuidv4()}.${ext}`;
    const filePath = this.generateFilePath(category, fileName);
    const fullPath = path.join(this.uploadDir, filePath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    const buffer = Buffer.from(base64, 'base64');
    await fs.writeFile(fullPath, buffer);

    const dimensions = await this.getImageDimensions(fullPath);

    const imageRecord = await Image.create({
      originalName: `converted_${fileName}`,
      fileName,
      filePath,
      fileSize: buffer.length,
      mimeType,
      width: dimensions.width,
      height: dimensions.height,
      category,
      productId,
      userId,
    });

    return {
      id: imageRecord.id,
      fileName,
      filePath,
      url: `/uploads/${filePath}`,
      originalName: `converted_${fileName}`,
      size: buffer.length,
      dimensions,
      category,
    };
  }

  // Cleanup orphaned files
  async cleanupOrphanedFiles() {
    const allFiles = await this.getAllFiles(this.uploadDir);
    const activeImages = await Image.find({
      isActive: true
    })
    .select('filePath');

    const activeFilePaths = new Set(activeImages.map((img) => img.filePath));

    const orphanedFiles = allFiles.filter((filePath) => {
      const relativePath = path.relative(this.uploadDir, filePath);
      return !activeFilePaths.has(relativePath);
    });

    for (const filePath of orphanedFiles) {
      try {
        await fs.unlink(filePath);
        console.log(`Deleted orphaned file: ${filePath}`);
      } catch (err) {
        console.error(`Error deleting orphaned file ${filePath}:`, err);
      }
    }

    return {
      totalFiles: allFiles.length,
      activeFiles: activeImages.length,
      orphanedFiles: orphanedFiles.length,
      deletedFiles: orphanedFiles.length,
    };
  }

  // Helper to get all files recursively
  async getAllFiles(dirPath) {
    const files = [];
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }
    return files;
  }
}

export default new ImageService();

import { ParseFilePipeBuilder } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export function createImageUploadOptions(folder: string): MulterOptions {
  return {
    storage: diskStorage({
      destination: (_request, _file, callback) => {
        const rootPath = process.env.UPLOADS_ROOT_PATH ?? 'uploads';
        const destination = join(process.cwd(), rootPath, folder);
        mkdirSync(destination, { recursive: true });
        callback(null, destination);
      },
      filename: (_request, file, callback) => {
        callback(
          null,
          `${randomUUID()}${extname(file.originalname) || '.png'}`,
        );
      },
    }),
  };
}

export function createImageFileValidationPipe(maxSizeInBytes: number) {
  return new ParseFilePipeBuilder()
    .addFileTypeValidator({
      fileType: /^image\/(jpeg|png)$/,
      fallbackToMimetype: true,
    })
    .addMaxSizeValidator({ maxSize: maxSizeInBytes })
    .build({ fileIsRequired: true, errorHttpStatusCode: 422 });
}

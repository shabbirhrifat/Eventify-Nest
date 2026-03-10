import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const uploadsRootPath = '.test-uploads';
const uploadsDirectory = join(process.cwd(), uploadsRootPath);

process.env.NODE_ENV = 'test';
process.env.UPLOADS_ROOT_PATH = uploadsRootPath;

beforeAll(() => {
  rmSync(uploadsDirectory, { recursive: true, force: true });
  mkdirSync(uploadsDirectory, { recursive: true });
});

afterAll(() => {
  rmSync(uploadsDirectory, { recursive: true, force: true });
});

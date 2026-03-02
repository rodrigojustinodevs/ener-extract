import type { FileFilterCallback } from 'multer';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';

const UPLOAD_DIR = './uploads';
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = 'application/pdf';

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const multerConfig = {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, _file, cb) => cb(null, `${randomUUID()}.pdf`),
  }),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    if (file.mimetype !== ALLOWED_MIME) {
      cb(new Error('Apenas arquivos PDF são permitidos'));
      return;
    }
    cb(null, true);
  },
};

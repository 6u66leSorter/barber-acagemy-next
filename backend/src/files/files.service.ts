import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { createReadStream, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseService } from '../database/database.service'

export type StoredFilePurpose = 'homework' | 'revision' | 'avatar'
export type UploadedFileData = { buffer: Buffer; originalname: string; mimetype: string; size: number }

type StoredFile = {
  id: string
  owner_user_id: number
  purpose: StoredFilePurpose
  storage_name: string
  original_name: string
  mime_type: string
  byte_size: number
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'application/pdf': '.pdf',
}

function matchesSignature(mime: string, buffer: Buffer) {
  if (mime === 'image/jpeg') return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (mime === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  if (mime === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  if (mime === 'video/mp4' || mime === 'video/quicktime') return buffer.length > 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp'
  return false
}

@Injectable()
export class FilesService {
  private readonly uploadDir: string

  constructor(private readonly database: DatabaseService) {
    this.uploadDir = resolve(process.cwd(), process.env.UPLOAD_DIR || './data/uploads')
    mkdirSync(this.uploadDir, { recursive: true })
  }

  store(userId: number, purpose: StoredFilePurpose, file?: UploadedFileData) {
    if (!file?.buffer?.length) throw new BadRequestException('Файл не передан.')
    const configuredLimit = Number(process.env.MAX_HOMEWORK_UPLOAD_MB || 50)
    const maxMegabytes = Number.isFinite(configuredLimit) && configuredLimit > 0 ? Math.min(50, configuredLimit) : 50
    const maxBytes = maxMegabytes * 1024 * 1024
    if (!Number.isSafeInteger(file.size) || file.size !== file.buffer.length || file.size > maxBytes) throw new BadRequestException('Файл превышает допустимый размер или повреждён.')
    const extension = MIME_EXTENSIONS[file.mimetype]
    if (!extension) throw new BadRequestException('Поддерживаются JPEG, PNG, WebP, MP4, MOV и PDF.')
    if (!matchesSignature(file.mimetype, file.buffer)) throw new BadRequestException('Содержимое файла не соответствует заявленному типу.')
    if (purpose === 'avatar' && !file.mimetype.startsWith('image/')) throw new BadRequestException('Аватар должен быть изображением.')

    const id = randomUUID()
    const storageName = `${id}${extension}`
    const diskPath = resolve(this.uploadDir, storageName)
    writeFileSync(diskPath, file.buffer, { flag: 'wx', mode: 0o600 })
    try {
      this.database.db.prepare('INSERT INTO stored_files (id, owner_user_id, purpose, storage_name, original_name, mime_type, byte_size) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        id,
        userId,
        purpose,
        storageName,
        basename(file.originalname || `upload${extension}`).slice(0, 255),
        file.mimetype,
        file.size,
      )
    } catch (error) {
      try { unlinkSync(diskPath) } catch { /* best-effort rollback */ }
      throw error
    }
    return this.require(id)
  }

  discardIfUnreferenced(id: string, ownerUserId: number) {
    const row = this.database.db.prepare('SELECT * FROM stored_files WHERE id = ? AND owner_user_id = ?').get(id, ownerUserId) as StoredFile | undefined
    if (!row) return false
    const referenced = this.database.db.prepare(`
      SELECT 1 FROM homeworks WHERE file_id = ? OR revision_student_file_id = ?
      UNION ALL SELECT 1 FROM homework_files WHERE file_id = ?
      UNION ALL SELECT 1 FROM students WHERE avatar_file_id = ?
      LIMIT 1
    `).get(id, id, id, id)
    if (referenced) return false
    this.database.db.prepare('DELETE FROM stored_files WHERE id = ? AND owner_user_id = ?').run(id, ownerUserId)
    try { unlinkSync(resolve(this.uploadDir, basename(row.storage_name))) } catch { /* already missing */ }
    return true
  }

  require(id: string) {
    const row = this.database.db.prepare('SELECT * FROM stored_files WHERE id = ?').get(id) as StoredFile | undefined
    if (!row) throw new NotFoundException('Файл не найден.')
    return row
  }

  assertOwned(id: string, userId: number, purposes: StoredFilePurpose[]) {
    const row = this.require(id)
    if (row.owner_user_id !== userId || !purposes.includes(row.purpose)) throw new ForbiddenException('Нет доступа к этому файлу.')
    return row
  }

  response(id: string) {
    const row = this.require(id)
    const path = resolve(this.uploadDir, basename(row.storage_name))
    if (!path.startsWith(`${this.uploadDir}/`) || !existsSync(path)) throw new NotFoundException('Файл отсутствует в хранилище.')
    return { row, stream: createReadStream(path) }
  }

  contentTypeFor(mime: string) {
    if (mime.startsWith('image/')) return 'photo'
    if (mime.startsWith('video/')) return 'video'
    return 'document'
  }
}

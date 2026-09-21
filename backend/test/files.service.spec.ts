import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { DatabaseService } from '../src/database/database.service'
import { FilesService } from '../src/files/files.service'

describe('FilesService', () => {
  let sqlite: Database.Database
  let uploadDir: string
  let service: FilesService

  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY);
      CREATE TABLE stored_files (
        id TEXT PRIMARY KEY, owner_user_id INTEGER NOT NULL, purpose TEXT NOT NULL,
        storage_name TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users VALUES (1), (2);
    `)
    uploadDir = mkdtempSync(join(tmpdir(), 'barber-files-'))
    process.env.UPLOAD_DIR = uploadDir
    service = new FilesService({ db: sqlite } as DatabaseService)
  })

  afterEach(() => {
    sqlite.close()
    rmSync(uploadDir, { recursive: true, force: true })
    delete process.env.UPLOAD_DIR
  })

  it('stores a verified image under an opaque id and enforces ownership', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
    const stored = service.store(1, 'homework', { buffer: png, originalname: '../../work.png', mimetype: 'image/png', size: png.length })

    expect(stored.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(stored.original_name).toBe('work.png')
    expect(service.assertOwned(stored.id, 1, ['homework']).id).toBe(stored.id)
    expect(() => service.assertOwned(stored.id, 2, ['homework'])).toThrow(ForbiddenException)
  })

  it('rejects a spoofed content type', () => {
    const script = Buffer.from('<script>alert(1)</script>')
    expect(() => service.store(1, 'homework', { buffer: script, originalname: 'fake.png', mimetype: 'image/png', size: script.length })).toThrow(BadRequestException)
  })
})

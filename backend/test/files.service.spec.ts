import Database from 'better-sqlite3'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
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
    sqlite.pragma('foreign_keys = ON')
    sqlite.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY);
      CREATE TABLE stored_files (
        id TEXT PRIMARY KEY, owner_user_id INTEGER NOT NULL, purpose TEXT NOT NULL,
        storage_name TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(owner_user_id) REFERENCES users(id)
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

  it('rejects inconsistent file metadata and invalid configured limits safely', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])
    expect(() => service.store(1, 'homework', { buffer: png, originalname: 'work.png', mimetype: 'image/png', size: png.length + 1 })).toThrow(BadRequestException)

    process.env.MAX_HOMEWORK_UPLOAD_MB = 'not-a-number'
    const stored = service.store(1, 'homework', { buffer: png, originalname: 'work.png', mimetype: 'image/png', size: png.length })
    expect(stored.byte_size).toBe(png.length)
    delete process.env.MAX_HOMEWORK_UPLOAD_MB
  })

  it('removes the disk file if metadata insertion fails', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])
    expect(() => service.store(999, 'homework', { buffer: png, originalname: 'work.png', mimetype: 'image/png', size: png.length })).toThrow()
    expect(readdirSync(uploadDir)).toHaveLength(0)
  })

  it('discards only unreferenced files owned by the caller', () => {
    sqlite.exec('CREATE TABLE homeworks (file_id TEXT, revision_student_file_id TEXT); CREATE TABLE homework_files (file_id TEXT); CREATE TABLE students (avatar_file_id TEXT);')
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])
    const stored = service.store(1, 'homework', { buffer: png, originalname: 'work.png', mimetype: 'image/png', size: png.length })
    const diskPath = join(uploadDir, stored.storage_name)

    expect(service.discardIfUnreferenced(stored.id, 2)).toBe(false)
    expect(existsSync(diskPath)).toBe(true)
    expect(service.discardIfUnreferenced(stored.id, 1)).toBe(true)
    expect(existsSync(diskPath)).toBe(false)
  })
})

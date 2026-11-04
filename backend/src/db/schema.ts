// Drizzle ORM schema — mirrors the SQLite migration in db/index.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  spaceId: text('space_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  chatId: text('chat_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  model: text('model'),
  createdAt: integer('created_at').notNull(),
})

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  text: text('text').notNull(),
  addedAt: integer('added_at').notNull(),
})

export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  json: text('json').notNull(),
})

export const citations = sqliteTable('citations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  collection: text('collection'),
  savedAt: integer('saved_at').notNull(),
})

/* eslint-env node */
/* eslint-disable consistent-return */

/*

STREAM
  comment
  directive
  empty
  [other] -> DOCUMENT

DOCUMENT
  comment
  empty
  doc-start-marker
  doc-end-marker -> STREAM
  flow-map
  flow-seq
  block-map
  block-seq
  scalar

const Type = {
  ALIAS: 'ALIAS',
  BLOCK_FOLDED: 'BLOCK_FOLDED',
  BLOCK_LITERAL: 'BLOCK_LITERAL',
  COMMENT: 'COMMENT',
  DIRECTIVE: 'DIRECTIVE',
  DOCUMENT: 'DOCUMENT',
  EMPTY_LINE: 'EMPTY_LINE',
  FLOW_MAP: 'FLOW_MAP',
  FLOW_SEQ: 'FLOW_SEQ',
  LINE_COMMENT: 'LINE_COMMENT',
  MAP: 'MAP',
  MAP_KEY: 'MAP_KEY',
  MAP_VALUE: 'MAP_VALUE',
  PLAIN: 'PLAIN',
  QUOTE_DOUBLE: 'QUOTE_DOUBLE',
  QUOTE_SINGLE: 'QUOTE_SINGLE',
  SEQ: 'SEQ',
  SEQ_ITEM: 'SEQ_ITEM'
}

*/

import { Transform } from 'stream'
import { StringDecoder } from 'string_decoder'

import {
  COMMENT,
  DIRECTIVE,
  DOCUMENT,
  DOC_START,
  DOC_END,
  EMPTY_LINE
} from './types.js'

const docStart = /^---\b/
const docEnd = /^\.\.\.\b/

/** Consumes string or buffer input, emits stream objects */
export class DocStream extends Transform {
  constructor(options = {}) {
    super({
      ...options,
      decodeStrings: false,
      emitClose: true,
      objectMode: true
    })
    this.decoder = new StringDecoder(options.defaultEncoding || 'utf8')
    this.doc = null
    this.offset = 0
    this.lastLine = ''
  }

  parseLine(line, indent, crlf) {
    const start = this.offset
    this.offset += line.length + (crlf ? 2 : 1)

    if (!this.doc) {
      if (indent === -1)
        // empty line in stream
        return { start, type: EMPTY_LINE, body: line }

      const ch0 = line[indent]
      if (ch0 === '#')
        // comment in stream
        return { start, type: COMMENT, indent, body: line.slice(indent) }

      if (indent === 0) {
        if (ch0 === '%') {
          // directive
          const match = line.match(/^%(\S+)/)
          const name = match ? match[1] : ''
          return { start, type: DIRECTIVE, name, body: line }
        }

        if (docStart.test(line)) {
          // document-start-marker
          this.doc = [{ start, type: DOC_START, indent, body: line }]
          return null
        }
      }

      // otherwise, at document start
      this.doc = []
    }

    if (indent === 0) {
      if (docStart.test(line)) {
        // document-start-marker
        const lines = this.doc
        this.doc = [{ start, type: DOC_START, indent, body: line }]
        return { type: DOCUMENT, lines }
      }

      if (docEnd.test(line)) {
        // document-end-marker
        const lines = this.doc
        lines.push({ start, type: DOC_END, indent, body: line })
        this.doc = null
        return { type: DOCUMENT, lines }
      }
    }

    if (indent === -1) {
      // empty line in document
      this.doc.push({ start, type: EMPTY_LINE, body: line })
      return null
    }

    if (line[indent] === '#') {
      // comment in document, or content within a scalar
      this.doc.push({ start, type: COMMENT, indent, body: line.slice(indent) })
      return null
    }

    // document contents
    this.doc.push({ start, indent, body: line.slice(indent) })
    return null
  }

  _flush(done) {
    if (this.lastLine) {
      const line = this.lastLine
      let indent = -1
      for (let i = 0; i < line.length; ++i)
        // No need to check for line-end here, by definition
        if (line[i] !== ' ') {
          indent = i
          break
        }
      const data = this.parseLine(line, indent)
      if (data) this.push(data)
      this.lastLine = ''
    }
    if (this.doc) {
      this.push({ type: DOCUMENT, lines: this.doc })
      this.doc = null
    }
    done()
  }

  _transform(chunk, encoding, done) {
    if (Buffer.isBuffer(chunk)) chunk = this.decoder.write(chunk)
    else if (typeof chunk !== 'string')
      return done(new Error('Only string and Buffer input is accepted'))

    if (this.lastLine) chunk = this.lastLine + chunk
    let lineStart = 0
    let indent = -1
    for (let i = 0; i < chunk.length; ++i) {
      const ch = chunk[i]
      if (ch === '\n' || (ch === '\r' && chunk[i + 1] === '\n')) {
        const crlf = ch === '\r'
        const line = chunk.slice(lineStart, i)
        const data = this.parseLine(line, indent, crlf)
        if (data) this.push(data)
        if (crlf) i += 1
        lineStart = i + 1
        indent = -1
      } else if (indent === -1 && ch !== ' ') indent = i - lineStart
    }

    this.lastLine = chunk.slice(lineStart)
    done()
  }
}

interface CommentLine {
  start: number
  type: 'COMMENT'
  indent: number
  body: string
}

interface DirectiveLine {
  start: number
  type: 'DIRECTIVE'
  name: string
  body: string
}

interface DocStartLine {
  start: number
  type: 'DOC_START'
  indent: 0
  body: string
}

interface DocEndLine {
  start: number
  type: 'DOC_END'
  indent: 0
  body: string
}

interface DocumentLines {
  type: 'DOCUMENT'
  lines: Array<
    | CommentLine
    | EmptyLine
    | DocStartLine
    | DocEndLine
    | { start: number; indent: number; body: string }
  >
}

interface EmptyLine {
  start: number
  type: 'EMPTY_LINE'
  body: string
}

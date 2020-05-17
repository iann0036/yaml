import { COMMENT, EMPTY_LINE } from './types.js'

export function buildNodeTree(lines) {
  const root = { indent: -1 }
  const path = [root]

  let prelude = null
  let parent = root
  let prev = root

  function addToPrelude(line) {
    if (prelude) prelude.push(line)
    else prelude = [line]
  }

  function addToParent(line) {
    if (prelude) {
      for (const p of prelude) parent.children.push(p)
      prelude = null
    }
    parent.children.push(line)
    prev = line
  }

  function considerPrevAsParent(line) {
    if (prelude) {
      prev.children = prelude
      prev.children.push(line)
      prelude = null
    } else prev.children = [line]
    path.push((parent = prev))
    prev = line
  }

  for (const line of lines) {
    // Case order matters here
    switch (true) {
      case line.type === EMPTY_LINE:
        // Empty lines always attach with the next non-empty line,
        addToPrelude(line)
        break

      case line.indent > prev.indent:
        // Indenting more makes the previous line a parent.
        considerPrevAsParent(line)
        break

      case line.type === COMMENT:
        // Indenting a comment less than the previous attaches it to the next
        // line. It's intentional that a subsequent more-indented comment line
        // may grab earlier less-indented lines.
        if (line.indent === prev.indent) addToParent(line)
        else addToPrelude(line)
        break

      default:
        // Need to search for the right ancestor, which could be the current
        // parent. No line has negative indent, so the loop always terminates
        // at the root node.
        while (line.indent <= parent.indent) parent = path.pop()
        addToParent(line)
    }
  }

  if (prelude) for (const p of prelude) root.children.push(p)
  return root.children
}

import { Comment, isVNode } from 'vue'

const DEV_ROOT_FRAGMENT = 2048
const is_scope = value => typeof value === 'string' && /^data-v-[\w-]+$/.test(value)

// Match runtime-core's filterSingleRoot / setScopeId root-only inheritance.
// A Teleport is not a DOM root: its children must not inherit arbitrary scopes
// from every ancestor merely because they happen to contain the frame.
const single_root = children => {
  if (!Array.isArray(children)) return null
  let root = null
  for (const child of children) {
    if (!isVNode(child)) return null
    if (child.type === Comment && child.children !== 'v-if') continue
    if (root) return null
    root = child
    if (root.patchFlag > 0 && root.patchFlag & DEV_ROOT_FRAGMENT) return single_root(root.children)
  }
  return root
}

/** Scope attrs lost only because the shared frame adds its own Teleport root. */
export function frame_scope_attributes(instance) {
  const attributes = {}, visited = new Set()
  let vnode = instance?.vnode, parent = instance?.parent
  const add = node => {
    if (is_scope(node?.scopeId)) attributes[node.scopeId] = ''
    if (Array.isArray(node?.slotScopeIds)) for (const id of node.slotScopeIds) if (is_scope(id)) attributes[id] = ''
  }
  add(vnode)
  while (vnode && parent && !visited.has(parent)) {
    visited.add(parent)
    let root = parent.subTree
    if (!root) break
    if (root.patchFlag > 0 && root.patchFlag & DEV_ROOT_FRAGMENT) root = single_root(root.children) || root
    const suspense_root = !!root.type?.__isSuspense && (root.ssContent === vnode || root.ssFallback === vnode)
    if (vnode !== root && !suspense_root) break
    vnode = parent.vnode
    add(vnode)
    parent = parent.parent
  }
  return attributes
}

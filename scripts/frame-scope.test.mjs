import test from 'node:test'
import assert from 'node:assert/strict'
import { Comment, Fragment, Teleport, createRenderer, createVNode, defineComponent, getCurrentInstance, h } from 'vue'
import { frame_scope_attributes } from '../src/utils/frameScope.js'

const node = (scopeId, slotScopeIds) => ({ ...createVNode('view'), scopeId, slotScopeIds })
const component = (vnode, subTree, parent = null) => ({ vnode, subTree, parent })

test('the inner real frame retains direct owner and slotted scoped styles', () => {
  const frame = node('data-v-welcome', ['data-v-slot-s'])
  assert.deepEqual(frame_scope_attributes(component(frame, createVNode(Teleport, {}, []))), { 'data-v-welcome': '', 'data-v-slot-s': '' })
})

test('AuthPageFrame and OnboardingFrame root chains retain their page owner scopes', () => {
  for (const wrapper of ['auth', 'onboarding']) {
    const frame = node(`data-v-${wrapper}`), wrapper_node = node('data-v-page'), page_node = node('data-v-router')
    const router = component(node('data-v-app'), createVNode('view', {}, [page_node]))
    const page = component(page_node, wrapper_node, router), parent = component(wrapper_node, frame, page)
    assert.deepEqual(frame_scope_attributes(component(frame, createVNode(Teleport, {}, []), parent)), { [`data-v-${wrapper}`]: '', 'data-v-page': '', 'data-v-router': '' })
  }
})

test('a frame nested in ordinary markup does not inherit unrelated grandparent root scopes', () => {
  const frame = node('data-v-direct'), parent = component(node('data-v-unrelated'), createVNode('view', {}, [frame]))
  assert.deepEqual(frame_scope_attributes(component(frame, null, parent)), { 'data-v-direct': '' })
})

test('Vue development root fragments with one real child preserve root-only inheritance', () => {
  const frame = node('data-v-frame'), root = createVNode(Fragment, {}, [createVNode(Comment, null, 'note'), frame], 2048)
  const parent = component(node('data-v-page'), root)
  assert.deepEqual(frame_scope_attributes(component(frame, null, parent)), { 'data-v-frame': '', 'data-v-page': '' })
  parent.subTree = createVNode(Fragment, {}, [root], 2048)
  assert.deepEqual(frame_scope_attributes(component(frame, null, parent)), { 'data-v-frame': '', 'data-v-page': '' })
})

test('multiple roots, ordinary Fragments, and Teleport child arrays never leak ancestor scopes', () => {
  const frame = node('data-v-frame'), parent = component(node('data-v-page'), null)
  for (const root of [createVNode(Fragment, {}, [frame, createVNode('view')], 2048), createVNode(Fragment, {}, [frame]), createVNode(Teleport, { to: '#portal' }, [frame]), createVNode(Fragment, {}, ['text', frame], 2048)]) {
    parent.subTree = root
    assert.deepEqual(frame_scope_attributes(component(frame, null, parent)), { 'data-v-frame': '' })
  }
})

test('Suspense only propagates to the actual content or fallback root', () => {
  const frame = node('data-v-frame'), sibling = node('data-v-sibling'), root = { type: { __isSuspense: true }, ssContent: frame, ssFallback: sibling }
  const parent = component(node('data-v-page'), root)
  assert.deepEqual(frame_scope_attributes(component(frame, null, parent)), { 'data-v-frame': '', 'data-v-page': '' })
  root.ssContent = createVNode('view')
  assert.deepEqual(frame_scope_attributes(component(frame, null, parent)), { 'data-v-frame': '' })
})

test('deduplication and defensive input handling never invent non-scope attributes', () => {
  assert.deepEqual(frame_scope_attributes(null), {})
  const frame = node('data-v-shared', ['data-v-shared', 'data-v-slot-s', null, 'class', '__proto__', 'data-v-x onclick=x'])
  const parent = component(node('data-v-shared'), frame)
  parent.parent = parent
  parent.vnode = frame
  assert.deepEqual(frame_scope_attributes(component(frame, null, parent)), { 'data-v-shared': '', 'data-v-slot-s': '' })
  parent.subTree = { patchFlag: 2048, children: null }
  assert.deepEqual(frame_scope_attributes(component(frame, null, parent)), { 'data-v-shared': '', 'data-v-slot-s': '' })
})

test('Vue applies the inherited attrs to a real Teleport child during initial component setup', () => {
  const make = type => ({ type, attrs: {}, children: [], parent: null }), container = make('root'), portal = make('portal')
  const renderer = createRenderer({
    createElement: make, createText: text => ({ ...make('text'), text }), createComment: text => ({ ...make('comment'), text }),
    insert(child, parent, anchor = null) {
      if (child.parent) { const index = child.parent.children.indexOf(child); if (index >= 0) child.parent.children.splice(index, 1) }
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index < 0 ? parent.children.length : index, 0, child); child.parent = parent
    },
    remove(child) { if (child.parent) { child.parent.children.splice(child.parent.children.indexOf(child), 1); child.parent = null } },
    setElementText: (element, text) => { element.text = text }, setText: (element, text) => { element.text = text }, setComment: (element, text) => { element.text = text },
    parentNode: element => element.parent, nextSibling: element => element.parent?.children[element.parent.children.indexOf(element) + 1],
    patchProp: (element, key, previous, value) => { element.attrs[key] = value },
    setScopeId: (element, key) => { element.attrs[key] = '' }, querySelector: () => portal,
  })
  const Frame = defineComponent({ __scopeId: 'data-v-frame', setup() {
    const inherited = frame_scope_attributes(getCurrentInstance())
    return () => h(Teleport, { disabled: true, to: '#portal' }, [h('view', inherited)])
  } })
  const Auth = defineComponent({ __scopeId: 'data-v-auth', render: () => h(Frame) })
  const Login = defineComponent({ __scopeId: 'data-v-login', render: () => h(Auth) })
  renderer.render(h(Login), container)
  const element = container.children.find(child => child.type === 'view')
  assert.ok(element)
  assert.deepEqual(element.attrs, { 'data-v-frame': '', 'data-v-auth': '', 'data-v-login': '' })
  renderer.render(null, container)
  assert.equal(container.children.length, 0)
})

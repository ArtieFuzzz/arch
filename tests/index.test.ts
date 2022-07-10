import test from 'ava'
import * as index from '../src/index'

test('Index should return \'Hello, World!\'', t => {
  const out = index.world()

  t.is(out, 'Hello, World!', 'output didn\'t equal \'Hello, World!\'')
})

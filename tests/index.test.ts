import test from 'ava'
import * as index from '../src/index'

test('Test typeof Gateway', t => {

  t.is(typeof index.Gateway, 'function')
})

// The self-isolating tests orchestrate native sandboxes; their own modules must still belong to this clone.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = fs.realpathSync(path.resolve(__dirname, '../..'));
function check(file) {
  if (Module.isBuiltin(file)) return;
  const real = fs.realpathSync(file);
  const relative = path.relative(root, real);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    const error = new Error(`ERR_PUBLIC_DEPENDENCY_OUTSIDE: Public test dependency resolves outside its clone: ${file}`);
    error.code = 'ERR_PUBLIC_DEPENDENCY_OUTSIDE';
    throw error;
  }
  if (process.env.PUBLIC_TEST_RESOLUTIONS) fs.appendFileSync(process.env.PUBLIC_TEST_RESOLUTIONS, JSON.stringify(relative) + '\n');
}
const resolve = Module._resolveFilename;
Module._resolveFilename = function (...args) {
  const file = resolve.apply(this, args);
  check(file);
  return file;
};
module.exports = { check };

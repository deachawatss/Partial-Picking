const fs = require('fs');
const path = require('path');

const filesToPatch = [
  path.join(__dirname, '..', 'node_modules', 'http-proxy', 'lib', 'http-proxy', 'index.js'),
  path.join(__dirname, '..', 'node_modules', 'http-proxy', 'lib', 'http-proxy', 'common.js')
];

const fallback = `extend    = Object.assign ? Object.assign : function (target) {\n      if (target == null) {\n        target = {};\n      }\n\n      for (var i = 1; i < arguments.length; i++) {\n        var source = arguments[i];\n        if (!source) continue;\n\n        for (var key in source) {\n          if (Object.prototype.hasOwnProperty.call(source, key)) {\n            target[key] = source[key];\n          }\n        }\n      }\n\n      return target;\n    },`;

const extendRegexes = [
  /extend\s*=\s*require\('util'\)\._extend,/g,
  /extend\s*=\s*Object\.assign\s*\|\|\s*patchHttpProxyExtend,/g
];

const helperRegex = /var patchHttpProxyExtend[\s\S]*?return target;\n};\n\n/;

let patchedAny = false;

for (const filePath of filesToPatch) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[patch-http-proxy] Target ${filePath} not found, skipping`);
    continue;
  }

  let contents = fs.readFileSync(filePath, 'utf8');
  let updated = contents.replace(helperRegex, '');

  for (const regex of extendRegexes) {
    if (regex.test(updated)) {
      updated = updated.replace(regex, fallback);
    }
  }

  if (updated !== contents) {
    fs.writeFileSync(filePath, updated, 'utf8');
    patchedAny = true;
    console.log(`[patch-http-proxy] Patched ${path.relative(path.join(__dirname, '..'), filePath)}`);
  }
}

if (!patchedAny) {
  console.log('[patch-http-proxy] Nothing to patch (already up to date)');
}

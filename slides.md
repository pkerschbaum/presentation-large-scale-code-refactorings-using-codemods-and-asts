---
# You can also start simply with 'default'
theme: default
title: Large-scale code changes using ASTs and jscodeshift
# apply unocss classes to the current slide
class: text-center
# https://sli.dev/features/drawing
drawings:
  persist: false
# enable MDC Syntax: https://sli.dev/features/mdc
mdc: true
# take snapshot for each slide in the overview
overviewSnapshots: true
# aspect ratio for the slides
aspectRatio: 16/9
# real width of the canvas, unit in px
canvasWidth: 800
---

# Large-scale code changes using ASTs and jscodeshift

---

```yaml
layout: fact
```

the problem: "large-scale code changes"

= the need to change code at many places

---

For example, changing something in all `package.json`s

<img v-click src="/005_count-of-workspace-projects.png" />

---

Solution #1: string-replace one constant with another constant

<img v-click src="/007_constant_replace.png" />

---

Solution #2: Regex replace

i.e. pattern matching + reuse of matched groups

<img v-click src="/008_regex_replace.png" />

---

```yaml
layout: fact
```

unfortunately, this is sometimes not powerful enough...

---

**Challenge: CJS to ESM migration, module specifiers**

Node.js does, in ESM modules, not "guess" the full paths:

```ts
// assuming "./constants.js" exists, this import works in CJS but not ESM!
import * as constants from './constants';

// this works in ESM (and CJS)
import * as constants from './constants.js';
```

→ Consequence: need to adapt module specifiers during CJS to ESM migration!

---

**The case: monorepo `mfm-online/mfm-online`**

- **512** TypeScript files, 99% CJS modules
- **1283** module specifiers to fix
  - (`import` statements, `export` statements, `declare module`)
  - e.g.
    - `import { BREAKPOINTS } from './constants'`
    - <span v-mark.circle.orange>`import { BREAKPOINTS } from '#pkg/constants'`</span>

---

Attempt #1: Regex replace

`import(\s|\n)(.+) from(\s|\n)+'#(?!.*\.js')(?!.*\.cjs')(?!.*\.mjs')(.+)'`

<img v-click src="/010_regex_place_looking_good.png" />

---

<img src="/030_after_regex_replace_prisma_problem.png" />

---

**Observation: the "full path" of a module specifier is not easy to determine**

```ts
// this "coarse" module specifier...
import * as constants from './constants';

// ...could be:
import * as constants from './constants.js';
import * as constants from './constants.cjs';
import * as constants from './constants/index.js';
import * as constants from './constants/index.cjs';
```

---

```yaml
layout: two-cols-header
```

**Two options**

::left::

<div v-click>

spending <u>**_hours_**</u> fixing it manually

</div>

::right::

<span v-click v-mark.circle.orange>spending <u>**_days_**</u> automating it</span>

---

**Idea**

- process each file
- detect all module specifiers
- for each module specifier
  - find out what the specifier _actually_ points to (`.js`, `./index.js`, etc.)
  - change the specifier accordingly

→ The most sophisticated regex search-replace cannot do this!

---

**Introducing: Abstract Syntax Tree (AST)**

We can parse code and transform it to a datastructure - an _abstract syntax tree_.

- allows to work with **_nodes_** in a **_precise_** manner
- (instead of appling **_string/regex pattern matching_**, which is **_fuzzy_**)

Very similar to the DOM tree!

---

**Analyzing ASTs of code via explorer:**

- [astexplorer.net](http://astexplorer.net)
  - Set `@typescript-eslint/parser` as parser!
- [astexplorer example](https://astexplorer.net/#/gist/1f620454416fa13ce88e65d626c32816/eb0b214e68c1c19f35f3cf00e4c29fba2bc824d2)

---

**Introducing: [facebook/jscodeshift](https://github.com/facebook/jscodeshift)**

JavaScript library to work with code and ASTs.

- can parse code to generate an AST, and transform an AST back to code
- has helpers:
  - find and mutate AST nodes
  - strongly-typed AST node types (e.g. `j.ImportDeclaration`)

Used by

- Nuxt codemods ([source](https://github.com/codemod-com/codemod/blob/3c6da58be44b18c88d7ce05f3257450eabdf72e4/packages/codemod-utils/package.json#L37))
- Next.js codemods ([source](https://github.com/vercel/next.js/blob/8f99ab20aed876b7436fba3534fe554666a9db46/packages/next-codemod/package.json#L17))
- Prisma codemods ([source](https://github.com/prisma/codemods/blob/db3fea927c79ef4c48a3df3876d1724e4e451e78/package.json#L39))
- etc.

---

<style>
.astexplorerNodeImage1 {
  position: absolute;
  height: 120px;
  top: 32px;
  right: 32px;
}

.astexplorerNodeImage2 {
  position: absolute;
  height: 120px;
  top: 180px;
  right: 32px;
}
</style>

```ts {1-2|4-6|8-13|15-16|18-26|20-20|22-25|22-25|18-26|28-30|all}
import fs from 'node:fs';
import j from 'jscodeshift';

// load code of source file and its AST
const text = await fs.promises.readFile('./constants.ts', 'utf8');
const programNode = j.withParser('tsx')(text);

// find all import declarations
const astNodesImportDeclarations = programNode.find(j.ImportDeclaration, {
  source: {
    type: 'Literal',
  },
});

// find all module specifiers
const astNodesModuleSpecifiers = astNodesImportDeclarations.find(j.Literal);

// mutate them in-place
astNodesModuleSpecifiers.forEach((astPath) => {
  const astNode = astPath.node;

  const originalModuleSpecifier = astNode.value;
  // originalModuleSpecifier='./constants', newModuleSpecifier='./constants.js'
  const newModuleSpecifier = resolveModuleSpecifierToFullPath(originalModuleSpecifier);
  astNode.value = newModuleSpecifier;
});

// produce code from AST and write it back
const newText = programNode.toSource();
await fs.promises.writeFile('./constants.ts', newText, 'utf8');
```

<img v-click="[5, 6]" src="/055_astexplorer_node.png" class="astexplorerNodeImage1" />

<img v-click="[7, 8]" src="/055_astexplorer_node.png" class="astexplorerNodeImage1" />

<img v-click="[7, 8]" src="/057_astexplorer_node2.png" class="astexplorerNodeImage2" />

---

Note: other types of nodes to capture:

- `export ... from <MODULE_SPECIFIER>`
- `declare module <MODULE_SPECIFIER>`
- `require(<MODULE_SPECIFIER>)`
- ...actually **9 ways** to use module specifiers as of Nov 2024

Result: `@pkerschbaum/codemod-rewrite-module-specifiers-to-full-paths
` ([npmjs.com](https://www.npmjs.com/package/@pkerschbaum/codemod-rewrite-module-specifiers-to-full-paths), [github.com](https://github.com/pkerschbaum/packages/tree/main/packages/codemod-rewrite-module-specifiers-to-full-paths))

- worked for `mfm-online/mfm-online` and `@hokify/common` ([hokify/hokify#9624](https://github.com/hokify/hokify/pull/9624))

---

**Use cases**

- migrate hokify CJS code to ESM
- migrate TypeScript `enum`s to pure JavaScript objects
- ...all code changes where regex-replace is not exact or powerful enough

---

<style>
.my-image {
  position: absolute;
  top: 32px;
  left: 32px;
  width: 500px;
}
</style>

Bonus point: ESLint `no-restricted-syntax`

- allows to forbid code patterns based on AST
- the CSS-style syntax is <https://github.com/estools/esquery>.

```ts
{
  'no-restricted-syntax': [
			'error',
			{
				selector:
					"VariableDeclarator:has(ObjectPattern):has(MemberExpression:has(Identifier[name='process']):has(Identifier[name='env']))",
				message:
					'Do not use destructuring for "process.env".'
			}
		]
}
```

<img v-click src="/060_eslint-norestrictedsyntax-error.png" class="my-image" />

---

**Appendix: 3 JavaScript-relevant AST formats**

- ESTree ("ECMAScript Tree", <https://github.com/estree/estree>)
  - community standard
  - used by e.g. ESLint, Prettier
  - "general purpose" AST
- TypeScript AST
  - used by TypeScript
  - optimized for parsing incomplete code and typechecking
- <span v-mark.circle.orange>TSESTree</span>
  - generated by [`@typescript-eslint/parser`](https://typescript-eslint.io/packages/parser/)
  - ESTree which is extended with information of the TypeScript AST

---

**Appendix: some resources**

- <https://typescript-eslint.io/blog/asts-and-typescript-eslint/>
- <https://typescript-eslint.io/packages/typescript-estree/ast-spec/>
- <https://explorer.eslint.org/>
- <https://eslint.org/docs/latest/rules/no-restricted-syntax>
- <https://github.com/facebook/jscodeshift>
- <https://github.com/estools/esquery>

---


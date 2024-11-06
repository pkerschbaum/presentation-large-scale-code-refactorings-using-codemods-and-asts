module.exports = {
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  endOfLine: 'auto',
  // third-party dependencies first, workspace dependencies second, internal stuff third
  importOrder: ['<THIRD_PARTY_MODULES>', '', '^#pkg/(.*)$', '', '^[./]'],
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  importOrderTypeScriptVersion: '5.5.4',
  plugins: ['prettier-plugin-packagejson', '@ianvs/prettier-plugin-sort-imports'],
  overrides: [
    {
      files: ['slides.md', 'pages/*.md'],
      options: {
        parser: 'slidev',
        plugins: ['prettier-plugin-slidev'],
      },
    },
  ],
};

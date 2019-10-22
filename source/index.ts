import { Plugin, TransformResult, PluginContext } from 'rollup';
import { walk } from 'estree-walker';
import MagicString from 'magic-string';
import { generate } from 'astring';
import { Node } from 'estree';

export interface StripExportsOptions {
  sourceMap?: boolean;
}

const defaultStripExportsOptions: StripExportsOptions = {
  sourceMap: true,
};

/**
 * Rollup plugin which strips export statements.
 *
 * @param options - Strip exports options.
 * @returns Strip export plugin.
 */
export default function stripExports(
  options: StripExportsOptions = {}
): Plugin {
  options = {
    ...defaultStripExportsOptions,
    ...options,
  };
  return {
    name: 'strip-exports',
    transform(this: PluginContext, code: string, id: string): TransformResult {
      if (!this.getModuleInfo(id).isEntry) {
        return;
      }

      const ast = this.parse(code, { ranges: true });

      const magicString = new MagicString(code);

      let removed = false;

      walk(ast, {
        enter(node?: Node): void {
          const [start, end] = node.range;
          if (options.sourceMap) {
            magicString.addSourcemapLocation(start);
            magicString.addSourcemapLocation(end);
          }
          switch (node.type) {
            case 'ExportAllDeclaration':
              magicString.remove(start, end);
              removed = true;
              this.skip();
              break;
            case 'ExportNamedDeclaration':
            case 'ExportDefaultDeclaration':
              if (
                node.declaration &&
                node.declaration.type !== 'Literal' &&
                node.declaration.type !== 'Identifier'
              ) {
                magicString.overwrite(start, end, generate(node.declaration));
                removed = true;
                this.skip();
              } else {
                magicString.remove(start, end);
                removed = true;
                this.skip();
              }
              break;
          }
        },
      });
      if (!removed) {
        return null;
      }

      const map = options.sourceMap ? magicString.generateMap() : undefined;
      return { code: magicString.toString(), map };
    },
  };
}

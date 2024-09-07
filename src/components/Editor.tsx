import { shikiToMonaco } from "@shikijs/monaco";
import * as monaco from "monaco-editor-core";
import { BundledLanguage, createHighlighter } from "shiki";
import { Accessor, Component, Setter, createEffect, untrack } from "solid-js";

import { getGrmrUniqueName } from "~/utils";

interface Props {
  editor: Accessor<monaco.editor.IStandaloneCodeEditor | null>;
  setEditor: Setter<monaco.editor.IStandaloneCodeEditor | null>;
  setPosition: Setter<monaco.Position | null>;
  setSelection: Setter<monaco.Selection | null>;
  selectedGrammar: Accessor<string | undefined>;
  selectedHighlighter: Accessor<BundledLanguage | "text">;
  grammars: Accessor<TsGrammar[]>;
  parse: (content: string) => void;
}

const Editor: Component<Props> = (props) => {
  let ref: HTMLDivElement = null!;

  createEffect(() => {
    const selectedGrammar = props.selectedGrammar();
    const selectedHighlighter = props.selectedHighlighter();
    if (selectedGrammar) {
      untrack(() => {
        let editor = props.editor();
        if (editor) {
          editor.dispose();
        }
      });
      createHighlighter({
        themes: ["dark-plus"],
        langs: [selectedHighlighter],
      }).then((highlighter) => {
        monaco.languages.register({ id: selectedHighlighter });
        shikiToMonaco(highlighter, monaco);

        let grmrUniqueName = getGrmrUniqueName(selectedGrammar);

        const editor = monaco.editor.create(ref, {
          value: localStorage.getItem(`treeground.${grmrUniqueName}`) || "",
          language: selectedHighlighter,
          theme: "dark-plus",
          automaticLayout: true,
          occurrencesHighlight: "off",
        });
        editor.onDidChangeModelContent(() => {
          untrack(() => props.parse(editor.getValue()));
          localStorage.setItem(
            `treeground.${grmrUniqueName}`,
            editor.getValue(),
          );
        });
        editor.onDidChangeCursorPosition((e) => {
          let selection = editor.getSelection();
          if (selection && selection.startColumn === selection.endColumn) {
            props.setPosition(e.position);
          }
        });
        editor.onDidChangeCursorSelection((e) => {
          props.setSelection(e.selection);
        });
        props.setEditor(editor);
      });
    }
  });

  return (
    <div id="editor" class="h-full border border-gray-400" ref={ref}></div>
  );
};

export default Editor;

import * as monaco from "monaco-editor-core";
import { BundledLanguage } from "shiki";
import {
  Accessor,
  Setter,
  createContext,
  createEffect,
  createReaction,
  createSignal,
  onMount,
} from "solid-js";
import Parser from "web-tree-sitter";

import Bmac from "~/components/Bmac";
import Editor from "~/components/Editor";
import Nav from "~/components/Nav";
import Tools from "~/components/Tools";
import Tree from "~/components/Tree";

import { getGrmrUniqueName, sendMsgToServer } from "~/utils";

type Modal = "Add" | "Tools" | null;

export const AppContext = createContext<{
  ws: Accessor<WebSocket | null>;
  modal: Accessor<Modal>;
  setModal: Setter<Modal>;
}>({
  ws: () => null,
  modal: () => null,
  setModal: () => {},
});

function App() {
  const [modal, setModal] = createSignal<Modal>(null);
  const [ws, setWs] = createSignal<WebSocket | null>(null);
  const [editor, setEditor] =
    createSignal<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [position, setPosition] = createSignal<monaco.Position | null>(null);
  const [selection, setSelection] = createSignal<monaco.Selection | null>(null);
  const [tree, setTree] = createSignal<Parser.Tree | null>(null);
  const [errors, setErrors] = createSignal<number>(0);

  const [grammars, setGrammars] = createSignal<TsGrammar[]>(
    JSON.parse(localStorage.getItem("treeground.grammars") || "[]"),
  );
  const [selectedGrammar, setSelectedGrammar] = createSignal<
    string | undefined
  >(localStorage.getItem("treeground.selectedGrammar") || undefined);
  const [selectedHighlighter, setSelectedHighlighter] = createSignal<
    BundledLanguage | "text"
  >(
    grammars().find((grammar) => grammar.folder === selectedGrammar())
      ?.highlighter || "text",
  );
  const [parsers, setParsers] = createSignal<{ [grammar: string]: Parser }>({});

  onMount(async () => {
    const socket = new WebSocket(`ws://${location.host}/tg`);
    socket.addEventListener("open", () => {
      sendMsgToServer(socket, {
        type: "watch",
        folders: grammars().map((g) => g.folder),
      });
    });
    setWs(socket);
    await Parser.init();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "load") {
        loadParser(message.grammar).then(() => {
          let selectedGrmr = selectedGrammar();
          if (selectedGrmr) {
            if (selectedGrmr === message.grammar) {
              parse(editor()?.getValue() || "");
            }
          }
        });
      }
    });
    const selectedGrmr = selectedGrammar();
    if (selectedGrmr) {
      loadParser(selectedGrmr);
    }
  });

  const loadParser = async (grammar: string) => {
    const parser = new Parser();
    parser.setLanguage(
      await Parser.Language.load(`/${getGrmrUniqueName(grammar)}.wasm`),
    );
    setParsers((prev) => ({ ...prev, [grammar]: parser }));
  };

  const parse = async (content: string) => {
    const selectedGrmr = selectedGrammar();
    if (selectedGrmr) {
      let parser = parsers()[selectedGrmr];
      if (!parser) {
        await loadParser(selectedGrmr);
        parser = parsers()[selectedGrmr];
      }
      setTree(parser.parse(content));
    }
  };

  createEffect(() => {
    const selectedGrmr = selectedGrammar();
    if (selectedGrmr) {
      localStorage.setItem("treeground.selectedGrammar", selectedGrmr);
      parseOnNewEditor();
    }
  });

  createEffect(() => {
    localStorage.setItem("treeground.grammars", JSON.stringify(grammars()));
  });

  const parseOnNewEditor = () => {
    const track = createReaction(() => {
      const e = editor();
      if (e) {
        parse(e.getValue());
      }
    });
    track(() => editor());
  };
  parseOnNewEditor();

  const moveEditorToNode = (node: Parser.SyntaxNode) => {
    const e = editor();
    if (e) {
      e.setSelection({
        startLineNumber: node.startPosition.row + 1,
        startColumn: node.startPosition.column + 1,
        endLineNumber: node.endPosition.row + 1,
        endColumn: node.endPosition.column + 1,
      });
      e.getSelection();
      e.revealRangeInCenter(
        new monaco.Range(
          node.startPosition.row + 1,
          node.startPosition.column + 1,
          node.endPosition.row + 1,
          node.endPosition.column + 1,
        ),
      );
    }
  };

  return (
    <AppContext.Provider value={{ modal, setModal, ws }}>
      <div class="p-2">
        <Nav
          ws={ws}
          grammars={grammars}
          setGrammars={setGrammars}
          selectedGrammar={selectedGrammar}
          setSelectedGrammar={setSelectedGrammar}
          setSelectedHighlighter={setSelectedHighlighter}
          errors={errors}
          parseOnNewEditor={parseOnNewEditor}
        />
        <div class="grid grid-cols-2 gap-2 h-[calc(100vh*0.75)]">
          <Editor
            editor={editor}
            setEditor={setEditor}
            setPosition={setPosition}
            setSelection={setSelection}
            selectedGrammar={selectedGrammar}
            selectedHighlighter={selectedHighlighter}
            grammars={grammars}
            parse={parse}
          />
          <Tree
            tree={tree}
            setErrors={setErrors}
            position={position}
            selection={selection}
            moveEditorToNode={moveEditorToNode}
          />
        </div>
        <div class="flex justify-center my-2">
          <a
            class="size-[50px] flex justify-center items-center bg-gray-200 hover:bg-gray-300 rounded-full cursor-pointer transition-all *:hover:scale-110"
            href="https://buymeacoffee.com/almahdi404"
            target="_blank"
            title="Buy me a coffee"
          >
            <Bmac size={30} />
          </a>
        </div>
      </div>
      <Tools />
    </AppContext.Provider>
  );
}

export default App;

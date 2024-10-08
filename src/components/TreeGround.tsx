import * as monaco from "monaco-editor-core";
import { BundledLanguage } from "shiki";
import { AiFillCloseCircle, AiFillQuestionCircle } from "solid-icons/ai";
import {
  Accessor,
  Match,
  Setter,
  Show,
  Switch,
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
  const [error, setError] = createSignal<{
    type: "generate" | "wasm";
    error: string;
  } | null>(null);

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
        setError(null);
        loadParser(message.grammar).then(() => {
          let selectedGrmr = selectedGrammar();
          if (selectedGrmr) {
            if (selectedGrmr === message.grammar) {
              parse(editor()?.getValue() || "");
            }
          }
        });
      } else if (message.type === "generateError") {
        setError({
          type: "generate",
          error: message.error,
        });
      } else if (message.type === "wasmError") {
        setError({
          type: "wasm",
          error: message.error,
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
    localStorage.setItem("treeground.selectedGrammar", selectedGrammar() || "");
  });

  createEffect(() => {
    localStorage.setItem("treeground.grammars", JSON.stringify(grammars()));
  });

  const parseOnNewEditor = () => {
    const track = createReaction(() => {
      const e = editor();
      if (e) {
        parse(e.getValue());
      } else {
        setTree(null);
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
      <Show when={error()}>
        {(err) => (
          <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg min-w-[calc(100vw*0.80)] max-w-[calc(100vw*0.90)] max-h-[calc(100vh*0.90)] flex flex-col">
              <div class="flex justify-end p-2 border-b border-gray-300">
                <AiFillCloseCircle
                  size={28}
                  class="text-gray-500 hover:text-blue-500 active:scale-110 transition-all cursor-pointer"
                  onclick={() => setError(null)}
                />
              </div>
              <div class="p-3 flex-grow max-h-full flex flex-col overflow-hidden">
                <div class="my-2 flex gap-1 align-top">
                  <AiFillQuestionCircle size={22} class="text-red-500" />
                  <p class="font-bold m-0">
                    <Switch>
                      <Match when={err().type === "generate"}>
                        Failed to generate parser
                      </Match>
                      <Match when={err().type === "wasm"}>
                        Failed to build wasm
                      </Match>
                    </Switch>
                  </p>
                </div>
                <pre class="text-gray-700 bg-gray-300 p-2 rounded-md w-100 overflow-auto">
                  {err().error}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Show>
    </AppContext.Provider>
  );
}

export default App;

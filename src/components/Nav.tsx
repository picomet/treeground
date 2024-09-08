import { BundledLanguage, bundledLanguages } from "shiki";
import { AiFillCloseCircle, AiOutlinePlus } from "solid-icons/ai";
import { IoTrash } from "solid-icons/io";
import {
  Accessor,
  Component,
  Setter,
  Show,
  batch,
  createSignal,
  useContext,
} from "solid-js";

import { AppContext } from "~/components/TreeGround";

import { getBaseName, sendMsgToServer } from "~/utils";

const Nav: Component<{
  ws: Accessor<WebSocket | null>;
  grammars: Accessor<TsGrammar[]>;
  setGrammars: Setter<TsGrammar[]>;
  selectedGrammar: Accessor<string | undefined>;
  setSelectedGrammar: Setter<string | undefined>;
  setSelectedHighlighter: Setter<BundledLanguage | "text">;
  errors: Accessor<number>;
  parseOnNewEditor: () => void;
}> = (props) => {
  const ctx = useContext(AppContext);
  const [inputGrammar, setInputGrammar] = createSignal<string>("");

  const addGrammar = (e: SubmitEvent) => {
    e.preventDefault();
    const inputGrmr = inputGrammar();
    if (inputGrmr) {
      const socket = props.ws();
      if (socket) {
        sendMsgToServer(socket, {
          type: "add",
          folder: inputGrmr,
        });
      }
      if (!props.grammars().find((grammar) => grammar.folder === inputGrmr)) {
        props.setGrammars((prev) => [
          ...prev,
          { folder: inputGrmr, highlighter: "text" },
        ]);
      }
      props.setSelectedGrammar(inputGrmr);
      props.parseOnNewEditor();
      setInputGrammar("");
      ctx.setModal(null);
    }
  };

  const removeGrammar = (e: Event) => {
    e.preventDefault();
    const socket = props.ws();
    const selectedGrmr = props.selectedGrammar();
    if (socket && selectedGrmr) {
      sendMsgToServer(socket, {
        type: "remove",
        folder: selectedGrmr,
      });
      props.setGrammars((prev) =>
        prev.filter((grammar) => grammar.folder !== selectedGrmr),
      );
      props.parseOnNewEditor();
      props.setSelectedGrammar(props.grammars().at(-1)?.folder);
    }
  };

  const findSelectedGrammar = () => {
    const selectedGrmr = props.selectedGrammar();
    if (selectedGrmr) {
      return props
        .grammars()
        .find((grammar) => grammar.folder === selectedGrmr);
    }
  };

  const handleGrammarChange = (e: Event & { target: HTMLSelectElement }) => {
    const value = e.target.value;
    if (value) {
      props.parseOnNewEditor();
      batch(() => {
        props.setSelectedGrammar(value);
        props.setSelectedHighlighter(
          props.grammars().find((grammar) => grammar.folder === value)
            ?.highlighter || "text",
        );
      });
    }
  };

  const handleHighlighterChange = (
    e: Event & {
      target: HTMLSelectElement;
    },
  ) => {
    const value = e.target.value as BundledLanguage;
    const selectedGrmr = props.selectedGrammar();
    if (value && selectedGrmr) {
      const grmrs = props.grammars();
      const grmrIndex = grmrs.findIndex(
        (grammar) => grammar.folder === selectedGrmr,
      );
      if (grmrIndex !== -1) {
        grmrs[grmrIndex].highlighter = value;
        props.setGrammars((prev) => [...prev]);
        props.setSelectedHighlighter(value);
      }
    }
  };

  return (
    <nav class="my-1 flex align-middle gap-2">
      <h2 class="text-2xl font-bold">Tree Sitter Playground</h2>
      <button
        class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded"
        title="Add grammar"
        onclick={() => ctx.setModal("Add")}
      >
        <AiOutlinePlus />
      </button>
      <Show when={ctx.modal() === "Add"}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg w-full max-w-md">
            <div class="flex justify-end p-2 border-b border-gray-300">
              <AiFillCloseCircle
                size={28}
                class="text-gray-500 hover:text-blue-500 active:scale-110 transition-all cursor-pointer"
                onclick={() => ctx.setModal(null)}
              />
            </div>
            <form class="flex gap-2 p-2 my-2" onSubmit={(e) => addGrammar(e)}>
              <input
                class="p-2 border border-gray-300 rounded w-full"
                placeholder="grammar folder"
                value={inputGrammar()}
                onChange={(e) => setInputGrammar(e.target.value)}
              />
            </form>
          </div>
        </div>
      </Show>
      <div class="w-[1px] self-stretch bg-gray-300 rounded-l"></div>
      <Show when={props.grammars().length}>
        <select
          class="border border-gray-300 rounded"
          value={props.selectedGrammar()}
          onChange={handleGrammarChange}
        >
          {props.grammars().map((grammar) => (
            <option
              value={grammar.folder}
              selected={grammar.folder === props.selectedGrammar()}
            >
              {getBaseName(grammar.folder)}
            </option>
          ))}
        </select>
      </Show>
      <Show when={props.selectedGrammar()}>
        <select
          class="border border-gray-300 rounded"
          style="border: 1px solid transparent;
                 border-image: linear-gradient(to bottom right, #b827fc 0%, #2c90fc 25%, #b8fd33 50%, #fec837 75%, #fd1892 100%);
                 border-image-slice: 1;"
          value={findSelectedGrammar()?.highlighter}
          onChange={handleHighlighterChange}
        >
          <option value="text">text (default)</option>
          {Object.keys(bundledLanguages).map((highlighter) => (
            <option
              value={highlighter}
              selected={highlighter === findSelectedGrammar()?.highlighter}
            >
              {highlighter}
            </option>
          ))}
        </select>
      </Show>
      <Show when={props.selectedGrammar()}>
        <button
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded"
          title="Remove grammar"
          onClick={removeGrammar}
        >
          <IoTrash />
        </button>
      </Show>
      <Show when={props.grammars().length}>
        <div class="w-[1px] self-stretch bg-gray-300 rounded-l"></div>
      </Show>
      <button
        class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded"
        title="Tools"
        onclick={() => ctx.setModal("Tools")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 16 16"
        >
          <path
            fill="currentColor"
            d="M6.122.392a1.75 1.75 0 0 1 1.756 0l5.25 3.045c.54.313.872.89.872 1.514V7.25a.75.75 0 0 1-1.5 0V5.677L7.75 8.432v6.384a1 1 0 0 1-1.502.865L.872 12.563A1.75 1.75 0 0 1 0 11.049V4.951c0-.624.332-1.2.872-1.514ZM7.125 1.69a.25.25 0 0 0-.25 0l-4.63 2.685L7 7.133l4.755-2.758ZM1.5 11.049a.25.25 0 0 0 .125.216l4.625 2.683V8.432L1.5 5.677Zm11.672-.282L11.999 12h3.251a.75.75 0 0 1 0 1.5h-3.251l1.173 1.233a.75.75 0 1 1-1.087 1.034l-2.378-2.5a.75.75 0 0 1 0-1.034l2.378-2.5a.75.75 0 0 1 1.087 1.034"
          />
        </svg>
      </button>
      <Show when={props.errors()}>
        <span
          class="ms-auto py-1 px-2 bg-red-500 text-white rounded"
          title="Errors"
        >
          {props.errors()}
        </span>
      </Show>
    </nav>
  );
};

export default Nav;
